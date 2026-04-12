import { execSync } from "node:child_process";

const changedDocs = execSync("git status --porcelain -- docs", {
  encoding: "utf8",
}).trim();

if (!changedDocs) {
  console.log("Artefatos em docs/ estao atualizados.");
  process.exit(0);
}

console.error("Falha: existem arquivos em docs/ nao commitados apos o build.");
console.error("Rode npm run build e inclua as mudancas em docs/ no commit.");
console.error("Arquivos detectados:");
console.error(changedDocs);
process.exit(1);
