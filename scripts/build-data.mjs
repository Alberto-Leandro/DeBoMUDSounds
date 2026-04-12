import fs from "node:fs";
import path from "node:path";
import { buildTriggerData } from "../src/parser/extract.js";

const repoRoot = process.cwd();
const outRoot = path.join(repoRoot, "docs", "data");

fs.mkdirSync(outRoot, { recursive: true });

const snapshotBefore = snapshotSetFiles(repoRoot);
const data = buildTriggerData(repoRoot);

writeJson(path.join(outRoot, "manifest.json"), data.manifest);
writeJson(path.join(outRoot, "bgm.json"), data.bgm);
writeJson(path.join(outRoot, "fx.json"), data.fx);
writeJson(path.join(outRoot, "classes.json"), data.classes);
writeJson(path.join(outRoot, "vivas.json"), data.vivas);
writeJson(path.join(outRoot, "barraDeVida.json"), data.barraDeVida);

const legacyBattlePath = path.join(outRoot, "battle.json");
if (fs.existsSync(legacyBattlePath)) {
  fs.rmSync(legacyBattlePath);
}

const snapshotAfter = snapshotSetFiles(repoRoot);

if (!sameSnapshot(snapshotBefore, snapshotAfter)) {
  throw new Error(
    "Falha de seguranca: os arquivos .set foram alterados durante o build.",
  );
}

console.log("Dados de triggers gerados com sucesso em docs/data");

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function snapshotSetFiles(root) {
  const dir = path.join(root, "VipMUDTriggers");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".set"))
    .sort();
  return files.map((name) => {
    const abs = path.join(dir, name);
    const stat = fs.statSync(abs);
    return { name, size: stat.size, mtimeMs: stat.mtimeMs };
  });
}

function sameSnapshot(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
