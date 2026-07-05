// Sfx: tiny procedural sound effects via the Web Audio API. No sample files — each effect
// is a short synthesized tone (oscillator + gain envelope) or filtered noise burst, so the
// game ships zero audio assets, works offline, and every sound is tunable right here in code.
// When we later want richer audio we can swap real samples behind the same play() interface.
//
// WHY procedural for now: it removes a whole asset/licensing pipeline during the trial week
// and lets us get feedback-on-every-action immediately. This belongs in the shared template —
// every micro game wants juice sounds wired to its actions.
//
// Browsers block audio until a user gesture, so the AudioContext is created/resumed lazily on
// the first tap (see unlock()); before that, play() is a no-op.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32; // headroom so layered blips never clip
    this.master.connect(this.ctx.destination);
  }

  // Call from the first user gesture to satisfy autoplay policy.
  unlock() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) { this.muted = m; }

  // One shaped tone. freq→freqEnd sweeps the pitch; type is the oscillator waveform. A quick
  // attack + exponential decay makes a plucky blip rather than a click.
  tone({ freq, freqEnd, dur = 0.12, type = 'sine', gain = 0.6, delay = 0, attack = 0.006 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  // Short noise burst through a lowpass → an impact/thud texture (used for siege), not static.
  noise({ dur = 0.18, gain = 0.4, delay = 0, cutoff = 1000 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames); // fades out
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t0);
  }

  // A tinny metal "tang" (hammer on anvil) for fortify. Three things push it from glass toward
  // metal: brighter TRIANGLE partials (more upper harmonics than a pure sine), higher partials
  // that ring LONGER than the body (metal sustains), and detuned partial PAIRS that beat against
  // each other for the shimmering metallic edge. A slight downward bend on the fundamental gives
  // the "tang," and a bright noise tick is the hammer contact. Still short/modest, not a gong.
  clang(pitch = 1) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const base = 430 * pitch; // deeper root → a lower, heavier tang
    const LEVEL = 0.75;       // overall tang loudness (dialed down 25%)
    // r = inharmonic frequency ratio, g = level, d = decay (s), dt = detune (Hz) for the beating pair.
    const partials = [
      { r: 1.00, g: 0.30, d: 0.20, dt: 0 },
      { r: 2.34, g: 0.24, d: 0.34, dt: 3 },
      { r: 3.16, g: 0.30, d: 0.52, dt: 4 }, // the bright ringing "tang"
      { r: 4.81, g: 0.18, d: 0.44, dt: 5 },
      { r: 6.72, g: 0.11, d: 0.36, dt: 6 },
    ];
    for (const { r, g, d, dt } of partials) {
      const offsets = dt ? [-dt, dt] : [0]; // detuned pair → beating shimmer
      for (const off of offsets) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const f = base * r + off;
        osc.frequency.setValueAtTime(f, t0);
        if (r === 1) osc.frequency.exponentialRampToValueAtTime(f * 0.94, t0 + d); // slight tang bend
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime((g * LEVEL) / offsets.length, t0 + 0.002); // near-instant strike
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        osc.connect(gain); gain.connect(this.master);
        osc.start(t0); osc.stop(t0 + d + 0.02);
      }
    }
    this.noise({ dur: 0.035, gain: 0.14 * LEVEL, cutoff: 8000 * pitch }); // bright hammer contact tick
  }

  // BACKUP — the earlier pure-sine bell version. Reads more like tapping a glass jar than metal;
  // kept here for a future glass/ceramic action. Not currently wired to any action.
  glassClang(pitch = 1) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const base = 620 * pitch;
    const partials = [
      { r: 1.00, g: 0.45, d: 0.26 },
      { r: 2.76, g: 0.26, d: 0.18 },
      { r: 5.18, g: 0.18, d: 0.13 },
      { r: 8.16, g: 0.10, d: 0.09 },
    ];
    for (const { r, g, d } of partials) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * r, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(g, t0 + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      osc.connect(gain); gain.connect(this.master);
      osc.start(t0); osc.stop(t0 + d + 0.02);
    }
    this.noise({ dur: 0.03, gain: 0.16, cutoff: 6500 * pitch });
  }

  // 5 slight pitch variants (two down, middle, two up) chosen at random each play, so a
  // repeated action never sounds identical back-to-back — identical repeats tire the ear fast.
  // One step = STEP semitones; the middle (0) is the sound as originally tuned.
  variant() {
    const STEP = 1; // semitones per step — lower this for subtler spread
    const s = [-2, -1, 0, 1, 2][(Math.random() * 5) | 0];
    return Math.pow(2, (s * STEP) / 12);
  }

  // ---- named effects, mapped to game actions ----
  // p = the per-play pitch multiplier, applied to every frequency so the whole sound shifts
  // together (stays in tune, just transposed).
  play(name) {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const p = this.variant();
    switch (name) {
      case 'claim': // bright, quick rising pluck — light and cheap
        this.tone({ freq: 520 * p, freqEnd: 760 * p, dur: 0.10, type: 'triangle', gain: 0.5 });
        break;
      case 'build': // two-note "construct" — a body note plus a brighter cap
        this.tone({ freq: 300 * p, freqEnd: 450 * p, dur: 0.12, type: 'square', gain: 0.32 });
        this.tone({ freq: 600 * p, freqEnd: 900 * p, dur: 0.10, type: 'triangle', gain: 0.28, delay: 0.05 });
        break;
      case 'fortify': // metallic anvil clang
        this.clang(p);
        break;
      case 'siege': // impact noise + a downward square growl (volume dialed down 10%)
        this.noise({ dur: 0.2, gain: 0.45, cutoff: 1200 * p });
        this.tone({ freq: 210 * p, freqEnd: 90 * p, dur: 0.18, type: 'square', gain: 0.36 });
        break;
      case 'capture': // base captured — a heavier, much lower siege (its own sound, not a variant)
        this.noise({ dur: 0.34, gain: 0.55, cutoff: 700 * p });                              // bigger, darker impact
        this.tone({ freq: 130 * p, freqEnd: 46 * p, dur: 0.34, type: 'square', gain: 0.5 }); // deep growl, an octave-ish below siege
        this.tone({ freq: 84 * p, freqEnd: 38 * p, dur: 0.42, type: 'sawtooth', gain: 0.32, delay: 0.02 }); // sub layer for weight
        break;
      case 'endturn': // soft falling sine to punctuate the hand-off
        this.tone({ freq: 440 * p, freqEnd: 320 * p, dur: 0.10, type: 'sine', gain: 0.28 });
        break;
      case 'win': // rising major arpeggio sting
        [523, 659, 784, 1047, 1319].forEach((f, i) =>
          this.tone({ freq: f * p, dur: 0.22, type: 'triangle', gain: 0.5, delay: i * 0.1 }));
        break;
      case 'lose': // descending minor sting
        [392, 330, 262, 196].forEach((f, i) =>
          this.tone({ freq: f * p, dur: 0.26, type: 'sawtooth', gain: 0.34, delay: i * 0.12 }));
        break;
      default:
        break;
    }
  }
}
