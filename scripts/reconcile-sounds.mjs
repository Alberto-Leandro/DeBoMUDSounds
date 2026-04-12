import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const apply = process.argv.includes("--apply");
const strict = process.argv.includes("--strict");

const CATEGORY_FROM_FOLDER = {
  uar_BarraDeVida: "barraDeVida",
  uar_Bgm: "bgm",
  uar_Classes: "classes",
  uar_Fx: "fx",
  uar_Vivas: "vivas",
};

const IGNORED_TOP_FOLDERS = new Set(["uar_MigracaoPendencias"]);

const AUDIO_EXT = new Set([".mp3", ".ogg", ".wav", ".m4a", ".flac"]);
const ROOTS = [
  { key: "Sounds", dir: path.join(repoRoot, "Sounds") },
  { key: "docs/Sounds", dir: path.join(repoRoot, "docs", "Sounds") },
];

const SET_FILES = [
  { file: "uarBarrasDeVida.set", category: "barraDeVida" },
  { file: "uarBGM.set", category: "bgm" },
  { file: "uarClasses.set", category: "classes" },
  { file: "uarFX.set", category: "fx" },
  { file: "uarViva.set", category: "vivas" },
];

const SOUND_REF_REGEX = /([A-Za-z0-9_./\\-]+\.(?:mp3|ogg|wav|m4a|flac))/gi;

const usage = new Map();
const perSet = new Map();

extractReferences();
const inventories = ROOTS.map((root) => buildInventory(root));
const analysis = inventories.map((inv) => analyzeInventory(inv));

const plannedMoves = analysis.flatMap((item) => item.moves);
const report = renderReport(analysis, plannedMoves);

const reportPath = path.join(repoRoot, "docs", "sound-reconciliation-report.md");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, report, "utf8");

if (apply) {
  const moveLog = executeMoves(plannedMoves);
  const movedReportPath = path.join(
    repoRoot,
    "docs",
    "sound-reconciliation-moves.log",
  );
  fs.writeFileSync(movedReportPath, moveLog.join("\n") + "\n", "utf8");
  console.log(`Movimentos aplicados: ${moveLog.length}`);
  console.log(`Log: ${path.relative(repoRoot, movedReportPath)}`);
}

console.log(`Relatorio: ${path.relative(repoRoot, reportPath)}`);
console.log(`Modo: ${apply ? "apply" : "dry-run"}`);

if (strict) {
  const hasProblems = analysis.some(
    (item) =>
      item.missing.length > 0 ||
      item.wrong.some((wrong) => wrong.reason === "pasta-incorreta"),
  );
  if (hasProblems) {
    console.error("Falha strict: existem referencias ausentes ou arquivos em pasta incorreta.");
    process.exitCode = 1;
  }
}

function extractReferences() {
  const setRoot = path.join(repoRoot, "VipMUDTriggers");

  for (const item of SET_FILES) {
    const fullPath = path.join(setRoot, item.file);
    if (!fs.existsSync(fullPath)) {
      perSet.set(item.file, []);
      continue;
    }
    const content = fs.readFileSync(fullPath, "utf8");

    const names = extractSoundNamesFromSet(content);

    const unique = [...new Set(names)].sort();
    perSet.set(item.file, unique);

    for (const name of unique) {
      const entry = usage.get(name) ?? {
        name,
        categories: new Set(),
        sets: new Set(),
      };
      entry.categories.add(item.category);
      entry.sets.add(item.file);
      usage.set(name, entry);
    }
  }
}

function extractSoundNamesFromSet(content) {
  const activeContent = content
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith(";"))
    .join("\n");

  const names = [];
  let match = SOUND_REF_REGEX.exec(activeContent);

  while (match) {
    const base = basename(match[1]);
    if (base) {
      names.push(base.toLowerCase());
    }
    match = SOUND_REF_REGEX.exec(activeContent);
  }

  SOUND_REF_REGEX.lastIndex = 0;
  return [...new Set(names)].sort();
}

