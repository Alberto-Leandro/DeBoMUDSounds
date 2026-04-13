import { beforeEach, describe, expect, test, vi } from "vitest";
import { AudioEngine } from "../src/runtime/audioEngine.js";

class FakeAudio {
  static instances = [];

  constructor(src = "") {
    this.src = src;
    this.currentTime = 0;
    this.paused = true;
    this.loop = false;
    this.preload = "";
    this.volume = 1;
    this.playbackRate = 1;
    this.playCalls = 0;
    this.crossOrigin = null;
    FakeAudio.instances.push(this);
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
    FakeAudio.instances = [];
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

  test("BGM tem crossOrigin anonymous", () => {
    const engine = new AudioEngine({ baseUrl: "https://x" });
    expect(engine.players.bgm.crossOrigin).toBe("anonymous");
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

  test("aplica modifiers de volume e frequencia em efeitos", async () => {
    const engine = new AudioEngine({ baseUrl: "https://x" });
    await engine.playEffect(
      "barraDeVida",
      "Sounds/uar_BarraDeVida/vidaAdv_uar.mp3",
      {
        volume: 50,
        frequency: 44000,
      },
    );

    const audio = FakeAudio.instances.at(-1);
    expect(audio.volume).toBeCloseTo(0.4, 5);
    expect(audio.playbackRate).toBeCloseTo(44000 / 22050, 2);
  });

  test("normaliza pan no estado da engine mesmo sem WebAudio", async () => {
    const engine = new AudioEngine({ baseUrl: "https://x" });
    await engine.playEffect(
      "barraDeVida",
      "Sounds/uar_BarraDeVida/vidaAdv_uar.mp3",
      {
        pan: -5000,
      },
    );

    const audio = FakeAudio.instances.at(-1);
    expect(audio.volume).toBeCloseTo(0.8, 5);
  });

  test("efeito tem crossOrigin anonymous", async () => {
    const engine = new AudioEngine({ baseUrl: "https://x" });
    await engine.playEffect(
      "fx",
      "Sounds/uar_Fx/mensagem-dizer.mp3",
    );

    const audio = FakeAudio.instances.at(-1);
    expect(audio.crossOrigin).toBe("anonymous");
  });
});
