import fs from "node:fs";
import path from "node:path";
import {
  normalizeWildcardToRegex,
  parseBgmRules,
  parseSetFile,
} from "./setParser.js";

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function makeMatcher(pattern) {
  const regex = normalizeWildcardToRegex(pattern);
  return { source: regex.source, flags: regex.flags };
}

function toRuntimeTrigger(item) {
  return {
    category: item.category,
    pattern: item.pattern,
    matcher: makeMatcher(item.pattern),
    soundPath: normalizeOutputPath(item.soundPath),
    volumeRef: item.volumeRef,
  };
}

export function buildTriggerData(repoRoot) {
  const setRoot = path.join(repoRoot, "VipMUDTriggers");

  const files = {
    bgm: path.join(setRoot, "uarBGM.set"),
    fx: path.join(setRoot, "uarFX.set"),
    classes: path.join(setRoot, "uarClasses.set"),
    barraDeVida: path.join(setRoot, "uarBarrasDeVida.set"),
    vivas: path.join(setRoot, "uarViva.set"),
  };

  const bgm = parseBgmRules(readFile(files.bgm)).map((item) => ({
    category: "bgm",
    pattern: item.pattern,
    matcher: makeMatcher(item.pattern),
    track: normalizeOutputPath(item.track),
    blockList: item.blockList.map((name) =>
      path.posix.join("Sounds/uar_Bgm", name),
    ),
    action: item.action,
  }));

  const fx = parseSetFile(readFile(files.fx), "fx").map(toRuntimeTrigger);
  const classes = parseSetFile(readFile(files.classes), "classes").map(
    toRuntimeTrigger,
  );
  const vivas = parseSetFile(readFile(files.vivas), "vivas").map(
    toRuntimeTrigger,
  );

  const barraDeVida = parseSetFile(
    readFile(files.barraDeVida),
    "barraDeVida",
  ).map(toRuntimeTrigger);

  const manifest = {
    generatedAt: "deterministic",
    categories: {
      bgm: "data/bgm.json",
      fx: "data/fx.json",
      classes: "data/classes.json",
      vivas: "data/vivas.json",
      barraDeVida: "data/barraDeVida.json",
    },
  };

  return { manifest, bgm, fx, classes, vivas, barraDeVida };
}

function normalizeOutputPath(soundPath) {
  if (!soundPath) {
    return null;
  }

  const clean = soundPath.replace(/\\/g, "/").replace(/^\/+/, "");

  if (clean.startsWith("Sounds/")) {
    return clean;
  }

  if (
    clean.startsWith("uar_Bgm/") ||
    clean.startsWith("uar_BarraDeVida/") ||
    clean.startsWith("uar_Classes/") ||
    clean.startsWith("uar_Fx/") ||
    clean.startsWith("uar_Vivas/")
  ) {
    return `Sounds/${clean}`;
  }

  if (/\.mp3$/i.test(clean) || /\.ogg$/i.test(clean)) {
    return `Sounds/${clean}`;
  }

  return clean;
}
