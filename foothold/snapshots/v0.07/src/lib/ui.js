// ui.js: reusable modal overlays shared by the title screen and the game - the How-to-Play
// tutorial and the Settings panel. Both are built the same way as the game's existing overlays
// (a full-screen dim scrim + a centered rounded card in a high-depth container), but factored
// here so ONE implementation serves both scenes.
//
// Pattern: each `createXOverlay(scene, opts)` returns `{ show, hide }`. show() builds the whole
// overlay fresh; hide() destroys it. Building on show (like the game's hover tooltip) means there
// are never stale interactive hit areas sitting invisible over the board when the panel is closed.
//
// This whole file is template-worthy - every micro game wants a settings panel and a rules panel.

import { sfx } from './sfx.js';
import { settings, VERSION } from './settings.js';
import { setSceneCrt } from './CrtPipeline.js';

const FONT = 'system-ui, -apple-system, sans-serif';
const INK = '#e7e9f0';       // primary text
const SUBTLE = '#aeb4c6';    // secondary text
const CARD = 0x22263a;       // panel fill
const ACCENT = 0x3d6cff;     // primary blue

// Resource tints (mirror GameScene.TINT) so cost icons read on-palette inside the panels.
const TINT = { gold: 0xf2c14e, wood: 0xb5793a, stone: 0xb9c2d0, special: 0x5ad1c8 };
// Action glow colors (mirror GameScene.ACTION_COLOR) for the tutorial swatches.
const ACTION_COLOR = { claim: 0xffce3a, build: 0x57c97a, upgrade: 0xb06bff, siege: 0xff6a3d };

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// A rounded rectangle drawn into a fresh graphics object (Phaser rectangles have no radius).
function roundRect(scene, x, y, w, h, color, radius = 14, alpha = 1) {
  const g = scene.add.graphics();
  g.fillStyle(color, alpha).fillRoundedRect(x, y, w, h, radius);
  return g;
}

// A pill on/off switch. `on` = the initial state; onChange(bool) fires on tap. Added to `cont`.
function makeToggle(scene, cont, x, y, on, onChange) {
  const W = 74, H = 38, pad = 4, kr = (H - pad * 2) / 2;
  const pill = scene.add.graphics();
  const knob = scene.add.circle(0, 0, kr, 0xffffff);
  let state = on;
  const redraw = () => {
    pill.clear();
    pill.fillStyle(state ? ACCENT : 0x4a5273, 1).fillRoundedRect(x, y - H / 2, W, H, H / 2);
    knob.setPosition(state ? x + W - pad - kr : x + pad + kr, y);
  };
  redraw();
  const hit = scene.add.rectangle(x + W / 2, y, W, H, 0x000000, 0.001).setInteractive({ useHandCursor: true });
  hit.on('pointerdown', () => { state = !state; redraw(); sfx.play('claim'); onChange(state); });
  cont.add([pill, knob, hit]);
}

// A horizontal 0..1 slider with a draggable knob (and tap-to-jump on the track). Added to `cont`.
function makeSlider(scene, cont, x, y, w, initial, onChange) {
  const H = 10, kr = 15;
  let val = clamp01(initial);
  const track = scene.add.graphics();
  const knob = scene.add.circle(0, 0, kr, 0xffffff).setInteractive({ useHandCursor: true });
  const redraw = () => {
    track.clear();
    track.fillStyle(0x39405c, 1).fillRoundedRect(x, y - H / 2, w, H, H / 2);          // full track
    track.fillStyle(ACCENT, 1).fillRoundedRect(x, y - H / 2, Math.max(H, val * w), H, H / 2); // filled portion
    knob.setPosition(x + val * w, y);
  };
  redraw();
  const set = (px, sound) => { val = clamp01((px - x) / w); redraw(); if (sound) sfx.play('claim'); onChange(val); };
  scene.input.setDraggable(knob);
  knob.on('drag', (pointer, dragX) => set(dragX, false));
  // Tap anywhere on the track to jump the knob there.
  const hit = scene.add.rectangle(x + w / 2, y, w, kr * 2, 0x000000, 0.001).setInteractive({ useHandCursor: true });
  hit.on('pointerdown', (p) => set(p.x, true));
  cont.add([track, hit, knob]);
}

