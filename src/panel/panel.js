export function mountPanel(api) {
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
  ].join("");

  document.body.appendChild(panel);
  attachEvents(api);
  injectStyles();
  hydrate(api);
}

function attachEvents(api) {
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
    document
      .getElementById(`dbm-${channel}`)
      .addEventListener("input", (event) => {
        api.setVolume(channel, Number(event.target.value));
        persist(api.status());
        updateStatus(api.status());
      });
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
      (state.volume[channel] ?? 0) * 100,
    );
  });

  updateStatus(state);
}

function updateStatus(state) {
  const status = document.getElementById("dbm-status");
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
    #debomud-panel button { border: 0; border-radius: 8px; padding: 6px 10px; background: #2d4d4f; color: #fff; cursor: pointer; }
    #debomud-panel .dbm-status { margin-top: 8px; font-size: 12px; }
    @media (max-width: 720px) {
      #debomud-panel { width: calc(100vw - 24px); left: 12px; right: 12px; }
    }
  `;

  document.head.appendChild(style);
}
