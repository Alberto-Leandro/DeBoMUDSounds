import { describe, expect, test } from "vitest";
import {
  normalizeWildcardToRegex,
  normalizeTextForMatch,
  parseBgmRules,
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

  test("extrai regras de bgm por mapaLoop sem #play explicito", () => {
    const content = [
      "#trigger {Sala X} {#var mapaLoop floresta_bgm.mp3; #var listaImpedir {a_bgm.mp3|b_bgm.mp3}; controleLoop}",
    ].join("\n");

    const result = parseBgmRules(content);
    expect(result.length).toBe(1);
    expect(result[0].track).toBe("Sounds/uar_Bgm/floresta_bgm.mp3");
    expect(result[0].blockList).toEqual(["a_bgm.mp3", "b_bgm.mp3"]);
  });

  test("extrai modifiers de #PC e volume inline de #play", () => {
    const content =
      "#trigger {barra} {#play uar_BarraDeVida/vidaAdv_uar.mp3 60; #var h %PlayHandle; #PC @h Pan -5000; #PC @h Frequency 44000}";

    const result = parseSetFile(content, "barraDeVida");
    expect(result.length).toBe(1);
    expect(result[0].playbackModifiers).toEqual({
      volume: 60,
      pan: -5000,
      frequency: 44000,
    });
  });

  test("preserva condicao e janela temporal para desequipar apos dano", () => {
    const content = [
      "#trigger {*ua arma fica mais fr*gil!} {tCl danificado_uar.mp3; #var equipDanificado 1; #alarm 3 {#var equipDanificado 0}}",
      "#trigger {*oc* p*ra de usar *.} {#if {@equipDanificado} {tCl repairFail_uar.mp3} {}}",
    ].join("\n");

    const result = parseSetFile(content, "classes");
    const damage = result.find((t) => t.pattern.includes("fr*gil"));
    const unequip = result.find((t) => t.pattern.includes("p*ra de usar"));

    expect(damage.stateWindow).toEqual({
      flag: "equipDanificado",
      activeValue: 1,
      inactiveValue: 0,
      ttlMs: 1000,
    });
    expect(unequip.conditionRef).toBe("equipDanificado");
  });
});
