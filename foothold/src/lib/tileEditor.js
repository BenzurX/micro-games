// tileEditor.js: a hidden dev-only overlay for GameScene. Paints a tile's terrain (land / shoal
// / ocean / river) and scrubs the tide phase directly, so intended shoreline/tide layouts can be
// previewed and communicated by hand instead of read from generateShoals()/advanceTide() in code
// or played through rounds. See case-studies/capybara-delivery-vibejam.md - the idea this
// borrows is "build a small custom tool once, then do the tuning/communication work by hand
// inside it."
//
// Every edit writes straight into the scene's real state (scene.tiles, scene.tidePhaseIndex) and
// renders through the scene's own refresh() - there is no separate editor buffer, so nothing can
// silently drop an edit or drift from what the real game actually looks like. That directly
// avoids the failure mode the case study called out: a separate editor that lost work because it
// wasn't the same source of truth as the game it was editing.
//
// Activation is deliberately hidden from normal play (a D-E-V key sequence, or tapping the moon
// icon in the round timeline - wired by GameScene.buildRoundTimeline, which owns the moon's
// coordinates). Entering is only allowed on the human's own actionable turn, so it can never
// interrupt an in-flight AI turn/tide-wipe animation and have a scheduled callback clobber a
// hand-edited board underneath it.

const TERRAIN = [
  { key: 'land', label: 'Land' },
  { key: 'shoal', label: 'Shoal' },
  { key: 'ocean', label: 'Ocean' },
  { key: 'river', label: 'River' },
];

const PANEL_BG = 0x1b1e2b;
const BORDER = 0xff2fd6;  // unmistakably a dev tool - can never be confused with shipped UI
const ARMED = 0xff2fd6;
const IDLE = 0x39405c;
const FONT = 'system-ui, -apple-system, sans-serif';

// A small self-contained button (graphics + label + hit rect). Returns { setColor } so callers
// can re-tint it (e.g. to show which palette entry is armed).
function makeBtn(scene, cont, x, y, w, h, label, onTap) {
  const g = scene.add.graphics();
  const draw = (color) => { g.clear().fillStyle(color, 1).fillRoundedRect(x, y, w, h, 6); };
  draw(IDLE);
  const txt = scene.add.text(x + w / 2, y + h / 2, label, {
    fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#e7e9f0',
  }).setOrigin(0.5);
  const hit = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
  hit.on('pointerdown', onTap);
  cont.add([g, txt, hit]);
  return { setColor: draw, setLabel: (t) => txt.setText(t) };
}

// Builds the plain-text board dump the Export button copies/logs: one row of terrain codes per
// board row, plus the current tide phase. Deliberately a compact text grid (not raw JSON) - it's
// meant to be pasted straight into chat so a layout can be described precisely instead of read
// off a screenshot, which can misrepresent tide-only visuals like shimmer/foam (see paintTile()).
function buildExportText(scene, tidePhases) {
  const phase = tidePhases[scene.tidePhaseIndex];
  const lines = [
    `Foothold ${scene.level} layout export - tide: ${phase ? phase.label : scene.tidePhaseIndex}` +
      (tidePhases.length ? ` (phase ${scene.tidePhaseIndex + 1}/${tidePhases.length})` : ''),
    'Legend: . land  ~ shoal  O ocean  R river  H home',
  ];
  scene.tiles.forEach((row, r) => {
    const cells = row.map((t) => {
      if (t.home) return 'H';
      if (t.ocean) return 'O';
      if (t.river) return 'R';
      if (t.shoal) return '~';
      return '.';
    });
    lines.push(`Row ${r}: ${cells.join(' ')}`);
  });
  return lines.join('\n');
}

