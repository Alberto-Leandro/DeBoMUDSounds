export class AudioEngine {
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
      barraDeVida: 0.8,
    };

    this.players = {
      bgm: new Audio(),
      fx: null,
      classes: null,
      vivas: null,
      barraDeVida: null,
    };

    this.players.bgm.loop = true;
    this.players.bgm.preload = "auto";
    this.players.bgm.crossOrigin = "anonymous";

    this.audioContext = null;
    this.bgmNodes = null;

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

  initAudioContext() {
    if (this.audioContext) {
      return;
    }
    this.audioContext = createAudioContext();
    if (this.audioContext) {
      this.bgmNodes = createMediaElementChain(
        this.audioContext,
        this.players.bgm,
      );
    }
  }

  async playBgm(track, blockList = [], playbackModifiers = null) {
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

    this.initAudioContext();
    const audio = this.players.bgm;
    audio.src = this.toPublicPath(track);
    audio.currentTime = 0;
    this.applyPlaybackModifiers(audio, this.bgmNodes, "bgm", playbackModifiers);

    try {
      await this.ensureContextReady();
      await audio.play();
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("debomud:audio-error", {
          detail: { error, channel: "bgm" },
        }),
      );
    }
  }

  async playEffect(channel, soundPath, playbackModifiers = null) {
    if (!this.enabled || !soundPath) {
      return;
    }

    this.initAudioContext();
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = this.toPublicPath(soundPath);
    audio.preload = "auto";
    const nodes = this.audioContext
      ? createMediaElementChain(this.audioContext, audio)
      : null;
    this.applyPlaybackModifiers(audio, nodes, channel, playbackModifiers);

    try {
      await this.ensureContextReady();
      await audio.play();
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("debomud:audio-error", { detail: { error, channel } }),
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
      volume: { ...this.volume },
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
      this.applyPlaybackModifiers(this.players.bgm, this.bgmNodes, "bgm", null);
    }
  }

  applyPlaybackModifiers(audio, nodes, channel, playbackModifiers) {
    const volumePercent = playbackModifiers?.volume ?? 100;
    const frequency = playbackModifiers?.frequency ?? null;
    const pan = playbackModifiers?.pan ?? 0;

    audio.playbackRate = this.computePlaybackRate(frequency);

    if (nodes?.gainNode && nodes?.panNode) {
      nodes.gainNode.gain.value = this.computeVolume(channel, volumePercent);
      nodes.panNode.pan.value = this.computePanValue(pan);
      audio.volume = 1;
      return;
    }

    audio.volume = this.computeVolume(channel, volumePercent);
  }

  computeVolume(channel, localPercent = 100) {
    const localFactor = clamp01(localPercent / 100);
    return clamp01(
      (this.volume[channel] ?? 1) * this.volume.master * localFactor,
    );
  }

  computePlaybackRate(frequency) {
    if (frequency == null) {
      return 1;
    }

    const numeric = Number.parseFloat(frequency);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 1;
    }

    if (numeric <= 4) {
      return clamp(numeric, 0.1, 4);
    }

    return clamp(numeric / 22050, 0.1, 4);
  }

  computePanValue(pan) {
    const numeric = Number.parseFloat(pan);
    if (!Number.isFinite(numeric)) {
      return 0;
    }

    if (numeric >= -1 && numeric <= 1) {
      return numeric;
    }

    return clamp(numeric / 5000, -1, 1);
  }

  async ensureContextReady() {
    if (!this.audioContext || this.audioContext.state !== "suspended") {
      return;
    }

    try {
      await this.audioContext.resume();
    } catch {
      // Keep playback fallback path when context resume is blocked.
    }
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createAudioContext() {
  const ContextClass =
    globalThis.window?.AudioContext || globalThis.window?.webkitAudioContext;
  if (!ContextClass) {
    return null;
  }

  try {
    return new ContextClass();
  } catch {
    return null;
  }
}

function createMediaElementChain(audioContext, audioElement) {
  try {
    const sourceNode = audioContext.createMediaElementSource(audioElement);
    const gainNode = audioContext.createGain();
    const panNode = audioContext.createStereoPanner();
    sourceNode.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(audioContext.destination);
    return { sourceNode, gainNode, panNode };
  } catch {
    return null;
  }
}

function stripSoundPrefix(value) {
  if (!value) {
    return "";
  }
  return value.replace(/^Sounds\/uar_Bgm\//i, "");
}
