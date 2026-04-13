import path from "node:path";

const PLAY_CMD_REGEX = /(?:\b(tFx|tCl|tVi)\b|(#playloop|#play))\s+([^;\s}]+)/i;
const VAR_ASSIGN_REGEX = /#var\s+(\w+)\s+([^;\s}]+)/gi;

export function parseSetFile(content, category) {
  const activeContent = stripCommentedLines(content);
  const triggers = [];
  const triggerBlocks = parseTriggerBlocks(activeContent);

  for (const block of triggerBlocks) {
    const pattern = compactWhitespace(block.pattern);
    const action = compactWhitespace(block.action);
    const vars = parseAssignedVars(action);
    const cmd = parseSoundCommand(action, vars);

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

function parseSoundCommand(action, assignedVars) {
  const cmdMatch = PLAY_CMD_REGEX.exec(action);
  if (!cmdMatch) {
    return null;
  }

  const command = cmdMatch[1] ?? cmdMatch[2];
  const rawPath = cmdMatch[3];
  const remainder = action.slice(cmdMatch.index + cmdMatch[0].length);
  const volumeMatch = remainder.match(/@([\w]+)/);

  return {
    command,
    path: resolveSoundPath(rawPath, assignedVars),
    volumeRef: volumeMatch ? volumeMatch[1] : null,
  };
}

function resolveSoundPath(rawPath, assignedVars) {
  if (!rawPath) {
    return null;
  }

  if (rawPath.startsWith("@")) {
    const varName = rawPath.slice(1);
    const assignedValue = assignedVars[varName];
    if (!assignedValue) {
      return null;
    }

    const inlinePath = extractSoundPathFromExpression(assignedValue);
    return sanitizeSoundPath(inlinePath);
  }

  return sanitizeSoundPath(rawPath);
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

function extractSoundPathFromExpression(value) {
  const match = value.match(/([A-Za-z0-9_./-]+\.(?:mp3|ogg))/i);
  return match ? match[1] : null;
}

function parseTriggerBlocks(content) {
  const blocks = [];
  let cursor = 0;

  while (cursor < content.length) {
    const triggerStart = content.indexOf("#trigger", cursor);
    if (triggerStart === -1) {
      break;
    }

    let next = skipWhitespace(content, triggerStart + "#trigger".length);
    const patternBlock = readBracedBlock(content, next);

    if (!patternBlock) {
      cursor = triggerStart + "#trigger".length;
      continue;
    }

    next = skipWhitespace(content, patternBlock.end + 1);
    const actionBlock = readBracedBlock(content, next);

    if (!actionBlock) {
      cursor = patternBlock.end + 1;
      continue;
    }

    blocks.push({
      pattern: patternBlock.value,
      action: actionBlock.value,
    });

    cursor = actionBlock.end + 1;
  }

  return blocks;
}

function skipWhitespace(content, start) {
  let index = start;
  while (index < content.length && /\s/.test(content[index])) {
    index += 1;
  }
  return index;
}

function readBracedBlock(content, start) {
  if (start >= content.length || content[start] !== "{") {
    return null;
  }

  let depth = 0;
  for (let index = start; index < content.length; index += 1) {
    const char = content[index];

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return {
          value: content.slice(start + 1, index),
          start,
          end: index,
        };
      }
    }
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