// A filled pill button with centered label. onTap fires on pointerdown. Returns the rect.
function makeButton(scene, cont, cx, y, w, h, label, color, textColor, onTap) {
  const g = roundRect(scene, cx - w / 2, y - h / 2, w, h, color, h / 2);
  const hit = scene.add.rectangle(cx, y, w, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
  const txt = scene.add.text(cx, y, label, { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: textColor }).setOrigin(0.5);
  hit.on('pointerdown', onTap);
  cont.add([g, hit, txt]);
  return hit;
}

// Small round × close button, top-right of a card. onTap closes.
function makeClose(scene, cont, x, y, onTap) {
  const c = scene.add.circle(x, y, 24, 0x39405c).setInteractive({ useHandCursor: true });
  const t = scene.add.text(x, y - 1, '✕', { fontFamily: FONT, fontSize: '26px', color: INK }).setOrigin(0.5);
  c.on('pointerdown', onTap);
  cont.add([c, t]);
}

// ------------------------------------------------------------------ How to Play
export function createTutorialOverlay(scene) {
  let cont = null;
  const hide = () => { if (cont) { cont.destroy(true); cont = null; } };

  const show = () => {
    if (cont) return;
    sfx.play('claim');
    // Center on the live canvas, not a fixed 720: the wide (desktop) canvas is wider.
    const W = scene.scale.gameSize.width, CX = W / 2;
    const H = scene.scale.gameSize.height;
    // The full rules card is tall (~900px). On a landscape/large canvas (height locked to 900)
    // it would clip the bottom, so shrink the whole overlay to 80% there. We scale the container
    // around the canvas center at the end; the dim is oversized by 1/s so it still covers the
    // full screen once scaled down.
    const wide = W > H, s = wide ? 0.8 : 1;
    cont = scene.add.container(0, 0).setDepth(60);
    const dim = scene.add.rectangle(CX, H / 2, W / s, H / s, 0x000000, 0.74).setInteractive();
    dim.on('pointerdown', hide); // tap outside the card to dismiss
    cont.add(dim);

    const cardW = 620, cardX = CX - cardW / 2;
    // What each resource is for (the simple legend that sits above the actions).
    const resRows = [
      { res: 'gold', name: 'Gold', desc: 'Spent to Expand and Siege enemies' },
      { res: 'wood', name: 'Wood', desc: 'Spent to Build and capture nodes' },
      { res: 'stone', name: 'Stone', desc: 'Spent to Upgrade your nodes' },
      { res: 'special', name: 'Special', desc: 'A rare node that provides all resource types' },
    ];
    const actRows = [
      { color: ACTION_COLOR.claim, name: 'Expand', desc: 'Take an empty neutral tile next to you.', res: 'gold', cost: 5 },
      { color: ACTION_COLOR.build, name: 'Build', desc: 'Take a neutral resource node, earning income each turn.', res: 'wood', cost: 5 },
      { color: ACTION_COLOR.upgrade, name: 'Upgrade', desc: "Double a resource node's income.", res: 'stone', cost: 5 },
      { color: ACTION_COLOR.siege, name: 'Siege', desc: 'Capture an enemy tile. Nodes also cost wood to re-develop.', res: 'gold', cost: 10 },
    ];
    // Spacing model: HEAD_H reserves the goal block up top; HDR_GAP is the tight space from a
    // section header down to its first row; PRE_HDR is the breathing room ABOVE the Actions header
    // so it isn't glued to the last resource row.
    const RES_H = 50, ACT_H = 84, HDR_GAP = 20, PRE_HDR = 46, HEAD_H = 186;
    const cardH = HEAD_H + HDR_GAP + resRows.length * RES_H + PRE_HDR + HDR_GAP + actRows.length * ACT_H + 96;
    const cardY = Math.max(36, Math.round((H - cardH) / 2));
    cont.add(roundRect(scene, cardX, cardY, cardW, cardH, CARD, 20));
    // Block pointer events on the card itself so clicking inside the panel never falls through to
    // the dim scrim behind it (which would dismiss). Only the buttons/× (added later, on top) act.
    const block = scene.add.rectangle(CX, cardY + cardH / 2, cardW, cardH, 0x000000, 0.001).setInteractive();
    cont.add(block);

    cont.add(scene.add.text(CX, cardY + 46, 'How to Play', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: INK }).setOrigin(0.5));
    makeClose(scene, cont, cardX + cardW - 40, cardY + 40, hide);
    // The goal, up top - the one thing a new player most needs.
    cont.add(scene.add.text(CX, cardY + 100, 'Expand your territory, conquer your enemy.', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: INK }).setOrigin(0.5));
    cont.add(scene.add.text(CX, cardY + 140, 'Win by capturing the enemy base, or by holding\nmore tiles after 12 rounds.',
      { fontFamily: FONT, fontSize: '19px', color: SUBTLE, align: 'center', lineSpacing: 4 }).setOrigin(0.5));

    // A section header (all-caps, muted), matching the Settings panel style.
    const sectionHeader = (yy, label) =>
      cont.add(scene.add.text(cardX + 40, yy, label, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#8f97ad' }).setOrigin(0, 0.5));

    let y = cardY + HEAD_H;

    // --- RESOURCES legend ---
    sectionHeader(y, 'RESOURCES');
    y += HDR_GAP;
    resRows.forEach((r) => {
      const rx = cardX + 26, ry = y + RES_H / 2;
      const g = roundRect(scene, rx, y + 7, cardW - 52, RES_H - 14, 0x1a1d2c, 10);
      const ic = scene.add.image(rx + 30, ry, `ic_${r.res}`).setDisplaySize(28, 28).setTint(TINT[r.res]).setOrigin(0.5);
      const name = scene.add.text(rx + 56, ry, r.name, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: INK }).setOrigin(0, 0.5);
      const desc = scene.add.text(rx + 168, ry, r.desc, { fontFamily: FONT, fontSize: '15px', color: SUBTLE }).setOrigin(0, 0.5);
      cont.add([g, ic, name, desc]);
      y += RES_H;
    });

    // --- ACTIONS ---
    y += PRE_HDR;
    sectionHeader(y, 'ACTIONS');
    y += HDR_GAP;
    actRows.forEach((r) => {
      const rx = cardX + 26, ry = y + ACT_H / 2;
      const g = roundRect(scene, rx, y + 8, cardW - 52, ACT_H - 16, 0x1a1d2c, 12);
      // Left swatch in the action's board-glow color (outline, like an actionable tile).
      const sw = scene.add.graphics();
      sw.lineStyle(4, r.color, 1).strokeRoundedRect(rx + 16, ry - 15, 30, 30, 6);
      // Title + subtitle kept tight together and vertically centered in the row.
      const name = scene.add.text(rx + 66, ry - 11, r.name, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: INK }).setOrigin(0, 0.5);
      const desc = scene.add.text(rx + 66, ry + 15, r.desc, { fontFamily: FONT, fontSize: '15px', color: SUBTLE, wordWrap: { width: cardW - 220 } }).setOrigin(0, 0.5);
      // Cost, right-aligned: number + tinted resource icon.
      const num = scene.add.text(rx + (cardW - 52) - 16, ry, `${r.cost}`, { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: INK }).setOrigin(1, 0.5);
      const ic = scene.add.image(rx + (cardW - 52) - 16 - num.width - 8, ry, `ic_${r.res}`).setDisplaySize(28, 28).setTint(TINT[r.res]).setOrigin(1, 0.5);
      cont.add([g, sw, name, desc, ic, num]);
      y += ACT_H;
    });

    makeButton(scene, cont, CX, y + 48, 260, 68, 'Got it', ACCENT, '#ffffff', hide);

    // Shrink-to-fit on large/landscape (see above). Scaling around (0,0) then offsetting keeps
    // the canvas center fixed, so the card stays centered and the oversized dim covers the screen.
    if (s !== 1) cont.setScale(s).setPosition(CX * (1 - s), (H / 2) * (1 - s));
  };

  return { show, hide };
}

