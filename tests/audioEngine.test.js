import { beforeEach, describe, expect, test, vi } from "vitest";
import { AudioEngine } from "../src/runtime/audioEngine.js";

class FakeAudio {
  constructor(src = "") {
    this.src = src;
    this.currentTime = 0;
    this.paused = true;
    this.loop = false;
    this.preload = "";
    this.volume = 1;
    this.playCalls = 0;
  }

  async play() {
    this.paused = false;
    this.playCalls += 1;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

describe("audioEngine", () => {
  beforeEach(() => {
    global.Audio = FakeAudio;
    global.window = { dispatchEvent: vi.fn() };
    global.CustomEvent = class {
      constructor(name, payload) {
        this.name = name;
        this.payload = payload;
      }
    };
  });

  test("BGM entra em loop", () => {
    const engine = new AudioEngine({ baseUrl: "https://x" });
    expect(engine.players.bgm.loop).toBe(true);
  });

  test("nao reinicia mesma faixa", async () => {
    const engine = new AudioEngine({ baseUrl: "https://x" });
    await engine.playBgm("Sounds/uar_Bgm/midgaard_bgm.mp3");
    const playsAfterFirst = engine.players.bgm.playCalls;

    await engine.playBgm("Sounds/uar_Bgm/midgaard_bgm.mp3");
    expect(engine.players.bgm.playCalls).toBe(playsAfterFirst);
  });

  test("respeita bloqueio por blockList", async () => {
    const engine = new AudioEngine({ baseUrl: "https://x" });
    await engine.playBgm("Sounds/uar_Bgm/floresta_bgm.mp3");

    await engine.playBgm("Sounds/uar_Bgm/nova_bgm.mp3", ["floresta_bgm.mp3"]);
    expect(engine.currentBgmTrack).toBe("Sounds/uar_Bgm/floresta_bgm.mp3");
  });
});