function buildInventory(root) {
  const files = [];
  walk(root.dir, root.dir, files);

  const byBase = new Map();
  for (const file of files) {
    const arr = byBase.get(file.baseLower) ?? [];
    arr.push(file);
    byBase.set(file.baseLower, arr);
  }

  return { ...root, files, byBase };
}

function walk(baseDir, dir, out) {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relToBase = toPosix(path.relative(baseDir, fullPath));
    const topFolder = relToBase.split("/")[0];

    if (IGNORED_TOP_FOLDERS.has(topFolder)) {
      continue;
    }

    if (entry.isDirectory()) {
      walk(baseDir, fullPath, out);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!AUDIO_EXT.has(ext)) {
      continue;
    }

    const rel = toPosix(path.relative(baseDir, fullPath));
    const parts = rel.split("/");
    const top = parts[0];

    out.push({
      abs: fullPath,
      rel,
      name: entry.name,
      baseLower: entry.name.toLowerCase(),
      category: CATEGORY_FROM_FOLDER[top] ?? null,
      top,
    });
  }
}

function analyzeInventory(inventory) {
  const wrong = [];
  const missing = [];
  const orphans = [];
  const moves = [];

  for (const file of inventory.files) {
    const u = usage.get(file.baseLower);
    const expected = expectedCategories(file.baseLower, inventory);

    if (!u) {
      wrong.push(makeWrong(file, "nao-referenciado"));
      orphans.push(file.rel);
      moves.push(planMove(inventory, file, "nao-referenciado"));
      continue;
    }

    if (expected.size === 0) {
      continue;
    }

    if (!file.category || !expected.has(file.category)) {
      wrong.push(makeWrong(file, "pasta-incorreta"));
      moves.push(planMove(inventory, file, "pasta-incorreta"));
    }
  }

  for (const [sound, u] of usage.entries()) {
    const expected = expectedCategories(sound, inventory);
    if (expected.size === 0) {
      continue;
    }

    for (const category of expected) {
      const found = (inventory.byBase.get(sound) ?? []).some(
        (f) => f.category === category,
      );
      if (!found) {
        missing.push({ sound, category, sets: [...u.sets].sort() });
      }
    }
  }

  return {
    key: inventory.key,
    wrong: dedupeWrong(wrong),
    missing,
    orphans: [...new Set(orphans)].sort(),
    moves: dedupeMoves(moves),
  };
}

function expectedCategories(sound, inventory) {
  const u = usage.get(sound);
  if (!u) {
    return new Set();
  }

  const categories = new Set(u.categories);

  const expected = new Set();
  if (categories.has("barraDeVida")) expected.add("barraDeVida");
  if (categories.has("bgm")) expected.add("bgm");
  if (categories.has("vivas")) expected.add("vivas");
  if (categories.has("classes")) expected.add("classes");
  if (categories.has("fx")) expected.add("fx");

  return expected;
}

function makeWrong(file, reason) {
  return {
    file: file.rel,
    reason,
    category: file.category,
  };
}

function dedupeWrong(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.file}|${item.reason}`;
    if (!seen.has(key)) {
      out.push(item);
      seen.add(key);
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

function planMove(inventory, file, reason) {
  const pendingRoot = path.join(inventory.dir, "uar_MigracaoPendencias");
  const categoryFolder = file.top || "sem_categoria";
  const targetDir = path.join(pendingRoot, categoryFolder);
  const targetAbs = uniqueTargetPath(targetDir, file.name);

  return {
    root: inventory.key,
    sourceAbs: file.abs,
    sourceRel: file.rel,
    targetAbs,
    targetRel: toPosix(path.relative(inventory.dir, targetAbs)),
    reason,
  };
}

function uniqueTargetPath(targetDir, fileName) {
  fs.mkdirSync(targetDir, { recursive: true });

  const ext = path.extname(fileName);
  const stem = path.basename(fileName, ext);

  let idx = 0;
  while (true) {
    const suffix = idx === 0 ? "" : `__${idx}`;
    const candidate = path.join(targetDir, `${stem}${suffix}${ext}`);
    if (!fs.existsSync(candidate)) {
      return candidate;
    }
    idx += 1;
  }
}

function dedupeMoves(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.root}|${item.sourceAbs}`;
    if (!seen.has(key)) {
      out.push(item);
      seen.add(key);
    }
  }
  return out.sort((a, b) => a.sourceRel.localeCompare(b.sourceRel));
}