// A soft 4-point star texture for the DLSS sparkle gag, generated once per scene.
function ensureStarTexture(scene) {
  if (scene.textures.exists('dlssStar')) return;
  const g = scene.make.graphics({ add: false });
  const S = 32, c = S / 2;
  g.fillStyle(0xffffff, 1);
  g.fillPoints([
    { x: c, y: 0 }, { x: c + 4, y: c - 4 }, { x: S, y: c }, { x: c + 4, y: c + 4 },
    { x: c, y: S }, { x: c - 4, y: c + 4 }, { x: 0, y: c }, { x: c - 4, y: c - 4 },
  ], true);
  g.fillCircle(c, c, 3);
  g.generateTexture('dlssStar', S, S);
  g.destroy();
}

// Gag "DLSS + Frame Gen" effect: multicolored sparkles flickering at random across the screen.
// Lives at scene level so it persists after the panel closes, until toggled off. Idempotent -
// stored on the scene so repeated opens don't stack emitters. Depth -1 tucks it BEHIND every game
// element (board, HUD, overlays) and just above the flat background, so it reads as a subtle glint
// peeking through rather than a distracting overlay. (While the Settings panel is open its dim
// scrim covers it - the sparkles show once the panel is closed.)
function startDlssSparkles(scene) {
  if (scene._dlssParticles) return;
  ensureStarTexture(scene);
  const W = scene.scale.gameSize.width, H = scene.scale.gameSize.height;
  scene._dlssParticles = scene.add.particles(0, 0, 'dlssStar', {
    x: { min: 0, max: W }, y: { min: 0, max: H },
    lifespan: 800, scale: { start: 0.7, end: 0 }, alpha: { start: 1, end: 0 },
    rotate: { min: 0, max: 360 }, frequency: 110, quantity: 2,
    tint: [0x8ef6ff, 0xff9de8, 0xfff29d, 0xbf9dff, 0xffffff],
    blendMode: 'ADD',
  }).setDepth(-1);
}

