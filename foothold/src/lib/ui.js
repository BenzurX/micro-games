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
    const H = scene.scale.gameSize.height;
    cont = scene.add.container(0, 0).setDepth(60);
    const dim = scene.add.rectangle(360, H / 2, 720, H, 0x000000, 0.74).setInteractive();
    dim.on('pointerdown', hide); // tap outside the card to dismiss
    cont.add(dim);

    const cardW = 620, cardX = 360 - cardW / 2;
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
    const block = scene.add.rectangle(360, cardY + cardH / 2, cardW, cardH, 0x000000, 0.001).setInteractive();
    cont.add(block);

    cont.add(scene.add.text(360, cardY + 46, 'How to Play', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: INK }).setOrigin(0.5));
    makeClose(scene, cont, cardX + cardW - 40, cardY + 40, hide);
    // The goal, up top - the one thing a new player most needs.
    cont.add(scene.add.text(360, cardY + 100, 'Expand your territory, conquer your enemy.', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: INK }).setOrigin(0.5));
    cont.add(scene.add.text(360, cardY + 140, 'Win by capturing the enemy base, or by holding\nmore tiles after 12 rounds.',
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

    makeButton(scene, cont, 360, y + 48, 260, 68, 'Got it', ACCENT, '#ffffff', hide);
  };

  return { show, hide };
}

// ------------------------------------------------------------------ Settings
// onHowToPlay: optional callback to open the tutorial from inside settings.
export function createSettingsOverlay(scene, { onHowToPlay } = {}) {
  let cont = null;
  const hide = () => { if (cont) { cont.destroy(true); cont = null; } };

  const show = () => {
    if (cont) return;
    sfx.play('claim');
    const H = scene.scale.gameSize.height;
    cont = scene.add.container(0, 0).setDepth(60);
    const dim = scene.add.rectangle(360, H / 2, 720, H, 0x000000, 0.74).setInteractive();
    dim.on('pointerdown', hide);
    cont.add(dim);

    const cardW = 600, cardX = 360 - cardW / 2, cardH = 740;
    const cardY = Math.max(36, Math.round((H - cardH) / 2));
    cont.add(roundRect(scene, cardX, cardY, cardW, cardH, CARD, 20));
    // Swallow taps on the card so clicks inside don't fall through to the dim scrim and dismiss.
    const block = scene.add.rectangle(360, cardY + cardH / 2, cardW, cardH, 0x000000, 0.001).setInteractive();
    cont.add(block);
    cont.add(scene.add.text(360, cardY + 46, 'Settings', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: INK }).setOrigin(0.5));
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

    // --- HELP ---
    section(cardY + 408, 'HELP');
    makeButton(scene, cont, 360, cardY + 462, cardW - 80, 64, 'How to Play', 0x39405c, INK, () => {
      hide();
      if (onHowToPlay) onHowToPlay();
    });

    // --- ABOUT --- (thin divider, version, credit)
    const dy = cardY + 528;
    cont.add(scene.add.rectangle(360, dy, cardW - 80, 2, 0x39405c));
    cont.add(scene.add.text(360, dy + 40, `Foothold  ${VERSION}`, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: INK }).setOrigin(0.5));
    cont.add(scene.add.text(360, dy + 72, 'A Benzur micro game · Icons by Kenney (CC0)',
      { fontFamily: FONT, fontSize: '14px', color: '#7c8398' }).setOrigin(0.5));

    makeButton(scene, cont, 360, cardY + cardH - 52, 240, 64, 'Done', ACCENT, '#ffffff', hide);
  };

  return { show, hide };
}
