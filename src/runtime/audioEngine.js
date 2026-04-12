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
          detail: { error, channel: "bgm" },
        }),
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
      this.players.bgm.volume = this.computeVolume("bgm");
    }
  }

  computeVolume(channel) {
    return clamp01((this.volume[channel] ?? 1) * this.volume.master);
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function stripSoundPrefix(value) {
  if (!value) {
    return "";
  }
  return value.replace(/^Sounds\/uar_Bgm\//i, "");
}
