import { describe, expect, test } from "vitest";
import {
  normalizeWildcardToRegex,
  normalizeTextForMatch,
  parseSetFile,
} from "../src/parser/setParser.js";

describe("setParser", () => {
  test("normaliza wildcard para regex case-insensitive", () => {
    const regex = normalizeWildcardToRegex("*olha para*pronuncia*'");
    expect(regex.flags).toContain("i");
    expect(regex.test("Ele olha para vc e pronuncia 'x'"));
  });

  test("faz match de texto com e sem acentos", () => {
    const regex = normalizeWildcardToRegex("voce esta sem municao");
    expect(regex.test(normalizeTextForMatch("você está sem munição"))).toBe(
      true,
    );
  });

  test("extrai trigger com comando de som", () => {
    const content = "#trigger {asd} {tFx beep.mp3 @volumefx}";
    const result = parseSetFile(content, "fx");
    expect(result.length).toBe(1);
    expect(result[0].soundPath).toBe("beep.mp3");
    expect(result[0].volumeRef).toBe("volumefx");
  });

  test("ignora linhas de trigger comentadas com ;", () => {
    const content = [
      ";#trigger {comentado} {tFx nao.mp3}",
      "#trigger {ativo} {tFx sim.mp3}",
    ].join("\n");

    const result = parseSetFile(content, "fx");
    expect(result.length).toBe(1);
    expect(result[0].pattern).toBe("ativo");
    expect(result[0].soundPath).toBe("sim.mp3");
  });
});
