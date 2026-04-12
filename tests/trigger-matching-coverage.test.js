import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  createSamples,
  getAllActiveTriggers,
  matchesTrigger,
} from "./triggerFixtures.js";

const allCases = getAllActiveTriggers();

describe("trigger matching coverage", () => {
  test("extracts active triggers from all runtime categories", () => {
    expect(allCases.length).toBeGreaterThan(0);
  });

  test.each(allCases)("matcher compiles and matches expected cases: $id", (item) => {
    const { trigger } = item;
    const compiled = new RegExp(trigger.matcher.source, trigger.matcher.flags);
    expect(compiled).toBeInstanceOf(RegExp);

    const samples = createSamples(trigger.pattern);

    for (const positive of samples.positive) {
      expect(matchesTrigger(trigger, positive)).toBe(
        true,
        `${item.id} should match positive sample: ${positive}`,
      );
    }

    if (samples.negative) {
      expect(matchesTrigger(trigger, samples.negative)).toBe(
        false,
        `${item.id} should not match negative sample: ${samples.negative}`,
      );
    }

    if (samples.hasStar) {
      const starPhrase = trigger.pattern.replace(
        /\*/g,
        "frase com a\u00e7\u00e3o e palavras",
      );
      expect(matchesTrigger(trigger, starPhrase)).toBe(true);
    }

    if (samples.hasQuestion) {
      const oneChar = trigger.pattern.replace(/\?/g, "x").replace(/\*/g, "n");
      expect(matchesTrigger(trigger, oneChar)).toBe(true);
    }
  });

  test("all triggers keep required fields by category", () => {
    for (const item of allCases) {
      const { category, trigger } = item;
      expect(trigger.pattern).toBeTruthy();
      expect(trigger.matcher?.source).toBeTruthy();
      expect(trigger.matcher?.flags).toContain("i");

      if (category === "bgm") {
        expect(trigger.track).toBeTruthy();
      }

      // Some triggers are signal-only and intentionally have no audio file.
      // They must still carry a volume reference for runtime handling.
      if (!trigger.track && !trigger.soundPath) {
        expect(trigger.volumeRef).toBeTruthy();
      }
    }
  });

  test("audio targets resolve to expected files", () => {
    for (const item of allCases) {
      const { category, trigger } = item;
      const target = category === "bgm" ? trigger.track : trigger.soundPath;
      if (!target) {
        continue;
      }

      const absolute = path.join(process.cwd(), target);
      expect(target.startsWith("Sounds/")).toBe(true);
      expect(/\.(mp3|ogg)$/i.test(target)).toBe(true);
      expect(path.isAbsolute(target)).toBe(false);
      expect(absolute).toContain(path.join(process.cwd(), "Sounds"));

      // Existence is not asserted because source assets can be staged/mirrored
      // outside the repository while triggers still need to be validated.
    }
  });
});
