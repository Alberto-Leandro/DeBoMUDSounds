import path from "node:path";

const TRIGGER_REGEX = /#trigger\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/gi;
const PLAY_CMD_REGEX = /\b(tFx|tCl|tVi|#playloop|#play)\b\s+([^;\s}]+)/i;
const VAR_ASSIGN_REGEX = /#var\s+(\w+)\s+([^;\s}]+)/gi;

export function parseSetFile(content, category) {
  const activeContent = stripCommentedLines(content);
  const triggers = [];
  let match = TRIGGER_REGEX.exec(activeContent);

  while (match) {
    const pattern = compactWhitespace(match[1]);
    const action = compactWhitespace(match[2]);
    const cmd = parseSoundCommand(action);
    const vars = parseAssignedVars(action);

    if (cmd) {
      triggers.push({
        category,
        pattern,
        action,
        soundCommand: cmd.command,
        soundPath: sanitizeSoundPath(cmd.path),
        volumeRef: cmd.volumeRef,
        assignedVars: vars,
      });
    }

    match = TRIGGER_REGEX.exec(activeContent);
  }

  return triggers;
}

function stripCommentedLines(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith(";"))
    .join("\n");
}

export function parseBgmRules(content) {
  const triggers = parseSetFile(content, "bgm");

  return triggers
    .map((entry) => {
      const loopVar = entry.assignedVars.mapaLoop ?? null;
      const blockListRaw =
        entry.assignedVars.listaImpedir ??
        entry.assignedVars.listaImpedir ??
        null;

      return {
        category: "bgm",
        pattern: entry.pattern,
        track: normalizeBgmTrack(loopVar, entry.soundPath),
        blockList: parseBlockList(blockListRaw),
        action: entry.action,
      };
    })
    .filter((entry) => Boolean(entry.track));
}

export function normalizeWildcardToRegex(pattern) {
  const escaped = normalizeTextForMatch(pattern)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\*/g, ".*")
    .replace(/\\\?/g, ".");

  return new RegExp(escaped, "i");
}

export function normalizeTextForMatch(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function compactWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseSoundCommand(action) {
  const cmdMatch = PLAY_CMD_REGEX.exec(action);
  if (!cmdMatch) {
    return null;
  }

  const volumeMatch = action.match(/@([\w]+)/);

  return {
    command: cmdMatch[1],
    path: cmdMatch[2],
    volumeRef: volumeMatch ? volumeMatch[1] : null,
  };
}

function parseAssignedVars(action) {
  const vars = {};
  let match = VAR_ASSIGN_REGEX.exec(action);

  while (match) {
    vars[match[1]] = stripBraces(match[2]);
    match = VAR_ASSIGN_REGEX.exec(action);
  }

  VAR_ASSIGN_REGEX.lastIndex = 0;
  return vars;
}

function stripBraces(value) {
  return value.replace(/^\{/, "").replace(/\}$/, "").trim();
}

function sanitizeSoundPath(value) {
  if (!value) {
    return null;
  }

  const clean = value
    .replace(/^[@]/, "")
    .replace(/^["']|["']$/g, "")
    .trim();

  if (/\.mp3$/i.test(clean) || /\.ogg$/i.test(clean)) {
    return clean;
  }

  return null;
}

function normalizeBgmTrack(loopVar, fallbackSoundPath) {
  if (loopVar && /\.mp3$/i.test(loopVar)) {
    return path.posix.join("Sounds/uar_Bgm", loopVar);
  }

  if (fallbackSoundPath && /\.mp3$/i.test(fallbackSoundPath)) {
    return fallbackSoundPath;
  }

  return null;
}

function parseBlockList(blockListRaw) {
  if (!blockListRaw || blockListRaw.toLowerCase() === "null") {
    return [];
  }

  return blockListRaw
    .split("|")
    .map((item) => item.replace(/[{}]/g, "").trim())
    .filter(Boolean);
}