function stopDlssSparkles(scene) {
  if (scene._dlssParticles) { scene._dlssParticles.destroy(); scene._dlssParticles = null; }
}

// A single vertical light shaft for the god-ray gag: a soft bright core fading to nothing at the
// side edges, feathered at top and bottom so a beam never shows a hard end. The shaft is itself a
// full rainbow running along its length (not one flat color), so each beam reads as prismatic light.
// Generated once per scene. Built in three passes so color and alpha stay independent:
//   1. paint the rainbow spectrum down the length (opaque),
//   2. destination-in a horizontal alpha profile (bright center -> transparent side edges),
//   3. destination-out a vertical feather so the top and bottom ends fade out.
function ensureBeamTexture(scene) {
  if (scene.textures.exists('dlssBeam')) return;
  const w = 64, h = 256;
  const tex = scene.textures.createCanvas('dlssBeam', w, h);
  const ctx = tex.getContext();

  // 1. rainbow down the shaft
  const rg = ctx.createLinearGradient(0, 0, 0, h);
  rg.addColorStop(0.00, '#ff5d6c');
  rg.addColorStop(0.18, '#ffab5e');
  rg.addColorStop(0.36, '#fff29d');
  rg.addColorStop(0.54, '#8ef6a0');
  rg.addColorStop(0.72, '#8ef6ff');
  rg.addColorStop(0.88, '#9db8ff');
  rg.addColorStop(1.00, '#d39dff');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);

  // 2. keep only the soft central column (multiplies alpha by a horizontal profile)
  const hg = ctx.createLinearGradient(0, 0, w, 0);
  hg.addColorStop(0.0, 'rgba(0,0,0,0)');
  hg.addColorStop(0.5, 'rgba(0,0,0,1)');
  hg.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, w, h);

  // 3. feather the top and bottom ends
  const vg = ctx.createLinearGradient(0, 0, 0, h);
  vg.addColorStop(0.0, 'rgba(0,0,0,1)');
  vg.addColorStop(0.18, 'rgba(0,0,0,0)');
  vg.addColorStop(0.82, 'rgba(0,0,0,0)');
  vg.addColorStop(1.0, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'source-over';
  tex.refresh();
}

