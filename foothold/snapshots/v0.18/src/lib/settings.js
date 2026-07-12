// Settings: the game's persisted user preferences (sound + CRT filter), stored in localStorage
// so choices survive a reload/relaunch. One shared instance (`settings`) is the single source of
// truth; the settings screen writes to it, and scenes read from it on create.
//
// WHY a tiny store instead of scattering flags: audio and the CRT toggle are read from two
// different scenes (title + game), and both must persist. Centralizing it here means one place
// loads/saves and one place re-applies audio to the shared Sfx mixer. This is template-worthy -
// every micro game wants persistent sound/display settings.

import { sfx } from './sfx.js';

// Single source of truth for the build version shown in the UI (title screen + Settings ▸ About).
// Bump this when you cut a new snapshot so both spots update together.
export const VERSION = 'v0.18';

const KEY = 'foothold:settings';
const DEFAULTS = { muted: false, volume: 0.8, crt: true, dlss: false };

const clamp01 = (v) => Math.max(0, Math.min(1, v));

class Settings {
  constructor() {
    this.data = { ...DEFAULTS };
    this.load();
    this.applyAudio(); // seed the shared mixer from the loaded prefs
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch (e) {
      // Private-mode / disabled storage - just run on defaults, never crash the boot.
    }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  }

  get muted() { return this.data.muted; }
  get volume() { return this.data.volume; }
  get crt() { return this.data.crt; }
  get dlss() { return this.data.dlss; }

  setMuted(v) { this.data.muted = !!v; this.save(); this.applyAudio(); }
  setVolume(v) { this.data.volume = clamp01(v); this.save(); this.applyAudio(); }
  // CRT has no global side effect to push here - scenes observe settings.crt and add/remove the
  // camera pipeline themselves (see setSceneCrt), since the effect is per-camera.
  setCrt(v) { this.data.crt = !!v; this.save(); }
  // DLSS + Frame Gen: a purely cosmetic gag toggle (sparkles + holographic label + a fanfare).
  // Persisted so its state survives a reload; the sparkle effect is driven by the settings panel.
  setDlss(v) { this.data.dlss = !!v; this.save(); }

  // Push the current audio prefs onto the shared mixer. Muted fully silences; otherwise the
  // 0..1 volume scales the master gain.
  applyAudio() {
    sfx.setMuted(this.data.muted);
    sfx.setVolume(this.data.volume);
  }
}

export const settings = new Settings();
