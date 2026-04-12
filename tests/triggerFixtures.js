import { buildTriggerData } from "../src/parser/extract.js";
import { normalizeTextForMatch } from "../src/parser/setParser.js";

const STAR_VARIANTS = ["x", "palavra", "acao", "frase simples"];
const STAR_ACCENTED_VARIANTS = [
  "x",
  "palavra",
  "a\u00e7\u00e3o",
  "frase com acento",
];
const QUESTION_VARIANTS = ["z", "a", "b", "c"];
const QUESTION_ACCENTED_VARIANTS = ["z", "a", "\u00e1", "c"];

export function getAllActiveTriggers(repoRoot = process.cwd()) {
  const data = buildTriggerData(repoRoot);
  const categories = ["bgm", "fx", "classes", "vivas", "barraDeVida"];
  const cases = [];

  for (const category of categories) {
    for (const [index, trigger] of (data[category] ?? []).entries()) {
      cases.push({
        id: `${category}:${index + 1}`,
        category,
        index,
        trigger,
      });
    }
  }

  return cases;
}

export function createSamples(pattern) {
  const hasStar = pattern.includes("*");
  const hasQuestion = pattern.includes("?");

  const positiveSamples = [
    renderPattern(pattern, STAR_VARIANTS[0], QUESTION_VARIANTS[0]),
    renderPattern(pattern, STAR_VARIANTS[1], QUESTION_VARIANTS[1]),
    renderPattern(
      pattern,
      STAR_ACCENTED_VARIANTS[2],
      QUESTION_ACCENTED_VARIANTS[2],
    ),
    renderPattern(
      pattern,
      STAR_ACCENTED_VARIANTS[3],
      QUESTION_ACCENTED_VARIANTS[3],
    ),
  ];

  if (!hasStar && !hasQuestion) {
    positiveSamples.push(accentifyLiteral(pattern));
  }

  const uniquePositive = uniqueValues(positiveSamples);
  const basePositive = uniquePositive[0] ?? pattern;

  return {
    positive: uniquePositive,
    negative: createNegativeSample(pattern),
    hasStar,
    hasQuestion,
  };
}

export function matchesTrigger(trigger, text) {
  const regex = new RegExp(trigger.matcher.source, trigger.matcher.flags);
  return regex.test(normalizeTextForMatch(text));
}

function renderPattern(pattern, starValue, questionValue) {
  let result = "";
  for (const char of pattern) {
    if (char === "*") {
      result += starValue;
    } else if (char === "?") {
      result += questionValue;
    } else {
      result += char;
    }
  }
  return result;
}

function accentifyLiteral(value) {
  const accentMap = {
    a: "\u00e1",
    e: "\u00e9",
    i: "\u00ed",
    o: "\u00f3",
    u: "\u00fa",
    A: "\u00c1",
    E: "\u00c9",
    I: "\u00cd",
    O: "\u00d3",
    U: "\u00da",
  };

  let changed = false;
  const chars = [...value].map((char) => {
    if (!changed && accentMap[char]) {
      changed = true;
      return accentMap[char];
    }
    return char;
  });

  return chars.join("");
}

function createNegativeSample(pattern) {
  const chars = [...pattern];
  const targetIndex = chars.findIndex(
    (char) => char !== "*" && char !== "?" && /[A-Za-z0-9]/.test(char),
  );

  if (targetIndex === -1) {
    return null;
  }

  const replacement = chars[targetIndex].toLowerCase() === "x" ? "q" : "x";
  chars[targetIndex] = replacement;

  const changedPattern = chars.join("");
  return renderPattern(changedPattern, STAR_VARIANTS[0], QUESTION_VARIANTS[0]);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}
