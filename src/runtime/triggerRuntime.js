export class TriggerRuntime {
  constructor(config) {
    this.engine = config.engine;
    this.data = config.data;
    this.targetSelector = config.targetSelector ?? ".out.nice";
    this.debounceMs = config.debounceMs ?? 120;
    this.lastFired = new Map();
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

      this.pendingText += `\n${added.join("\n")}`;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), this.debounceMs);
    });

    this.observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
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
}

function normalizeTextForMatch(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
