import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const repoRoot = process.cwd();
const docsRoot = path.join(repoRoot, "docs");
const soundsSrc = path.join(repoRoot, "Sounds");
const soundsDest = path.join(docsRoot, "Sounds");

await build({
  entryPoints: [path.join(repoRoot, "src", "runtime", "loader.js")],
  bundle: true,
  format: "iife",
  target: "es2020",
  outfile: path.join(docsRoot, "assets", "loader.js"),
  sourcemap: false,
  minify: false,
});

copyDirectory(soundsSrc, soundsDest);
writeBookmarklet(path.join(docsRoot, "bookmarklet.txt"));
writeIndex(path.join(docsRoot, "index.html"));

console.log(
  "Runtime gerado em docs/assets e sons sincronizados em docs/Sounds",
);

function copyDirectory(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function writeBookmarklet(filePath) {
  const line =
    "javascript:(function(){if(window.__debomudLoader)return;window.__debomudLoader=1;var s=document.createElement('script');s.src='https://Alberto-Leandro.github.io/DeBoMUDSounds/assets/loader.js?'+Date.now();s.async=true;document.head.appendChild(s);}());";
  fs.writeFileSync(filePath, `${line}\n`, "utf8");
}

function writeIndex(filePath) {
  const html = [
    "<!doctype html>",
    '<html lang="pt-BR">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    "  <title>DeBoMUD Sounds</title>",
    "</head>",
    "<body>",
    "  <h1>DeBoMUD Sounds</h1>",
    "  <p>Projeto de audio browser para triggers do VIPMUD.</p>",
    "  <p>Use o arquivo bookmarklet.txt para criar o bookmarklet de carregamento.</p>",
    "</body>",
    "</html>",
  ].join("\n");

  fs.writeFileSync(filePath, html, "utf8");
}