// Gag "god ray" effect (Aurora Curtain): tall rainbow light shafts spread evenly across the screen
// that sway and swell like an aurora. Part of the DLSS + Frame Gen gag, so it rides the same toggle
// as the sparkles. Depth -2 sits it BEHIND the sparkles (-1) and every game element, just above the
// flat background. Idempotent and stored on the scene so repeated opens don't stack beams.
function startGodrays(scene) {
  if (scene._godrays) return;
  ensureBeamTexture(scene);
  const W = scene.scale.gameSize.width, H = scene.scale.gameSize.height;
  // Scale beams to the live canvas, preserving the proportions from the staged preview:
  // ~15% of the width per beam, ~2x the height so the feathered core covers the screen.
  const baseSX = 0.149 * W / 64, baseSY = 2.03 * H / 256;
  const beams = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x = W * (0.08 + i * 0.17);
    // Alternate beams flip the rainbow vertically so neighbours don't line up their colors,
    // giving the curtain some prismatic variety without needing multiple textures.
    const beam = scene.add.image(x, H * 0.5, 'dlssBeam')
      .setDepth(-2).setBlendMode(Phaser.BlendModes.ADD).setFlipY(i % 2 === 1)
      .setScale(baseSX, baseSY).setAlpha(0.14);
    scene.tweens.add({ targets: beam, angle: 6, duration: 2600 + i * 300,
      yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: i * 220 });
    scene.tweens.add({ targets: beam, scaleX: baseSX * 1.25, alpha: 0.26, duration: 2000 + i * 250,
      yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: i * 160 });
    beams.push(beam);
  }
  scene._godrays = beams;
}

function stopGodrays(scene) {
  if (scene._godrays) {
    scene._godrays.forEach((b) => { scene.tweens.killTweensOf(b); b.destroy(); });
    scene._godrays = null;
  }
}

// Seed the DLSS gag visuals (sparkles + god rays) on scene create from the saved setting, so the
// effect persists across scenes - e.g. flip it on at the title screen and it's already running when
// a new game starts. Mirrors how setSceneCrt seeds the CRT filter. The holographic label lives only
// in the Settings panel, so it is intentionally not seeded here. Idempotent.
export function applyDlss(scene) {
  if (!settings.dlss) return;
  startDlssSparkles(scene);
  startGodrays(scene);
}

// Holographic shimmer on the DLSS label: cycle the fill through the hue wheel with a soft white
// glow. The timer self-removes once the text is destroyed (e.g. the panel closes).
function startHolo(scene, txt) {
  if (txt._holo) return;
  txt.setShadow(0, 0, '#ffffff', 8, false, true);
  const ev = scene.time.addEvent({ delay: 40, loop: true, callback: () => {
    if (!txt.active) { ev.remove(false); return; }
    const h = ((scene.time.now / 14) % 360) / 360;
    const col = Phaser.Display.Color.HSVToRGB(h, 0.55, 1);
    txt.setColor(Phaser.Display.Color.RGBToString(col.r, col.g, col.b));
  } });
  txt._holo = ev;
}

function stopHolo(txt) {
  if (txt._holo) { txt._holo.remove(false); txt._holo = null; }
  txt.setColor(INK).setShadow(0, 0, '#000000', 0, false, false);
}