function executeMoves(moves) {
  const logs = [];

  for (const move of moves) {
    if (!fs.existsSync(move.sourceAbs)) {
      logs.push(`SKIP;${move.root};${move.sourceRel};origem-inexistente`);
      continue;
    }

    fs.mkdirSync(path.dirname(move.targetAbs), { recursive: true });
    fs.renameSync(move.sourceAbs, move.targetAbs);
    logs.push(
      `MOVE;${move.root};${move.sourceRel};${move.targetRel};${move.reason}`,
    );
  }

  return logs;
}

function renderReport(analysis, moves) {
  const lines = [];

  lines.push("# Relatorio de Reconciliacao de Sons");
  lines.push("");
  lines.push(`Data: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Lista por arquivo .set");
  lines.push("");

  for (const item of SET_FILES) {
    const sounds = perSet.get(item.file) ?? [];
    lines.push(`### ${item.file} (${sounds.length} sons unicos)`);
    if (sounds.length === 0) {
      lines.push("- (sem sons)");
    } else {
      for (const sound of sounds) {
        lines.push(`- ${sound}`);
      }
    }
    lines.push("");
  }

  lines.push("## Diagnostico por arvore de sons");
  lines.push("");

  for (const tree of analysis) {
    lines.push(`### ${tree.key}`);
    lines.push(`- Arquivos em pasta incorreta/nao referenciados: ${tree.wrong.length}`);
    lines.push(`- Referencias ausentes (trigger sem arquivo): ${tree.missing.length}`);
    lines.push(`- Orfaos: ${tree.orphans.length}`);
    lines.push(`- Movimentos planejados: ${tree.moves.length}`);
    lines.push("");

    lines.push("#### Arquivos incorretos");
    if (tree.wrong.length === 0) {
      lines.push("- (nenhum)");
    } else {
      for (const item of tree.wrong) {
        lines.push(`- ${item.file} | motivo: ${item.reason}`);
      }
    }
    lines.push("");

    lines.push("#### Referencias ausentes");
    if (tree.missing.length === 0) {
      lines.push("- (nenhuma)");
    } else {
      for (const miss of tree.missing) {
        lines.push(
          `- ${miss.sound} | categoria esperada: ${miss.category} | origem: ${miss.sets.join(", ")}`,
        );
      }
    }
    lines.push("");
  }

  lines.push("## Movimentos planejados/realizados");
  lines.push("");
  if (moves.length === 0) {
    lines.push("- (nenhum)");
  } else {
    for (const move of moves) {
      lines.push(
        `- ${move.root}: ${move.sourceRel} -> ${move.targetRel} (${move.reason})`,
      );
    }
  }

  lines.push("");
  lines.push("## Regra aplicada para duplicados classes x fx");
  lines.push("");
  lines.push("- Classes prevalece por padrao.");
  lines.push("- Arquivo permanece em FX somente quando houver trigger em uarFX.set para o mesmo nome.");
  lines.push("- Arquivos fora das categorias esperadas foram movidos para uar_MigracaoPendencias.");

  return lines.join("\n");
}

function basename(value) {
  if (!value) return null;
  const clean = value.replace(/\\/g, "/");
  const base = clean.split("/").pop();
  return base || null;
}

function toPosix(value) {
  return value.replace(/\\/g, "/");
}
