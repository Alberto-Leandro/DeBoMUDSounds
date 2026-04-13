import path from "node:path";

const PLAY_CMD_REGEX = /(?:\b(tFx|tCl|tVi)\b|(#playloop|#play))\s+([^;\s}]+)/i;
const VAR_ASSIGN_REGEX = /#var\s+(\w+)\s+([^;\s}]+)/gi;
const PC_CMD_REGEX = /#pc\s+([^\s]+)\s+(Pan|Frequency|Volume)\s+([^;{}]+)/gi;
const PLAY_INLINE_VOLUME_REGEX = /^\s*(-?\d+(?:\.\d+)?)/;
const CONDITIONAL_FLAG_REGEX = /#if\s*\{\s*@([\w]+)\s*\}\s*\{/i;
const FLAG_WINDOW_REGEX =
  /#var\s+(\w+)\s+1\s*;[\s\S]*?#alarm\s+(\d+(?:\.\d+)?)\s*\{\s*#var\s+\1\s+0\s*\}/i;
const FLAG_WINDOW_OVERRIDE_MS = {
  equipDanificado: 1000,
};

export function parseSetFile(content, category) {
  const activeContent = stripCommentedLines(content);
  const triggers = [];
  const triggerBlocks = parseTriggerBlocks(activeContent);
  const stateWindowFlags = new Set();

  for (const block of triggerBlocks) {
    const action = compactWhitespace(block.action);
    const stateWindow = parseStateWindow(action);
    if (stateWindow?.flag) {
      stateWindowFlags.add(stateWindow.flag);
    }
  }

  for (const block of triggerBlocks) {
    const pattern = compactWhitespace(block.pattern);
    const action = compactWhitespace(block.action);
    const vars = parseAssignedVars(action);
    const cmd = parseSoundCommand(action, vars);
    const playbackModifiers = parsePlaybackModifiers(action, vars, cmd);
    const conditionRef = parseConditionRef(action, stateWindowFlags);
    const stateWindow = parseStateWindow(action);

    if (cmd) {
      triggers.push({
        category,
        pattern,
        action,
        soundCommand: cmd.command,
        soundPath: sanitizeSoundPath(cmd.path),
        volumeRef: cmd.volumeRef,
        playbackModifiers,
        conditionRef,
        stateWindow,
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
  const activeContent = stripCommentedLines(content);
  const triggerBlocks = parseTriggerBlocks(activeContent);
  const bgmDefaults = parseBgmDefaults(activeContent);
  const triggers = triggerBlocks
    .map((block) => {
      const action = compactWhitespace(block.action);
      const vars = parseAssignedVars(action);
      const loopVar = readAssignedVar(vars, "mapaLoop", "mapaloop");

      if (!loopVar) {
        return null;
      }

      const blockListRaw = readAssignedVar(
        vars,
        "listaImpedir",
        "listaimpedir",
        "listaImpedirAnterior",
        "listaimpediranterior",
      );

      return {
        category: "bgm",
        pattern: compactWhitespace(block.pattern),
        track: normalizeBgmTrack(loopVar, null),
        blockList: parseBlockList(blockListRaw),
        playbackModifiers: bgmDefaults,
        action,
      };
    })
    .filter(Boolean);

  return triggers
    .map((entry) => {
      return {
        category: "bgm",
        pattern: entry.pattern,
        track: entry.track,
        blockList: entry.blockList,
        playbackModifiers: entry.playbackModifiers,
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
  const volumeMatch = remainder.match(/^\s*(?:\S+\s+)?@([\w]+)/);
  const inlineVolumeMatch = remainder.match(PLAY_INLINE_VOLUME_REGEX);
  const inlineVolume = inlineVolumeMatch
    ? Number.parseFloat(inlineVolumeMatch[1])
    : null;

  return {
    command,
    path: resolveSoundPath(rawPath, assignedVars),
    volumeRef: volumeMatch ? volumeMatch[1] : null,
    inlineVolume: Number.isFinite(inlineVolume) ? inlineVolume : null,
  };
}

function parsePlaybackModifiers(action, assignedVars, cmd) {
  const modifiers = {};

  if (cmd?.inlineVolume != null) {
    modifiers.volume = cmd.inlineVolume;
  }

  let match = PC_CMD_REGEX.exec(action);
  while (match) {
    const prop = match[2].toLowerCase();
    const rawValue = match[3].trim();
    const resolved = resolveNumericValue(rawValue, assignedVars);

    if (resolved != null) {
      if (prop === "pan") {
        modifiers.pan = resolved;
      }
      if (prop === "frequency") {
        modifiers.frequency = resolved;
      }
      if (prop === "volume") {
        modifiers.volume = resolved;
      }
    }

    match = PC_CMD_REGEX.exec(action);
  }
  PC_CMD_REGEX.lastIndex = 0;

  return Object.keys(modifiers).length ? modifiers : null;
}

function parseConditionRef(action, stateWindowFlags = null) {
  const match = action.match(CONDITIONAL_FLAG_REGEX);
  if (!match) {
    return null;
  }

  const flag = match[1];
  if (stateWindowFlags && !stateWindowFlags.has(flag)) {
    return null;
  }

  return flag;
}

function parseStateWindow(action) {
  const match = action.match(FLAG_WINDOW_REGEX);
  if (!match) {
    return null;
  }

  const flag = match[1];
  const seconds = Number.parseFloat(match[2]);
  if (!Number.isFinite(seconds)) {
    return null;
  }

  const parsedMs = Math.max(0, Math.round(seconds * 1000));
  const ttlMs = FLAG_WINDOW_OVERRIDE_MS[flag] ?? parsedMs;

  return {
    flag,
    activeValue: 1,
    inactiveValue: 0,
    ttlMs,
  };
}

function resolveNumericValue(rawValue, assignedVars) {
  const clean = rawValue.replace(/[{}]/g, "").trim();

  if (clean.startsWith("@")) {
    const varName = clean.slice(1);
    const assigned = readAssignedVar(assignedVars, varName);
    if (assigned == null) {
      return null;
    }
    return resolveNumericValue(String(assigned), assignedVars);
  }

  const number = Number.parseFloat(clean);
  return Number.isFinite(number) ? number : null;
}

function readAssignedVar(vars, ...keys) {
  const lower = Object.fromEntries(
    Object.entries(vars).map(([k, v]) => [k.toLowerCase(), v]),
  );

  for (const key of keys) {
    const value = lower[key.toLowerCase()];
    if (value != null) {
      return value;
    }
  }

  return null;
}

function parseBgmDefaults(content) {
  const defaults = {};
  const panMatch = content.match(
    /#pc\s+@loopHandle\s+Pan\s+(-?\d+(?:\.\d+)?)/i,
  );
  const freqMatch = content.match(
    /#pc\s+@loopHandle\s+Frequency\s+(-?\d+(?:\.\d+)?)/i,
  );

  if (panMatch) {
    defaults.pan = Number.parseFloat(panMatch[1]);
  }
  if (freqMatch) {
    defaults.frequency = Number.parseFloat(freqMatch[1]);
  }

  return Object.keys(defaults).length ? defaults : null;
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
