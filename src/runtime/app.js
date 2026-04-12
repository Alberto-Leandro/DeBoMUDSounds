import { AudioEngine } from "./audioEngine.js";
import { TriggerRuntime } from "./triggerRuntime.js";
import { mountPanel } from "../panel/panel.js";

export async function bootstrap(options = {}) {
  if (window.__debomudRuntime) {
    return window.__debomudRuntime;
  }

  const baseUrl = options.baseUrl ?? detectBaseUrl();
  const selector = options.selector ?? ".out.nice";

  const data = await loadData(baseUrl);
  const engine = new AudioEngine({ baseUrl });
  const runtime = new TriggerRuntime({
    engine,
    data,
    targetSelector: selector,
  });

  runtime.start();

  const api = {
    enable(value) {
      engine.setEnabled(value);
    },
    setVolume(channel, value) {
      engine.setVolume(channel, value);
    },
    status() {
      return engine.getState();
    },
    stopAll() {
      engine.stopAll();
    },
    destroy() {
      runtime.stop();
      engine.stopAll();
      delete window.__debomudRuntime;
    },
  };

  mountPanel(api);
  window.__debomudRuntime = api;
  window.deboMUDSounds = api;

  window.addEventListener(
    "click",
    () => {
      const audio = engine.players?.bgm;
      if (audio && audio.paused && audio.src) {
        audio.play().catch(() => {});
      }
    },
    { once: true },
  );

  return api;
}

function detectBaseUrl() {
  const script = document.currentScript;
  if (script?.src) {
    const u = new URL(script.src);
    const parts = u.pathname.split("/").slice(0, -2).join("/");
    return `${u.origin}${parts}`;
  }

  return "";
}

async function loadData(baseUrl) {
  const [bgm, fx, classes, vivas, barraDeVida] = await Promise.all([
    fetchJson(`${baseUrl}/data/bgm.json`),
    fetchJson(`${baseUrl}/data/fx.json`),
    fetchJson(`${baseUrl}/data/classes.json`),
    fetchJson(`${baseUrl}/data/vivas.json`),
    fetchJson(`${baseUrl}/data/barraDeVida.json`),
  ]);

  return { bgm, fx, classes, vivas, barraDeVida };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${url}: ${response.status}`);
  }
  return response.json();
}
