import { describe, expect, test, vi } from "vitest";
import { TriggerRuntime } from "../src/runtime/triggerRuntime.js";
import { createSamples, getAllActiveTriggers } from "./triggerFixtures.js";

const allCases = getAllActiveTriggers();

function createRuntimeForSingleTrigger(item, engine) {
  return new TriggerRuntime({
    engine,
    data: {
      bgm: item.category === "bgm" ? [item.trigger] : [],
      fx: item.category === "fx" ? [item.trigger] : [],
      classes: item.category === "classes" ? [item.trigger] : [],
      vivas: item.category === "vivas" ? [item.trigger] : [],
      barraDeVida: item.category === "barraDeVida" ? [item.trigger] : [],
    },
  });
}

describe("trigger runtime activation", () => {
  test.each(allCases)("fires expected command for trigger: $id", (item) => {
    const engine = {
      playBgm: vi.fn(),
      playEffect: vi.fn(),
    };

    const runtime = createRuntimeForSingleTrigger(item, engine);
    const sample =
      createSamples(item.trigger.pattern).positive[0] ?? item.trigger.pattern;

    if (item.trigger.conditionRef) {
      runtime.stateFlags.set(item.trigger.conditionRef, 1);
    }

    runtime.processCategory(item.category, sample);

    if (item.category === "bgm") {
      expect(engine.playBgm).toHaveBeenCalledTimes(1);
      expect(engine.playBgm).toHaveBeenCalledWith(
        item.trigger.track,
        item.trigger.blockList ?? [],
        item.trigger.playbackModifiers ?? null,
      );
      expect(engine.playEffect).not.toHaveBeenCalled();
      return;
    }

    expect(engine.playEffect).toHaveBeenCalledTimes(1);
    expect(engine.playEffect).toHaveBeenCalledWith(
      item.category,
      item.trigger.soundPath,
      item.trigger.playbackModifiers ?? null,
    );
    expect(engine.playBgm).not.toHaveBeenCalled();
  });

  test("deduplicates repeated firing for same trigger", () => {
    const nonBgm = allCases.find((item) => item.category !== "bgm");
    expect(nonBgm).toBeTruthy();

    const engine = {
      playBgm: vi.fn(),
      playEffect: vi.fn(),
    };

    const runtime = createRuntimeForSingleTrigger(nonBgm, engine);
    const sample = createSamples(nonBgm.trigger.pattern).positive[0];

    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1100);

    runtime.processCategory(nonBgm.category, sample);
    runtime.processCategory(nonBgm.category, sample);

    expect(engine.playEffect).toHaveBeenCalledTimes(1);

    nowSpy.mockRestore();
  });

  test("só toca desequipar dentro da janela temporal de dano", () => {
    vi.useFakeTimers();

    const engine = {
      playBgm: vi.fn(),
      playEffect: vi.fn(),
    };

    const runtime = new TriggerRuntime({
      engine,
      data: {
        bgm: [],
        fx: [],
        vivas: [],
        barraDeVida: [],
        classes: [
          {
            category: "classes",
            pattern: "*ua arma fica mais fr*gil!",
            matcher: { source: ".*ua arma fica mais fr.*gil!", flags: "i" },
            soundPath: "Sounds/uar_Classes/danificado_uar.mp3",
            playbackModifiers: null,
            conditionRef: null,
            stateWindow: {
              flag: "equipDanificado",
              activeValue: 1,
              inactiveValue: 0,
              ttlMs: 1000,
            },
          },
          {
            category: "classes",
            pattern: "*oc* p*ra de usar *.",
            matcher: { source: ".*oc.* p.*ra de usar .*\\.", flags: "i" },
            soundPath: "Sounds/uar_Classes/repairFail_uar.mp3",
            playbackModifiers: null,
            conditionRef: "equipDanificado",
            stateWindow: null,
          },
        ],
      },
    });

    runtime.processCategory("classes", "Sua arma fica mais frágil!");
    runtime.processCategory("classes", "Você para de usar espada.");
    expect(engine.playEffect).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1100);
    runtime.processCategory("classes", "Você para de usar espada.");
    expect(engine.playEffect).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