// Wires the D-E-V key sequence and exposes scene.toggleDevMode() for the moon-tap trigger.
// `tidePhases` is the scene's TIDE_PHASES array, passed in (not imported) to avoid a circular
// import between this module and GameScene.js.
export function attachTileEditor(scene, { tidePhases = [] } = {}) {
  let panel = null;
  let hitRects = [];
  let armed = null;
  let savedInputLocked = false;

  function toggleDevMode() {
    if (!scene.devMode) {
      // Only allow ENTERING on the human's own actionable turn - never mid AI-turn or
      // tide-wipe animation, so a scheduled delayedCall (endAITurn/advanceTide) can't fire
      // underneath the editor and stomp a hand-edited board (see module comment above).
      if (scene.current !== 1 || scene.inputLocked || scene.gameOver) return;
      scene.devMode = true;
      savedInputLocked = scene.inputLocked;
      scene.inputLocked = true; // freeze normal tap-to-move + End Turn while editing
      buildPanel();
      buildHitRects();
    } else {
      scene.devMode = false;
      armed = null;
      scene.inputLocked = savedInputLocked;
      destroyPanel();
      destroyHitRects();
    }
    scene.refresh();
  }
  scene.toggleDevMode = toggleDevMode;

  // ---- keyboard trigger: type D E V within ~1s ----
  const seq = ['d', 'e', 'v'];
  let progress = 0;
  let seqTimeout = null;
  scene.input.keyboard.on('keydown', (ev) => {
    const k = ev.key.toLowerCase();
    if (k === seq[progress]) {
      progress += 1;
      clearTimeout(seqTimeout);
      if (progress === seq.length) {
        progress = 0;
        toggleDevMode();
      } else {
        seqTimeout = setTimeout(() => { progress = 0; }, 1000);
      }
    } else {
      progress = k === seq[0] ? 1 : 0;
    }
  });

  // ---- paint-mode hit zones ----
  // One transparent rect per non-home tile, built only while dev mode is active and destroyed on
  // exit. Kept fully separate from the real tile rects/onTilePointerDown so painting can never
  // change normal gameplay input behavior.
  function buildHitRects() {
    scene.forEachTile((t, r, c) => {
      if (t.home) return;
      const v = scene.views[r][c];
      const hit = scene.add.rectangle(v.rect.x, v.rect.y, v.rect.width, v.rect.height, 0x000000, 0.001)
        .setDepth(900).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => paintTile(r, c));
      hitRects.push(hit);
    });
  }
  function destroyHitRects() {
    hitRects.forEach((h) => h.destroy());
    hitRects = [];
  }

  // Sets the tile's terrain flags directly (mirrors the mutual exclusivity the real generators
  // already enforce: ocean/river tiles are never owned or resourced, per openForNode/refresh()).
  function paintTile(r, c) {
    if (!armed) return;
    const t = scene.tiles[r][c];
    t.ocean = armed === 'ocean';
    t.shoal = armed === 'shoal';
    t.river = armed === 'river';
    t.bridge = false;
    if (armed === 'ocean' || armed === 'river') { t.owner = 0; t.resource = null; }

    // Rebuild this tile's water FX (swell shimmer / flooded-fringe ripple + foam) to match its
    // new terrain, and recompute the shoreline's rounded corners board-wide, so a screenshot of
    // a painted layout shows the real shimmer/curve instead of a flat color or stale leftover
    // shimmer from what the tile used to be (see GameScene.teardownTileFX/setupOceanTileFX).
    if (scene.level === 'ocean') {
      scene.teardownTileFX(r, c);
      if (t.ocean) scene.setupOceanTileFX(r, c);
      else if (t.shoal) scene.setupShoalTileFX(r, c);
      scene.computeCornerPlan();
      scene.updateOceanSwellMasks();
      scene.drawShorelineCorners();
    }
    scene.refresh();
  }

  // ---- the panel ----
  // Positioned over the action legend (scene.rail / scene.legendTop, set by computeLayout())
  // rather than the top-left corner, so the panel never sits on top of the board itself while
  // painting tiles.
  function buildPanel() {
    const cont = scene.add.container(0, 0).setDepth(1000);
    const x = scene.rail.x, y = scene.legendTop, w = scene.rail.w;
    const showPhases = scene.level === 'ocean' && tidePhases.length > 0;
    const rows = 1 + (showPhases ? 1 : 0) + 1 + 1; // terrain, [phase], export, exit
    const h = 40 + rows * 44 + 8;

    const bg = scene.add.graphics();
    bg.fillStyle(PANEL_BG, 0.96).fillRoundedRect(x, y, w, h, 10);
    bg.lineStyle(2, BORDER, 1).strokeRoundedRect(x, y, w, h, 10);
    cont.add(bg);
    cont.add(scene.add.text(x + 12, y + 10, 'DEV MODE', {
      fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#ff8fe8',
    }));

    let rowY = y + 40;
    const terrainBtns = {};
    TERRAIN.forEach((opt, i) => {
      const bx = x + 12 + i * 62;
      terrainBtns[opt.key] = makeBtn(scene, cont, bx, rowY, 56, 32, opt.label, () => {
        armed = armed === opt.key ? null : opt.key;
        TERRAIN.forEach((o) => terrainBtns[o.key].setColor(o.key === armed ? ARMED : IDLE));
      });
    });
    rowY += 44;

    if (showPhases) {
      const phaseBtns = [];
      tidePhases.forEach((phase, i) => {
        const bx = x + 12 + i * 62;
        const btn = makeBtn(scene, cont, bx, rowY, 56, 32, `${i}`, () => {
          scene.tidePhaseIndex = i;
          // The shoreline's rounded-corner shape is fixed by terrain (isShoreWater), not tide,
          // so only the fill color needs to change here - refresh() redraws it via its own
          // drawShorelineCorners() call. Mirrors what advanceTide() does on a real tide change.
          scene.refresh();
          phaseBtns.forEach((pb, j) => pb.setColor(j === i ? ARMED : IDLE));
        });
        phaseBtns.push(btn);
      });
      phaseBtns.forEach((pb, j) => pb.setColor(j === scene.tidePhaseIndex ? ARMED : IDLE));
      rowY += 44;
    }

    const exportBtn = makeBtn(scene, cont, x + 12, rowY, w - 24, 32, 'Export Layout', () => {
      const text = buildExportText(scene, tidePhases);
      console.log(text); // eslint-disable-line no-console
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      exportBtn.setLabel('Copied! (also in console)');
      setTimeout(() => exportBtn.setLabel('Export Layout'), 1400);
    });
    rowY += 44;

    makeBtn(scene, cont, x + 12, rowY, w - 24, 32, 'Exit Dev Mode', () => toggleDevMode());

    panel = cont;
  }
  function destroyPanel() {
    if (panel) { panel.destroy(true); panel = null; }
  }
}
