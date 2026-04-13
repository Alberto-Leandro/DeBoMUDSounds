(() => {
  // src/runtime/audioEngine.js
  var AudioEngine = class {
    constructor(options = {}) {
      this.baseUrl = options.baseUrl ?? "";
      this.enabled = true;
      this.currentBgmTrack = null;
      this.bgmBlockedBy = [];
      this.volume = {
        master: 1,
        bgm: 0.5,
        fx: 0.7,
        classes: 0.7,
        vivas: 0.7,
        barraDeVida: 0.8
      };
      this.players = {
        bgm: new Audio(),
        fx: null,
        classes: null,
        vivas: null,
        barraDeVida: null
      };
      this.players.bgm.loop = true;
      this.players.bgm.preload = "auto";
      this.applyVolume("bgm");
    }
    setEnabled(value) {
      this.enabled = Boolean(value);
      if (!this.enabled) {
        this.stopAll();
      }
    }
    setVolume(channel, value) {
      const v = clamp01(value / 100);
      if (!(channel in this.volume)) {
        return;
      }
      this.volume[channel] = v;
      if (channel !== "master") {
        this.applyVolume(channel);
      }
    }
    async playBgm(track, blockList = []) {
      if (!this.enabled || !track) {
        return;
      }
      const trackName = stripSoundPrefix(track);
      if (blockList.includes(stripSoundPrefix(this.currentBgmTrack))) {
        this.bgmBlockedBy = blockList;
        return;
      }
      if (this.currentBgmTrack === track) {
        return;
      }
      this.bgmBlockedBy = blockList;
      this.currentBgmTrack = track;
      const audio = this.players.bgm;
      audio.src = this.toPublicPath(track);
      audio.currentTime = 0;
      this.applyVolume("bgm");
      try {
        await audio.play();
      } catch (error) {
        window.dispatchEvent(
          new CustomEvent("debomud:audio-error", {
            detail: { error, channel: "bgm" }
          })
        );
      }
    }
    async playEffect(channel, soundPath) {
      if (!this.enabled || !soundPath) {
        return;
      }
      const audio = new Audio(this.toPublicPath(soundPath));
      audio.preload = "auto";
      audio.volume = this.computeVolume(channel);
      try {
        await audio.play();
      } catch (error) {
        window.dispatchEvent(
          new CustomEvent("debomud:audio-error", { detail: { error, channel } })
        );
      }
    }
    stopAll() {
      const bgm = this.players.bgm;
      bgm.pause();
      bgm.currentTime = 0;
    }
    getState() {
      return {
        enabled: this.enabled,
        currentBgmTrack: this.currentBgmTrack,
        bgmBlockedBy: this.bgmBlockedBy,
        volume: { ...this.volume }
      };
    }
    toPublicPath(soundPath) {
      if (!soundPath) {
        return "";
      }
      if (/^https?:\/\//i.test(soundPath)) {
        return soundPath;
      }
      const clean = soundPath.replace(/^\/+/, "");
      return this.baseUrl ? `${this.baseUrl}/${clean}` : clean;
    }
    applyVolume(channel) {
      if (channel === "bgm") {
        this.players.bgm.volume = this.computeVolume("bgm");
      }
    }
    computeVolume(channel) {
      return clamp01((this.volume[channel] ?? 1) * this.volume.master);
    }
  };
  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }
  function stripSoundPrefix(value) {
    if (!value) {
      return "";
    }
    return value.replace(/^Sounds\/uar_Bgm\//i, "");
  }

  // src/runtime/triggerRuntime.js
  var TriggerRuntime = class {
    constructor(config) {
      this.engine = config.engine;
      this.data = config.data;
      this.targetSelector = config.targetSelector ?? ".out.nice";
      this.debounceMs = config.debounceMs ?? 120;
      this.lastFired = /* @__PURE__ */ new Map();
      this.observer = null;
      this.timer = null;
      this.pendingText = "";
    }
    start() {
      const root = document.querySelector(this.targetSelector);
      if (!root) {
        throw new Error(`Elemento alvo nao encontrado: ${this.targetSelector}`);
      }
      this.observer = new MutationObserver((mutations) => {
        const added = [];
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 || node.nodeType === 3) {
              added.push(node.textContent ?? "");
            }
          }
        }
        if (!added.length) {
          return;
        }
        this.pendingText += `
${added.join("\n")}`;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), this.debounceMs);
      });
      this.observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    stop() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      clearTimeout(this.timer);
      this.pendingText = "";
    }
    flush() {
      const text = this.pendingText;
      this.pendingText = "";
      if (!text.trim()) {
        return;
      }
      this.processCategory("bgm", text);
      this.processCategory("fx", text);
      this.processCategory("classes", text);
      this.processCategory("vivas", text);
      this.processCategory("barraDeVida", text);
    }
    processCategory(category, text) {
      const triggers = this.data[category] ?? [];
      const normalizedText = normalizeTextForMatch(text);
      for (const trigger of triggers) {
        const regex = new RegExp(trigger.matcher.source, trigger.matcher.flags);
        if (!regex.test(normalizedText)) {
          continue;
        }
        if (this.isDeduped(category, trigger.pattern)) {
          continue;
        }
        if (category === "bgm") {
          this.engine.playBgm(trigger.track, trigger.blockList ?? []);
        } else {
          this.engine.playEffect(category, trigger.soundPath);
        }
      }
    }
    isDeduped(category, pattern) {
      const key = `${category}:${pattern}`;
      const now = Date.now();
      const last = this.lastFired.get(key) ?? 0;
      if (now - last < 200) {
        return true;
      }
      this.lastFired.set(key, now);
      return false;
    }
  };
  function normalizeTextForMatch(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  // src/panel/panel.js
  function mountPanel(api) {
    if (document.getElementById("debomud-panel")) {
      return;
    }
    const panel = document.createElement("div");
    panel.id = "debomud-panel";
    panel.innerHTML = [
      '<div class="dbm-header">DeBoMUD Sounds</div>',
      '<div class="dbm-row"><button id="dbm-toggle">On/Off</button><button id="dbm-stop">Stop</button></div>',
      '<div class="dbm-row"><label>BGM</label><input id="dbm-bgm" type="range" min="0" max="100" /></div>',
      '<div class="dbm-row"><label>FX</label><input id="dbm-fx" type="range" min="0" max="100" /></div>',
      '<div class="dbm-row"><label>Classes</label><input id="dbm-classes" type="range" min="0" max="100" /></div>',
      '<div class="dbm-row"><label>Vivas</label><input id="dbm-vivas" type="range" min="0" max="100" /></div>',
      '<div class="dbm-row"><label>Barra Vida</label><input id="dbm-barraDeVida" type="range" min="0" max="100" /></div>',
      '<div class="dbm-status" id="dbm-status">Aguardando...</div>',
      '<div class="dbm-row dbm-actions"><button id="dbm-minimize" aria-label="Minimizar painel">Minimizar</button><button id="dbm-close" aria-label="Fechar painel">Fechar</button></div>'
    ].join("");
    const launcher = document.createElement("button");
    launcher.id = "debomud-panel-launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Reabrir painel de sons");
    launcher.textContent = "Som";
    launcher.hidden = true;
    document.body.appendChild(panel);
    document.body.appendChild(launcher);
    attachEvents(api);
    injectStyles();
    hydrate(api);
  }
  function attachEvents(api) {
    const panel = document.getElementById("debomud-panel");
    const launcher = document.getElementById("debomud-panel-launcher");
    document.getElementById("dbm-toggle").addEventListener("click", () => {
      const state = api.status();
      api.enable(!state.enabled);
      persist(api.status());
      updateStatus(api.status());
    });
    document.getElementById("dbm-stop").addEventListener("click", () => {
      api.stopAll();
      updateStatus(api.status());
    });
    ["bgm", "fx", "classes", "vivas", "barraDeVida"].forEach((channel) => {
      document.getElementById(`dbm-${channel}`).addEventListener("input", (event) => {
        api.setVolume(channel, Number(event.target.value));
        persist(api.status());
        updateStatus(api.status());
      });
    });
    document.getElementById("dbm-minimize").addEventListener("click", () => {
      panel.hidden = true;
      launcher.hidden = false;
    });
    launcher.addEventListener("click", () => {
      panel.hidden = false;
      launcher.hidden = true;
    });
    document.getElementById("dbm-close").addEventListener("click", () => {
      panel.remove();
      launcher.remove();
    });
  }
  function hydrate(api) {
    const saved = readPersisted();
    if (saved) {
      api.enable(saved.enabled);
      for (const [channel, value] of Object.entries(saved.volume ?? {})) {
        if (channel !== "master") {
          api.setVolume(channel, Math.round(value * 100));
        }
      }
    }
    const state = api.status();
    ["bgm", "fx", "classes", "vivas", "barraDeVida"].forEach((channel) => {
      document.getElementById(`dbm-${channel}`).value = Math.round(
        (state.volume[channel] ?? 0) * 100
      );
    });
    updateStatus(state);
  }
  function updateStatus(state) {
    const status = document.getElementById("dbm-status");
    if (!status) {
      return;
    }
    status.textContent = `Estado: ${state.enabled ? "ON" : "OFF"} | BGM: ${state.currentBgmTrack ?? "nenhuma"}`;
  }
  function persist(state) {
    localStorage.setItem("debomud:sounds:state", JSON.stringify(state));
  }
  function readPersisted() {
    const raw = localStorage.getItem("debomud:sounds:state");
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  function injectStyles() {
    if (document.getElementById("debomud-panel-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "debomud-panel-style";
    style.textContent = `
    #debomud-panel {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 999999;
      width: 300px;
      border-radius: 12px;
      border: 1px solid #1f2430;
      background: linear-gradient(180deg, #f1f0e8, #e4dccf);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      color: #202028;
      padding: 10px;
      font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
    }
    #debomud-panel .dbm-header { font-weight: 700; margin-bottom: 8px; }
    #debomud-panel .dbm-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
    #debomud-panel .dbm-row label { width: 60px; font-size: 12px; }
    #debomud-panel .dbm-row input { flex: 1; }
    #debomud-panel .dbm-actions { justify-content: flex-end; margin-top: 10px; }
    #debomud-panel button { border: 0; border-radius: 8px; padding: 6px 10px; background: #2d4d4f; color: #fff; cursor: pointer; }
    #debomud-panel .dbm-actions button { min-width: 88px; }
    #debomud-panel .dbm-status { margin-top: 8px; font-size: 12px; }
    #debomud-panel-launcher {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 999998;
      border: 0;
      border-radius: 999px;
      padding: 8px 12px;
      background: #2d4d4f;
      color: #fff;
      font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
    }
    @media (max-width: 720px) {
      #debomud-panel { width: calc(100vw - 24px); left: 12px; right: 12px; }
    }
  `;
    document.head.appendChild(style);
  }

  // src/runtime/app.js
  async function bootstrap(options = {}) {
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
      targetSelector: selector
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
      }
    };
    mountPanel(api);
    window.__debomudRuntime = api;
    window.deboMUDSounds = api;
    window.addEventListener(
      "click",
      () => {
        const audio = engine.players?.bgm;
        if (audio && audio.paused && audio.src) {
          audio.play().catch(() => {
          });
        }
      },
      { once: true }
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
      fetchJson(`${baseUrl}/data/barraDeVida.json`)
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

  // src/runtime/loader.js
  bootstrap().catch((error) => {
    console.error("DeBoMUDSounds: erro ao inicializar", error);
    alert("DeBoMUDSounds: erro ao inicializar. Veja o console para detalhes.");
  });
})();