// ------------------------------------------------------------------ Settings
// onHowToPlay: optional callback to open the tutorial from inside settings.
export function createSettingsOverlay(scene, { onHowToPlay } = {}) {
  let cont = null;
  const hide = () => { if (cont) { cont.destroy(true); cont = null; } };

  const show = () => {
    if (cont) return;
    sfx.play('claim');
    // Center on the live canvas, not a fixed 720: the wide (desktop) canvas is wider.
    const W = scene.scale.gameSize.width, CX = W / 2;
    const H = scene.scale.gameSize.height;
    cont = scene.add.container(0, 0).setDepth(60);
    const dim = scene.add.rectangle(CX, H / 2, W, H, 0x000000, 0.74).setInteractive();
    dim.on('pointerdown', hide);
    cont.add(dim);

    const cardW = 600, cardX = CX - cardW / 2, cardH = 740;
    const cardY = Math.max(36, Math.round((H - cardH) / 2));
    cont.add(roundRect(scene, cardX, cardY, cardW, cardH, CARD, 20));
    // Swallow taps on the card so clicks inside don't fall through to the dim scrim and dismiss.
    const block = scene.add.rectangle(CX, cardY + cardH / 2, cardW, cardH, 0x000000, 0.001).setInteractive();
    cont.add(block);
    cont.add(scene.add.text(CX, cardY + 46, 'Settings', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: INK }).setOrigin(0.5));
    makeClose(scene, cont, cardX + cardW - 40, cardY + 40, hide);

    const lx = cardX + 40;                 // left text column
    const rx = cardX + cardW - 40;         // right controls column
    const label = (y, s, size = '22px', color = INK) =>
      cont.add(scene.add.text(lx, y, s, { fontFamily: FONT, fontSize: size, fontStyle: 'bold', color }).setOrigin(0, 0.5));
    const section = (y, s) =>
      cont.add(scene.add.text(lx, y, s, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#7c8398' }).setOrigin(0, 0.5));

    // --- SOUND ---
    section(cardY + 108, 'SOUND');
    label(cardY + 152, 'Sound');
    // Toggle ON = sound enabled (not muted); intuitive read.
    makeToggle(scene, cont, rx - 74, cardY + 152, !settings.muted, (on) => settings.setMuted(!on));
    label(cardY + 210, 'Volume');
    makeSlider(scene, cont, lx + 140, cardY + 210, (rx - (lx + 140)), settings.volume, (v) => settings.setVolume(v));

    // --- DISPLAY ---
    section(cardY + 288, 'DISPLAY');
    label(cardY + 332, 'CRT filter');
    makeToggle(scene, cont, rx - 74, cardY + 332, settings.crt, (on) => {
      settings.setCrt(on);
      setSceneCrt(scene, on); // apply live to the scene underneath
    });

    // DLSS + Frame Gen: a purely cosmetic gag. ON = screen sparkles + a holographic label + a
    // triumphant fanfare. It does nothing to the actual rendering. The label text is held so the
    // holographic shimmer can drive its color.
    const dlssTxt = scene.add.text(lx, cardY + 380, 'DLSS + Frame Gen',
      { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: INK }).setOrigin(0, 0.5);
    cont.add(dlssTxt);
    makeToggle(scene, cont, rx - 74, cardY + 380, settings.dlss, (on) => {
      settings.setDlss(on);
      if (on) { sfx.play('dlss'); startDlssSparkles(scene); startGodrays(scene); startHolo(scene, dlssTxt); }
      else { stopDlssSparkles(scene); stopGodrays(scene); stopHolo(dlssTxt); }
    });
    // Reflect a persisted ON state when the panel (re)opens: shimmer the label and make sure the
    // sparkles + god rays are running (all idempotent).
    if (settings.dlss) { startHolo(scene, dlssTxt); startDlssSparkles(scene); startGodrays(scene); }

    // --- HELP ---
    section(cardY + 436, 'HELP');
    makeButton(scene, cont, CX, cardY + 490, cardW - 80, 64, 'How to Play', 0x39405c, INK, () => {
      hide();
      if (onHowToPlay) onHowToPlay();
    });

    // --- ABOUT --- (thin divider, version, credit)
    const dy = cardY + 548;
    cont.add(scene.add.rectangle(CX, dy, cardW - 80, 2, 0x39405c));
    cont.add(scene.add.text(CX, dy + 40, `Foothold  ${VERSION}`, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: INK }).setOrigin(0.5));
    cont.add(scene.add.text(CX, dy + 72, 'A Benzur micro game · Icons by Kenney (CC0)',
      { fontFamily: FONT, fontSize: '14px', color: '#7c8398' }).setOrigin(0.5));

    makeButton(scene, cont, CX, cardY + cardH - 52, 240, 64, 'Done', ACCENT, '#ffffff', hide);
  };

  return { show, hide };
}
