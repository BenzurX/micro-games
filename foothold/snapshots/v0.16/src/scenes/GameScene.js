// GameScene: the whole prototype loop lives here for now. Once the loop is proven
// fun we'll extract reusable pieces (board, economy, AI) into /src/lib and the
// template. Kept in one file while the design is still moving.

import { sfx } from '../lib/sfx.js';
import { setSceneCrt } from '../lib/CrtPipeline.js';
import { settings } from '../lib/settings.js';
import { createTutorialOverlay, createSettingsOverlay, applyDlss } from '../lib/ui.js';

// ---- Design constants (mirror DESIGN.md; structure locked, NUMBERS tunable by playtest) ----
// Four actions, one job per resource (see DESIGN.md "Actions & the resource split"):
//   Claim  (gold)   = buy an EMPTY neutral tile.
//   Build  (wood)   = buy a neutral tile that HAS a resource node.
//   Siege  (gold)   = take an enemy tile (costs 2x a claim).
//   Upgrade(stone)  = improve one of your OWN resource nodes to DOUBLE its output.
const GRID_W = 6;               // columns (portrait board)
const GRID_H = 9;               // rows
const MAX_ROUNDS = 12;          // each side gets this many turns, then most tiles wins

// River runs left→right through the middle band of rows; one tile per column, meandering
// ≤1 row per step so it always fully separates the top (enemy) and bottom (player) halves.
const RIVER_BAND = [3, 5];      // inclusive row range the river is allowed to occupy
const BRIDGE_COUNT = 2;         // claimable/passable crossings cut into the river

const CLAIM_COST = 5;             // GOLD to claim an empty neutral tile
const BUILD_COST = 5;            // WOOD to build (buy a neutral resource tile)
const SIEGE_COST = CLAIM_COST * 2; // GOLD to siege any enemy tile (2x a claim; no per-tile defense now)
const SIEGE_NODE_WOOD = BUILD_COST; // extra WOOD to capture an enemy RESOURCE NODE - you re-develop it,
                                    // mirroring Build. Also, a captured node loses its upgrade (see applyMove).
const HOME_SIEGE_COST = 50;       // GOLD to siege the enemy HOME tile (deliberately steep)
const UPGRADE_COST = 5;           // STONE to upgrade a resource node (doubles its per-turn output)

const NODE_INCOME = 5;          // per-turn yield of a matching resource node (DOUBLED once upgraded)
const SPECIAL_INCOME = 3;       // per-turn yield of EACH resource from a special (★) node (also doubles when upgraded)
const RESOURCE_CAP = 80;        // hard ceiling on every stockpile - income past this is lost
const BASE_INCOME = 2;          // per-turn yield of EACH resource from your home tile
const START = { wood: 10, gold: 10, stone: 5 }; // each player's opening stockpile
// AI (player 2) always moves second each round, which is a tempo disadvantage; this bump
// offsets it. Tuned against scripts/balance-harness.mjs (src/lib/rules.js) - re-tune both
// together if AI_MAX_ACTIONS or resource costs change.
const P2_START_BONUS = { wood: 14, gold: 14, stone: 7 };

const AI_MAX_ACTIONS = 5;       // cap so the AI can't run away in a single turn

// Action highlight colors (mirror the DESIGN.md / mockup legend).
const ACTION_COLOR = {
  claim:   0xffce3a, // gold
  build:   0x57c97a, // green
  upgrade: 0xb06bff, // purple
  siege:   0xff6a3d, // red/orange
};

// Board metrics. Square tiles; 6 wide x 9 tall. WHERE the board sits is no longer a
// module constant: computeLayout() reads the canvas shape and picks a portrait (mobile)
// or wide (tablet/desktop) composition, setting this.originX / this.originY per mode.
// TILE is `let` (not const): portrait grows it to fill the phone's width/height (see
// computeLayout), wide resets it to the classic 82. Every draw call reads it at runtime,
// and per-tile icon/text sizes scale by this.tileK so bigger tiles don't dwarf their art.
const BASE_TILE = 82;
let TILE = BASE_TILE;
let BOARD_W = GRID_W * TILE;           // 492 at the base size
let BOARD_H = GRID_H * TILE;           // 738 at the base size

// Owner tile fill colours.
const FILL = { 0: 0x2b2f45, 1: 0x274a9d, 2: 0x9d2f3a };
const RIVER_COLOR = 0x264f6e;   // deep water (main body of the flowing river ribbon)
const RIVER_TILE = 0x1a1c29;    // river-tile background: same hue as the neutral tile, just darker
                                // (reads as unclaimable). Bridges keep the normal shade - they ARE claimable.

// Per-resource tint applied to the white icon SVGs (HUD counters + on-board nodes + legend),
// so one icon file reads in each resource's colour and stays on-palette.
const TINT = { gold: 0xf2c14e, wood: 0xb5793a, stone: 0xb9c2d0, special: 0x5ad1c8 };

// Counter color when a stockpile has hit RESOURCE_CAP - a darker orange, deliberately distinct
// from the spend amber (#f2b23a) so "you are maxed out (income is being wasted)" reads clearly
// and never gets confused with the transient "you just spent" pulse.
const CAP_COLOR = '#f2922e';

// Display serif (Grenze) - used ONLY on the win/lose result, the confirm-dialog heading, and
// the action buttons. Every other in-game label (HUD counters, income, tile text) stays on the
// system font so it reads cleanly under the CRT filter. Georgia/serif fall back if the webfont
// hasn't loaded (main.js waits for it before booting).
const HEAD = "'Grenze', Georgia, serif";

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // Shared mixer (title + game + settings all play through one Sfx). Muted/volume come from
    // the persisted settings via the mixer, so nothing to seed here.
    this.sfx = sfx;
    // Web Audio is blocked until a user gesture - resume it on the very first tap.
    this.input.once('pointerdown', () => this.sfx.unlock());
    this.makeSparkTexture();
    this.makeGlowTexture();

    this.setupState();
    this.computeLayout();
    this.buildBoard();
    // Tapping anywhere that isn't a tile (river, margins, HUD) drops the current tile
    // selection so a stale preview tooltip can't linger after a touch player looks away.
    this.input.on('pointerdown', (pointer, hitObjects) => {
      if (hitObjects.length === 0) this.hideTooltip();
    });
    this.buildRiver();
    this.buildHud();
    this.buildControls();
    this.buildGameOverOverlay();
    this.buildNewGameConfirm();
    // Shared modal panels. Settings' "How to Play" opens the same tutorial the title screen uses.
    this.tutorial = createTutorialOverlay(this);
    this.settingsPanel = createSettingsOverlay(this, { onHowToPlay: () => this.tutorial.show() });
    this.applyCrt();

    this.startPlayerTurn();
  }

  // Attach (or not) the CRT post-processing shader to the main camera, based on the saved
  // setting. All the guard logic (master killswitch, WebGL-only, live add/remove) lives in
  // setSceneCrt so the title screen and the Settings toggle share exactly one code path.
  applyCrt() {
    // Seed the filter from the saved setting; the Settings toggle flips it live via setSceneCrt.
    setSceneCrt(this, settings.crt);
    applyDlss(this); // and the DLSS gag (sparkles + god rays), so it carries over from the title screen
  }

  // Mobile-first vertical layout. The width is fixed at 720, but the height matches the
  // device aspect (see main.js), so here we split that height into three anchored zones:
  //   • top    - the HUD (resource cards + gear + turn/score text), pinned to the top.
  //   • bottom - the action legend + End Turn button, pinned to the bottom.
  //   • middle - the board, centered in whatever space is left between them.
  // On a tall phone the extra height falls into the middle gap instead of dead letterbox
  // bars, and the legend/button always sit at the very bottom where the thumb reaches.
  computeLayout() {
    const W = this.scale.gameSize.width;
    const H = this.scale.gameSize.height;
    // Mode is decided by the canvas shape main.js booted with: portrait = the mobile-first
    // stacked layout; wide (landscape tablet/desktop) = board LEFT + an info rail RIGHT.
    this.isWide = W > H;

    if (!this.isWide) {
      // --- Portrait (mobile): HUD pinned top, legend + buttons pinned bottom, board between ---
      const hudBottom = 228;            // bottom of the HUD block (tile bar + pips) + a small pad; kept tight
                                        // so the board's centering slack splits evenly above and below it
      this.legendRowH = 68;             // taller rows in portrait so the bigger mobile legend text breathes
      const legRowsH = 2 * this.legendRowH + 8; // two legend rows + the 8px gap between them
      const gapLegBtn = 16;             // space between the legend block and the End Turn button
      const btnH = 96;                  // End Turn button height
      const bottomMargin = 24;          // breathing room below the button, off the screen edge
      const bottomZoneH = legRowsH + gapLegBtn + btnH + bottomMargin;

      this.legendTop = H - bottomZoneH;                 // top edge of the first legend row
      this.buttonY = H - bottomMargin - btnH / 2;       // center Y of the End Turn button

      // Grow the tiles to fill the phone: as wide as the canvas allows (20px side margins)
      // and as tall as the HUD-to-legend region allows (24px of breathing room), whichever
      // bites first. Never below the classic 82 so squat canvases don't shrink the board.
      const sidePad = 20;
      TILE = Math.max(BASE_TILE, Math.floor(Math.min(
        (W - sidePad * 2) / GRID_W,
        (this.legendTop - hudBottom - 24) / GRID_H,
      )));
      BOARD_W = GRID_W * TILE;
      BOARD_H = GRID_H * TILE;
      this.tileK = TILE / BASE_TILE;    // per-tile art (icons, badges, income text) scales by this

      // Center the board in the middle region; never let it push into the HUD.
      const midTop = hudBottom, midBot = this.legendTop;
      this.originX = (W - BOARD_W) / 2;
      this.originY = Math.max(hudBottom, Math.round(midTop + (midBot - midTop - BOARD_H) / 2));

      // The "rail" in portrait is simply the full-width content strip the HUD/legend/buttons
      // already used, so both modes share one coordinate source in buildHud/buildControls.
      this.rail = { x: 20, w: W - 40, top: 24 };
      this.roundY = 120;                // top of the tile-bar block (tightened toward the resource cards)
      this.legendCols = 2;              // 2x2 legend grid at the bottom
      return;
    }

    // --- Wide (tablet/desktop): board left, everything else stacked in a right-hand rail ---
    // Rail order (per design): resources -> round info -> legend (1x4) -> New Game / End Turn.
    TILE = BASE_TILE;                                      // classic tile size (reset: TILE is module state)
    BOARD_W = GRID_W * TILE;
    BOARD_H = GRID_H * TILE;
    this.tileK = 1;
    const gap = 48;                                        // board <-> rail gutter
    const railW = Math.min(620, W - BOARD_W - gap - 80);   // cap so text lines stay readable
    const groupW = BOARD_W + gap + railW;
    this.originX = Math.round((W - groupW) / 2);           // center board+rail as one group
    this.originY = Math.round((H - BOARD_H) / 2);          // board vertically centered
    this.rail = { x: this.originX + BOARD_W + gap, w: railW, top: this.originY };
    this.roundY = this.rail.top + 76 + 26;                 // just below the resource cards
    this.legendTop = this.roundY + 134;                    // below the tile bar + pips
    this.legendCols = 1;                                   // stacked 1x4 legend
    this.legendRowH = 60;                                  // wide rail has room; keep the compact row
    this.buttonY = this.originY + BOARD_H - 48;            // buttons bottom-aligned with board
  }

  // A soft white dot used for every particle burst; tinted per action at emit time.
  makeSparkTexture() {
    if (this.textures.exists('spark')) return;
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
    g.generateTexture('spark', 16, 16);
    g.destroy();
  }

  // A soft radial glow (concentric circles at rising alpha, since Graphics has no true
  // gradient fill) for the Total Victory sunburst. Tinted gold + additive-blended at use time.
  makeGlowTexture() {
    if (this.textures.exists('glow')) return;
    const R = 128;
    const g = this.make.graphics({ add: false });
    for (let r = R; r >= 2; r -= 2) {
      const t = 1 - r / R;
      g.fillStyle(0xffffff, t * t * 0.5);
      g.fillCircle(R, R, r);
    }
    g.generateTexture('glow', R * 2, R * 2);
    g.destroy();
  }

  // ---------------------------------------------------------------- state / board gen
  setupState() {
    this.round = 1;
    this.current = 1;          // 1 = human, 2 = AI
    this.inputLocked = false;  // true during AI turn / game over
    this.gameOver = false;
    this.hasActed = false;     // has the player done anything yet? gates the New Game confirm

    this.resources = {
      1: { ...START },
      2: {
        wood: START.wood + P2_START_BONUS.wood,
        gold: START.gold + P2_START_BONUS.gold,
        stone: START.stone + P2_START_BONUS.stone,
      },
    };
    // Last-rendered player stockpile, so refresh() can tell a spend from an income and pulse
    // the counter accordingly (amber down / green up). Seeded so the first render is neutral.
    this.prevResources = { ...this.resources[1] };

    // tiles[r][c] = { owner, resource, upgraded, home, river, bridge }
    this.tiles = [];
    for (let r = 0; r < GRID_H; r++) {
      const row = [];
      for (let c = 0; c < GRID_W; c++) {
        row.push({ owner: 0, resource: null, upgraded: false, home: false, river: false, bridge: false });
      }
      this.tiles.push(row);
    }

    // Home corners: player (1) bottom-right, AI (2) top-left.
    this.homePlayer = { r: GRID_H - 1, c: GRID_W - 1 };
    this.homeAI = { r: 0, c: 0 };
    this.tiles[this.homePlayer.r][this.homePlayer.c].owner = 1;
    this.tiles[this.homePlayer.r][this.homePlayer.c].home = true;
    this.tiles[this.homeAI.r][this.homeAI.c].owner = 2;
    this.tiles[this.homeAI.r][this.homeAI.c].home = true;

    this.generateRiver();
    this.placeNodes();
  }

  // A meandering left→right river: one water tile per column within RIVER_BAND, stepping ≤1
  // row between columns so it always fully separates the top and bottom halves. Entry and exit
  // rows differ (asymmetric each game). Two columns are cut into bridges instead of water.
  generateRiver() {
    const [lo, hi] = RIVER_BAND;
    const rnd = (a, b) => Phaser.Math.Between(a, b);
    this.riverRow = new Array(GRID_W);
    const start = rnd(lo, hi);
    let end = rnd(lo, hi);
    while (end === start) end = rnd(lo, hi);
    this.riverRow[0] = start;
    for (let c = 1; c < GRID_W; c++) {
      const prev = this.riverRow[c - 1];
      let row = Phaser.Math.Clamp(prev + rnd(-1, 1), lo, hi);
      // Keep enough budget to still reach the exit row within the remaining columns.
      const stepsLeft = (GRID_W - 1) - c;
      if (Math.abs(end - row) > stepsLeft) row = prev + Math.sign(end - prev);
      this.riverRow[c] = row;
    }

    for (let c = 0; c < GRID_W; c++) this.tiles[this.riverRow[c]][c].river = true;
    // Bridges: one in the left half, one in the right half, so crossings are spaced apart.
    const b1 = rnd(0, Math.floor(GRID_W / 2) - 1);
    const b2 = rnd(Math.ceil(GRID_W / 2), GRID_W - 1);
    for (const c of [b1, b2]) {
      const t = this.tiles[this.riverRow[c]][c];
      t.river = false;
      t.bridge = true;
    }
  }

  // Which half a cell belongs to: 2 = top (AI side), 1 = bottom (player side), 0 = on the river.
  halfOf(r, c) {
    if (this.tiles[r][c].river || this.tiles[r][c].bridge) return 0;
    return r < this.riverRow[c] ? 2 : 1;
  }

  hasAdjacentNode(r, c) {
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= GRID_H || nc < 0 || nc >= GRID_W) continue;
      if (this.tiles[nr][nc].resource) return true;
    }
    return false;
  }

  openForNode(r, c) {
    const t = this.tiles[r][c];
    return !t.home && !t.river && !t.bridge && !t.resource;
  }

  // Place `count` nodes of `type` on the given half. Prefer non-adjacent cells (no clumping);
  // if a thin half can't fit the budget that way, fall back to any open cell so the two sides
  // keep the SAME economy (balance wins over the anti-clump preference in the rare tight case).
  placeIn(side, type, count) {
    const gather = () => {
      const cells = [];
      for (let r = 0; r < GRID_H; r++) {
        for (let c = 0; c < GRID_W; c++) {
          if (this.halfOf(r, c) === side && this.openForNode(r, c)) cells.push({ r, c });
        }
      }
      return Phaser.Utils.Array.Shuffle(cells);
    };
    let placed = 0;
    for (const { r, c } of gather()) {          // pass 1: strictly non-adjacent
      if (placed >= count) break;
      if (this.hasAdjacentNode(r, c)) continue;
      this.tiles[r][c].resource = type;
      placed += 1;
    }
    for (const { r, c } of gather()) {          // pass 2 (rare): fill to budget, allow adjacency
      if (placed >= count) break;
      this.tiles[r][c].resource = type;
      placed += 1;
    }
  }

  // Same economy each side of the river (balanced), positions rolled per half (asymmetric).
  placeNodes() {
    // Specials first so they claim the contested near-river spots before the economy fills in.
    this.placeSpecialNearRiver(2); // one just above the water (AI side)
    this.placeSpecialNearRiver(1); // one just below the water (player side)

    for (const side of [1, 2]) {
      this.placeIn(side, 'wood', 2);
      this.placeIn(side, 'gold', 2);
      this.placeIn(side, 'stone', 2);
    }

    // Economic-access guarantee (balance): each side must have at least one wood AND one gold
    // node within 4 tiles of its home, so a player can never start with both of a resource
    // stranded on the far side of the map. Applied symmetrically for fairness. This replaces the
    // older "any node within 2 tiles" opener guarantee - the wood+gold-within-4 rule is a stronger,
    // more targeted promise, so the near-2 rule was redundant.
    for (const [home, side] of [[this.homePlayer, 1], [this.homeAI, 2]]) {
      this.ensureTypeNearHome(home, side, 'wood', 4);
      this.ensureTypeNearHome(home, side, 'gold', 4);
    }
  }

  // Guarantee at least one node of `type` within `maxDist` (Manhattan) of a home. Rather than
  // ADD a node (which would unbalance the fixed per-half economy of 2 wood / 2 gold / 2 stone),
  // we RELOCATE the farthest same-type node on that side into an open near-home cell, so the
  // side's node count stays intact - it just guarantees one is reachable early.
  ensureTypeNearHome(home, side, type, maxDist) {
    const dist = (r, c) => Math.abs(r - home.r) + Math.abs(c - home.c);
    const own = [];
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        if (this.tiles[r][c].resource === type && this.halfOf(r, c) === side) {
          if (dist(r, c) <= maxDist) return; // already satisfied - nothing to do
          own.push({ r, c, d: dist(r, c) });
        }
      }
    }
    if (!own.length) return; // no same-type node on this side to move (shouldn't happen)

    // Candidate landing cells: open, on this side, within range. Prefer non-adjacent (anti-clump).
    const near = [];
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        if (this.halfOf(r, c) === side && this.openForNode(r, c) && dist(r, c) <= maxDist) {
          near.push({ r, c });
        }
      }
    }
    if (!near.length) return;
    Phaser.Utils.Array.Shuffle(near);
    const target = near.find((n) => !this.hasAdjacentNode(n.r, n.c)) || near[0];
    own.sort((a, b) => b.d - a.d);   // move the FARTHEST same-type node inward
    const src = own[0];
    this.tiles[src.r][src.c].resource = null;
    this.tiles[target.r][target.c].resource = type;
  }

  // A special node one row off the water on the given side - contested, both must push for it.
  placeSpecialNearRiver(side) {
    const cands = [];
    for (let c = 0; c < GRID_W; c++) {
      const r = side === 2 ? this.riverRow[c] - 1 : this.riverRow[c] + 1;
      if (r < 0 || r >= GRID_H) continue;
      const t = this.tiles[r][c];
      if (t.home || t.river || t.bridge || t.resource) continue;
      cands.push({ r, c });
    }
    Phaser.Utils.Array.Shuffle(cands);
    for (const { r, c } of cands) {
      if (this.hasAdjacentNode(r, c)) continue;
      this.tiles[r][c].resource = 'special';
      return;
    }
    if (cands.length) this.tiles[cands[0].r][cands[0].c].resource = 'special'; // fallback: ignore spacing
  }

  buildBoard() {
    // One rectangle + icon image + upgrade marker per cell. River tiles are non-interactive.
    this.views = [];
    for (let r = 0; r < GRID_H; r++) {
      const row = [];
      for (let c = 0; c < GRID_W; c++) {
        const x = this.originX + c * TILE + TILE / 2;
        const y = this.originY + r * TILE + TILE / 2;

        const rect = this.add.rectangle(x, y, TILE - 4, TILE - 4, FILL[0]);
        if (!this.tiles[r][c].river) {
          rect.setInteractive({ useHandCursor: true });
          rect.on('pointerdown', () => this.onTilePointerDown(r, c));
          // Touch has no real hover: Phaser fires pointerover on touchstart and pointerout on
          // release, so a naive hover wire-up shows the tooltip on press and kills it the instant
          // the finger lifts - before a second tap can land. Gate hover to mouse (wasTouch=false);
          // touch gets its preview from onTilePointerDown instead, which keeps it up across taps.
          rect.on('pointerover', (pointer) => { if (!pointer.wasTouch) this.showTooltip(r, c); });
          rect.on('pointerout', (pointer) => { if (!pointer.wasTouch) this.hideTooltip(); });
        }

        // Node/home icon: a tinted SVG image, texture + tint set per tile in refresh().
        // Starts hidden with a placeholder texture (empty tiles show nothing).
        // Depth 4 keeps icons above the water ribbon (depth 1-2) at any diagonal overlap.
        const k = this.tileK; // bigger tiles (mobile fill) get proportionally bigger art
        const icon = this.add.image(x, y, 'ic_gold').setDisplaySize(50 * k, 50 * k).setVisible(false).setOrigin(0.5).setDepth(4);

        // Upgrade marker (top-right): a purple lift icon, shown when the node has been upgraded.
        const badge = this.add.image(x + TILE / 2 - 17 * k, y - TILE / 2 + 17 * k, 'ic_upgrade')
          .setDisplaySize(32 * k, 32 * k).setTint(ACTION_COLOR.upgrade).setVisible(false).setOrigin(0.5).setDepth(5);

        // Income label (bottom-right): white text on an OWNED resource node showing what it earns
        // per turn (e.g. "+5", "+10" upgraded, "+3 all" for a special). Set in refresh().
        const income = this.add.text(x + TILE / 2 - 6, y + TILE / 2 - 4, '', {
          fontFamily: 'system-ui, sans-serif', fontSize: `${Math.round(17 * k)}px`, fontStyle: 'bold', color: '#ffffff',
        }).setOrigin(1, 1).setVisible(false).setDepth(6);

        row.push({ rect, icon, badge, income });
      }
      this.views.push(row);
    }
  }

  // Draw the river as one continuous, organic water ribbon flowing left→right through the
  // river/bridge columns, instead of solid-blue squares. A Catmull-Rom spline through each
  // column's water-tile center gives smooth, self-connecting curves at the diagonal steps.
  // Treatment is "Arcane flow": very dark deep water with a soft cyan glow and two bright,
  // animated dashed streaks that drift downstream (redrawn each frame in drawRiverFlow from
  // the scene clock). Bridges are drawn on top as N–S plank decks (see drawBridges).
  buildRiver() {
    const cx = (c) => this.originX + c * TILE + TILE / 2;
    const cy = (r) => this.originY + r * TILE + TILE / 2;

    // Spine points clamped to the board edges so the river is cut cleanly at the frame
    // (the end caps sit vertical on the edge) instead of spilling off the board.
    const pts = [new Phaser.Math.Vector2(this.originX, cy(this.riverRow[0]))];
    for (let c = 0; c < GRID_W; c++) pts.push(new Phaser.Math.Vector2(cx(c), cy(this.riverRow[c])));
    pts.push(new Phaser.Math.Vector2(this.originX + BOARD_W, cy(this.riverRow[GRID_W - 1])));

    const spline = new Phaser.Curves.Spline(pts);
    const line = spline.getPoints(GRID_W * 18); // dense sampling → smooth curve

    const g = this.add.graphics().setDepth(1);
    // Water body as filled polygons (not strokes) so the width can VARY along the run: skinnier
    // where the flow cuts diagonally between rows, fuller where it runs straight across. Three
    // narrowing layers (dark banks → water → lit channel) give it depth.
    const fillRibbon = (baseHalf, color, alpha = 1) => {
      const topE = [], botE = [];
      for (let i = 0; i < line.length; i++) {
        const p = line[i];
        const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
        const tx = b.x - a.x, ty = b.y - a.y, len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len, ny = tx / len;                      // unit normal to the flow
        const diag = Math.abs(ty) / (Math.abs(tx) + Math.abs(ty) || 1); // 0 straight → ~0.5 at a 45° step
        const hw = baseHalf * (1 - 0.6 * diag);                   // pinch in a little on diagonals
        topE.push({ x: p.x + nx * hw, y: p.y + ny * hw });
        botE.push({ x: p.x - nx * hw, y: p.y - ny * hw });
      }
      g.fillStyle(color, alpha);
      g.fillPoints(topE.concat(botE.reverse()), true);
    };
    // Deep water: dark outer body with a slightly lighter inner channel to fake a vertical
    // gradient without a real gradient primitive (Graphics has none).
    fillRibbon(TILE * 0.33, 0x0c1c2c);   // deep water / bank shadow
    fillRibbon(TILE * 0.24, 0x16324a);   // lit central channel

    // Soft cyan glow along the centerline (two stacked low-alpha wide strokes fake the blur).
    const glow = (width, alpha) => {
      g.lineStyle(width, 0x3fe0ff, alpha);
      g.beginPath();
      line.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.strokePath();
    };
    glow(TILE * 0.16, 0.10);
    glow(TILE * 0.10, 0.12);

    // Precompute the two animated streaks (static geometry: a constant perpendicular offset plus
    // a small spatial sine wave). Only their dash on/off pattern moves over time, so we build the
    // polyline + cumulative arc length once here and just re-decide dash membership each frame.
    const buildStreak = (off, amp, phase) => {
      const pts = [];
      for (let i = 0; i < line.length; i++) {
        const p = line[i];
        const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
        const tx = b.x - a.x, ty = b.y - a.y, len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len, ny = tx / len;                 // unit normal to the flow
        const o = off + Math.sin(i * 0.45 + phase) * amp;
        pts.push({ x: p.x + nx * o, y: p.y + ny * o });
      }
      const cum = [0];
      for (let i = 1; i < pts.length; i++) {
        cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      }
      return { pts, cum };
    };
    // Dash sizes/speeds are TILE-relative (staged at TILE=64). Speed = staged px/s * 0.25 (the
    // "quarter speed" the streaks drift downstream); staged streaks were dashoffset 200 over
    // 3.4s and 4.6s, so base px/s = 200/3.4 and 200/4.6.
    const k = TILE / 64;
    this.riverStreaks = [
      { s: buildStreak(-TILE * 0.08, TILE * 0.04, 0.0), dash: 16 * k, gap: 30 * k,
        speed: (200 / 3.4) * 0.25 * k, width: 2.2, color: 0x6fefff, alpha: 0.85 },
      { s: buildStreak(TILE * 0.08, TILE * 0.04, 2.0), dash: 10 * k, gap: 34 * k,
        speed: (200 / 4.6) * 0.25 * k, width: 1.8, color: 0x9df6ff, alpha: 0.60 },
    ];
    // Streaks live on their own graphics layer (above the water body, below bridges) so we can
    // clear+redraw just them each frame without touching the static ribbon.
    if (this.riverFlowGfx) this.riverFlowGfx.destroy();
    this.riverFlowGfx = this.add.graphics().setDepth(1);
    this.drawRiverFlow();

    // Bridge decks are their own layer so they redraw with owner color in refresh().
    this.bridges = [];
    for (let c = 0; c < GRID_W; c++) {
      if (this.tiles[this.riverRow[c]][c].bridge) {
        this.bridges.push({ r: this.riverRow[c], c, x: cx(c), y: cy(this.riverRow[c]) });
      }
    }
    this.bridgeGfx = this.add.graphics().setDepth(2);
    this.drawBridges();
  }

  // Redraw the animated flow streaks for the current frame. Each streak is a static polyline;
  // the "flow" is a moving dash offset (px, derived from the scene clock) that we take modulo
  // the dash+gap period, so it loops seamlessly. Segments are short (dense spline sampling), so
  // per-segment membership testing at the midpoint is smooth enough.
  drawRiverFlow() {
    if (!this.riverFlowGfx || !this.riverStreaks) return;
    const g = this.riverFlowGfx;
    g.clear();
    const t = this.time.now / 1000; // seconds
    for (const st of this.riverStreaks) {
      const { pts, cum } = st.s;
      const period = st.dash + st.gap;
      const offset = t * st.speed; // subtracted below so dashes drift downstream (left→right)
      g.lineStyle(st.width, st.color, st.alpha);
      for (let i = 1; i < pts.length; i++) {
        const sMid = (cum[i - 1] + cum[i]) / 2;
        const phase = (((sMid - offset) % period) + period) % period;
        if (phase < st.dash) {
          g.beginPath();
          g.moveTo(pts[i - 1].x, pts[i - 1].y);
          g.lineTo(pts[i].x, pts[i].y);
          g.strokePath();
        }
      }
    }
  }

  // Phaser calls this every frame; the only per-frame work is animating the river streaks.
  update() {
    this.drawRiverFlow();
  }

  // Plank decks over the water, running N–S across the E–W current. Each deck bows up at its
  // crest and casts a darker underside slab, giving a slight pseudo-3D (near-isometric) arch
  // without a full tilt. Rails tint to the owner's color when the crossing is claimed.
  drawBridges() {
    const g = this.bridgeGfx;
    g.clear();
    const dw = TILE * 0.60, half = dw / 2; // deck width (E–W); water shows past both sides
    const LIFT = 6;  // how far the underside slab drops below the deck → fake height/thickness
    const ARC = 7;   // how high the deck bows up at its center → the pseudo-3D arch
    const N = 12;    // samples along the deck's length for the curved edges/seams
    for (const b of this.bridges) {
      const top = b.y - TILE / 2 - 2, bot = b.y + TILE / 2 + 2, span = bot - top;
      const L = b.x - half, R = b.x + half;
      // Parabolic lift ALONG the deck's N–S length: 0 at the two banks, ARC at the span center,
      // so the bridge arches top→bottom like a side-on footbridge (raised in the middle).
      const lift = (s) => ARC * 4 * s * (1 - s);
      // Horizontal skew along the same length: ends lean LEFT, the raised middle leans RIGHT, so
      // the whole span arcs sideways as it rises → a pseudo-3D curve over the water.
      const SKEW_END = 2, SKEW_MID = 4;
      const skew = (s) => -SKEW_END + (SKEW_MID + SKEW_END) * 4 * s * (1 - s);
      const ys = [], xo = [];
      for (let k = 0; k <= N; k++) { const s = k / N; ys.push(top + span * s - lift(s)); xo.push(skew(s)); }

      const leftE = ys.map((y, k) => ({ x: L + xo[k], y }));
      const rightE = ys.map((y, k) => ({ x: R + xo[k], y }));
      const deck = leftE.concat([...rightE].reverse());

      // 1. Underside slab (darker), dropped by LIFT → reads as the deck's height over the water.
      g.fillStyle(0x53381c, 1).fillPoints(deck.map((p) => ({ x: p.x, y: p.y + LIFT })), true);
      // 2. Deck top surface.
      g.fillStyle(0x8a6636, 1).fillPoints(deck, true);

      // 3. Plank seams: straight cross-deck lines that bunch toward the raised crest.
      g.lineStyle(2, 0x5f451f, 1);
      const planks = 7;
      for (let i = 1; i < planks; i++) {
        const s = i / planks, y = top + span * s - lift(s), sx = skew(s);
        g.beginPath(); g.moveTo(L + sx, y); g.lineTo(R + sx, y); g.strokePath();
      }

      // 4. Crest highlight across the top of the arch.
      const yc = top + span * 0.5 - lift(0.5), xc = skew(0.5);
      g.lineStyle(3, 0x9c7a44, 0.8);
      g.beginPath(); g.moveTo(L + xc, yc); g.lineTo(R + xc, yc); g.strokePath();

      // 5. Side rails following the arced edges, tinted by owner (neutral = darker wood).
      const owner = this.tiles[b.r][b.c].owner;
      const rail = owner === 0 ? 0x6b4a22 : FILL[owner];
      const railStrip = (base, dxo, dxi) => {
        const strip = ys.map((y, k) => ({ x: base + xo[k] + dxo, y }))
          .concat(ys.map((y, k) => ({ x: base + xo[k] + dxi, y })).reverse());
        g.fillStyle(rail, 1).fillPoints(strip, true);
      };
      railStrip(L, -3, 2);
      railStrip(R, 3, -2);
    }
  }

  // Draw a filled, rounded panel and return the graphics object (so callers can restyle it).
  // Phaser's add.rectangle has no corner radius, so panels go through graphics.fillRoundedRect.
  panel(x, y, w, h, color, radius = 12) {
    const g = this.add.graphics();
    g.fillStyle(color, 1).fillRoundedRect(x, y, w, h, radius);
    return g;
  }

  buildHud() {
    const font = 'system-ui, -apple-system, sans-serif';
    const PANEL = 0x2a2e40;

    // --- Top row: three player resource counters + a gear (HUD direction B / Mockup 1) ---
    // Each card = tinted SVG icon + big amount + green income delta, plus the settings gear.
    // The resource row lives in the shared "rail" strip: full-width at the top in portrait,
    // the right-hand column in wide mode. Same code path, different coordinates.
    const { x: railX, w: railW, top } = this.rail;
    const gap = 12, gearW = 60, cardH = 76;
    const cardW = Math.floor((railW - gearW - gap * 3) / 3); // 3 cards + gear across
    const order = ['gold', 'wood', 'stone'];

    this.counters = {};
    order.forEach((res, i) => {
      const x = railX + i * (cardW + gap);
      this.panel(x, top, cardW, cardH, PANEL);
      // Icon pinned far left with its resource name labelled underneath; total floats to the right.
      this.add.image(x + 14 + 20, top + 27, `ic_${res}`)
        .setDisplaySize(40, 40).setTint(TINT[res]).setOrigin(0.5);
      this.add.text(x + 14 + 20, top + 58, res.toUpperCase(), {
        fontFamily: font, fontSize: '15px', fontStyle: 'bold', color: '#8990a6',
      }).setOrigin(0.5);
      // Total + green per-turn income, vertically centered as a pair against the card's padding
      // (the stack was sitting low, crowding the bottom edge).
      const amt = this.add.text(x + cardW - 14, top + 6, '', {
        fontFamily: font, fontSize: '36px', fontStyle: 'bold', color: '#e7e9f0',
      }).setOrigin(1, 0);
      const inc = this.add.text(x + cardW - 14, top + 6 + 36 + 4, '', {
        fontFamily: font, fontSize: '24px', fontStyle: 'bold', color: '#5ac16f',
      }).setOrigin(1, 0);
      this.counters[res] = { amt, inc, baseY: top + 6 };
    });

    // Gear → opens the Settings panel (sound, CRT, how-to-play, about).
    const gx = railX + railW - gearW;
    this.panel(gx, top, gearW, cardH, PANEL);
    this.add.text(gx + gearW / 2, top + cardH / 2, '⚙️', { fontFamily: font, fontSize: '30px' })
      .setOrigin(0.5);
    // Transparent hit zone over the whole gear card (the emoji glyph is a poor tap target on its own).
    this.add.rectangle(gx + gearW / 2, top + cardH / 2, gearW, cardH, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.sfx.unlock(); this.settingsPanel.show(); });

    // --- Tile-control bar + round timeline (staged ideas A and C) ---
    // Row 1: a tug-of-war bar sized to every claimable tile - blue (you) grows from the
    // left, red (enemy) from the right, the dark middle is land still up for grabs.
    // Row 2: a sun->moon strip of 12 pips, one per round, filling on a warm->cool day
    // gradient (dawn to night) with the current round ringed white. The pips carry the
    // round count on their own - the old "Round X of 12 - Your turn" caption is gone.
    const barTop = this.roundY;
    this.tilesYouText = this.add.text(railX, barTop, '', {
      fontFamily: font, fontSize: '22px', fontStyle: 'bold', color: '#4f7df0',
    }).setOrigin(0, 0);
    this.tilesEnemyText = this.add.text(railX + railW, barTop, '', {
      fontFamily: font, fontSize: '22px', fontStyle: 'bold', color: '#e05668',
    }).setOrigin(1, 0);
    this.tileBar = { x: railX, w: railW, y: barTop + 32, h: 18 };
    this.tileBarG = this.add.graphics();

    this.buildRoundTimeline(railX, railW, this.roundY + 78);
    // Every tile that can ever be owned (river tiles can't, bridges can) - the bar's total.
    this.claimableTotal = this.tiles.flat().filter((t) => !t.river || t.bridge).length;
  }

  // The sun -> moon round strip: icons drawn with Graphics (no new assets), 12 pip
  // rectangles between them that refresh() recolors as the rounds pass.
  buildRoundTimeline(x, w, y) {
    const cy = y + 10;
    const g = this.add.graphics();
    // Sun: disc + 8 rays.
    g.fillStyle(0xffce3a, 1).fillCircle(x + 13, cy, 7);
    g.lineStyle(2, 0xffce3a, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.lineBetween(x + 13 + Math.cos(a) * 10, cy + Math.sin(a) * 10,
                    x + 13 + Math.cos(a) * 14, cy + Math.sin(a) * 14);
    }
    // Moon: full disc with a bg-colored disc overlapped to cut the crescent.
    g.fillStyle(0xaebbe6, 1).fillCircle(x + w - 13, cy, 9);
    g.fillStyle(0x1b1e2b, 1).fillCircle(x + w - 13 + 5, cy - 3, 8);

    // 12 pips between the icons.
    const left = x + 32, right = x + w - 32, gap = 4;
    const pipW = (right - left - (MAX_ROUNDS - 1) * gap) / MAX_ROUNDS;
    this.roundPips = [];
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const p = this.add.rectangle(left + i * (pipW + gap), cy - 8, pipW, 16, 0x20233a)
        .setOrigin(0, 0);
      this.roundPips.push(p);
    }
  }

  // Day-cycle color for t in 0..1 (dawn -> morning -> noon -> dusk -> night), interpolated
  // between fixed stops. Colors the round pips so early rounds read warm and late ones cool.
  dayColor(t) {
    const stops = [[242, 165, 78], [255, 206, 58], [255, 233, 168], [199, 107, 158], [58, 63, 107]];
    const p = Phaser.Math.Clamp(t, 0, 1) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(p));
    const f = p - i;
    const mix = (a, b) => Math.round(a + (b - a) * f);
    const [A, B] = [stops[i], stops[i + 1]];
    return (mix(A[0], B[0]) << 16) | (mix(A[1], B[1]) << 8) | mix(A[2], B[2]);
  }

  // Redraw the tug-of-war control bar. Widths are proportional to the claimable-tile total,
  // so the dark middle shrinking = the map filling up.
  updateTileBar() {
    const you = this.countTiles(1);
    const enemy = this.countTiles(2);
    this.tilesYouText.setText(`You ${you}`);
    this.tilesEnemyText.setText(`Enemy ${enemy}`);

    const { x, y, w, h } = this.tileBar;
    const total = this.claimableTotal || 1;
    const wy = Math.round(w * (you / total));
    const we = Math.round(w * (enemy / total));
    const g = this.tileBarG;
    g.clear();
    g.fillStyle(0x333952, 1).fillRoundedRect(x, y, w, h, 7); // neutral track
    // Rounded on the outer corners, radius scaled down on slivers too narrow for the full 7px
    // (the desktop rail is narrower than mobile's full-width bar, so segments cross into
    // sliver territory far more often - clamping keeps corners round instead of snapping flat).
    if (wy > 0) {
      const r = Math.min(7, wy / 2);
      g.fillStyle(0x3d6cff, 1).fillRoundedRect(x, y, wy, h, { tl: r, bl: r, tr: 0, br: 0 });
    }
    if (we > 0) {
      const r = Math.min(7, we / 2);
      g.fillStyle(0xd04c5c, 1).fillRoundedRect(x + w - we, y, we, h, { tl: 0, bl: 0, tr: r, br: r });
    }
  }

  buildControls() {
    const font = 'system-ui, -apple-system, sans-serif';

    // --- Action color-key legend (HUD direction B), as paneled swatch rows in a 2x2 grid. ---
    // Each row: swatch in the action's board-glow color + label + what it targets + its cost
    // (a tinted resource icon + number). So "what can I do, and which tiles" reads in one place.
    // Labels are kept short so they can be set BIGGER on mobile without overflowing the narrow
    // 2-column rows (the desc line under each carries the detail).
    const legend = [
      { color: ACTION_COLOR.claim,   label: 'Expand',  desc: 'Grow your territory',      res: 'gold',  amt: CLAIM_COST },
      { color: ACTION_COLOR.build,   label: 'Build',   desc: 'Auto-generate income',     res: 'wood',  amt: BUILD_COST },
      { color: ACTION_COLOR.upgrade, label: 'Upgrade', desc: 'Double a node\'s output',  res: 'stone', amt: UPGRADE_COST },
      { color: ACTION_COLOR.siege,   label: 'Siege',   desc: 'Take an enemy tile',       res: 'gold',  amt: SIEGE_COST },
    ];
    // Legend grid: 2x2 across the bottom in portrait, a stacked 1x4 column in the wide rail.
    const cols = this.legendCols;
    const { x: railX, w: railW } = this.rail;
    const gap = 12, rowH = this.legendRowH;
    // Mobile (portrait) reads at ~0.54x, so the legend text is bumped up there; the wide rail
    // renders near 1:1 and keeps the original, more compact sizing.
    const port = !this.isWide;
    const labelFs = port ? '22px' : '18px';
    const descFs = port ? '17px' : '15px';
    const costFs = port ? '30px' : '28px';
    const SW = port ? 34 : 30; // swatch size, outline-only to echo the board tiles
    const rowW = cols === 2 ? Math.floor((railW - gap) / 2) : railW;
    const legTop = this.legendTop; // anchored per mode (see computeLayout)
    legend.forEach((item, i) => {
      const x = railX + (i % cols) * (rowW + gap);
      const y = legTop + Math.floor(i / cols) * (rowH + 8);
      const yMid = y + rowH / 2;
      const g = this.panel(x, y, rowW, rowH, 0x22263a, 10);
      // Border-only swatch in the action's board-glow color - same read as an outlined tile.
      g.lineStyle(4, item.color, 1).strokeRoundedRect(x + 12, yMid - SW / 2, SW, SW, 6);
      const textX = x + 12 + SW + 14;
      // Label + desc tightened around the row's vertical center so the title sits centered.
      this.add.text(textX, yMid + 1, item.label, {
        fontFamily: font, fontSize: labelFs, fontStyle: 'bold', color: '#e7e9f0',
      }).setOrigin(0, 1);
      this.add.text(textX, yMid + 3, item.desc, {
        fontFamily: font, fontSize: descFs, color: '#7c8398',
      }).setOrigin(0, 0);
      // Cost: number right-aligned, with a tinted resource icon just to its left.
      const amtText = this.add.text(x + rowW - 12, yMid, `${item.amt}`, {
        fontFamily: font, fontSize: costFs, fontStyle: 'bold', color: '#e7e9f0',
      }).setOrigin(1, 0.5);
      this.add.image(x + rowW - 12 - amtText.width - 8, yMid, `ic_${item.res}`)
        .setDisplaySize(30, 30).setTint(TINT[item.res]).setOrigin(1, 0.5);
    });

    // --- Bottom action row, anchored to the very bottom of the screen ---
    // End Turn (primary) sits on the LEFT; New Game (secondary, muted) on the RIGHT. Both hug
    // the bottom on tall phones (btnY from computeLayout). End Turn styling is state-driven - a
    // ghost outline while you still have moves, filling solid once you're spent (see styleEndBtn).
    const btnY = this.buttonY;
    const btnGap = 12;
    // The pair fills the rail width in both modes; End Turn keeps roughly the same 2:1 share
    // it had in the fixed portrait layout (440 of 680).
    const endW = Math.round(railW * 0.647), newW = railW - btnGap - endW;
    const endCx = railX + endW / 2;
    const newCx = railX + endW + btnGap + newW / 2;

    // New Game (right, secondary). Hover brightens it (styleNewBtn).
    this.newHover = false;
    this.newBtn = this.add.rectangle(newCx, btnY, newW, 96, 0x323850)
      .setInteractive({ useHandCursor: true });
    this.add.text(newCx, btnY, 'New\nGame', {
      fontFamily: HEAD, fontSize: '29px', fontStyle: 'bold', color: '#e7e9f0', align: 'center',
    }).setOrigin(0.5);
    this.newBtn.on('pointerdown', () => this.onNewGame());
    this.newBtn.on('pointerover', () => { this.newHover = true; this.styleNewBtn(); });
    this.newBtn.on('pointerout', () => { this.newHover = false; this.styleNewBtn(); });

    // End Turn (left, primary). Fill/outline/text all set by styleEndBtn per game state + hover.
    this.endHover = false;
    this.endBtn = this.add.rectangle(endCx, btnY, endW, 96, 0x3d6cff)
      .setInteractive({ useHandCursor: true });
    this.endBtnText = this.add.text(endCx, btnY, 'End Turn', {
      fontFamily: HEAD, fontSize: '38px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    this.endBtn.on('pointerdown', () => this.onEndTurn());
    this.endBtn.on('pointerover', () => { this.endHover = true; this.styleEndBtn(); });
    this.endBtn.on('pointerout', () => { this.endHover = false; this.styleEndBtn(); });

    this.styleNewBtn();
    this.styleEndBtn();
  }

  // Does the human have any legal, affordable action on the board right now? Drives whether
  // End Turn is a ghost (moves remain) or a solid prompt (nothing left to do but end).
  hasAvailableMove() {
    for (let r = 0; r < GRID_H; r++)
      for (let c = 0; c < GRID_W; c++)
        if (this.actionFor(r, c)) return true;
    return false;
  }

  // End Turn is a three-state button:
  //   • not your turn  → inert grey, no outline.
  //   • your turn, moves left → ghost: outline only, so it reads as "optional, keep playing".
  //   • your turn, no moves   → solid blue: the game nudges you to end the turn.
  // Hover brightens the solid state / faintly fills the ghost, so both states feel clickable.
  styleEndBtn() {
    const humanTurn = this.current === 1 && !this.inputLocked && !this.gameOver;
    if (!humanTurn) {
      this.endBtn.setFillStyle(0x2a2e40, 1);
      this.endBtn.setStrokeStyle();
      this.endBtnText.setColor('#8a90a6');
      return;
    }
    if (!this.hasAvailableMove()) {
      this.endBtn.setFillStyle(this.endHover ? 0x5a83ff : 0x3d6cff, 1);
      this.endBtn.setStrokeStyle();
      this.endBtnText.setColor('#ffffff');
    } else {
      this.endBtn.setFillStyle(0x3d6cff, this.endHover ? 0.20 : 0);
      this.endBtn.setStrokeStyle(3, 0x3d6cff, 1);
      this.endBtnText.setColor(this.endHover ? '#ffffff' : '#8fa8ff');
    }
  }

  styleNewBtn() {
    // Muted resting slate that lifts to the brighter hover shade you liked.
    this.newBtn.setFillStyle(this.newHover ? 0x4a5273 : 0x323850, 1);
  }

  // Resting color for a resource counter: the maxed-out orange once the stockpile hits the cap
  // (income past it is lost), else the neutral ink. Used as the settle color for the pulse and
  // the direct set when a counter doesn't change, so "maxed" persists across pulses.
  restColor(res) {
    return this.resources[1][res] >= RESOURCE_CAP ? CAP_COLOR : '#e7e9f0';
  }

  // New Game: restart immediately from a fresh board, but if the player has already made a
  // move this game, ask first so a mis-tap doesn't wipe progress.
  onNewGame() {
    if (this.inputLocked && !this.gameOver) return; // don't restart mid-AI-turn
    this.sfx.unlock();
    if (!this.hasActed) { this.sfx.play('newgame'); this.scene.restart(); return; }
    this.confirmOverlay.setVisible(true);
  }

  buildGameOverOverlay() {
    // Cover the full canvas (either mode's size) and center the result/button on it.
    const W = this.scale.gameSize.width, CX = W / 2;
    const H = this.scale.gameSize.height;
    this.overlay = this.add.container(0, 0).setVisible(false).setDepth(10);
    const bg = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.72);
    const textY = Math.round(H * 0.44);
    // Total Victory sunburst (hidden until showGameOver triggers it): a pulsing gold glow plus
    // a ring of rotating rays behind the result text. Built once here, toggled/animated later
    // rather than created fresh, since the overlay itself only ever shows once per scene
    // (a new game fully restarts the scene, so there's no reuse/cleanup to worry about).
    // Sized off the canvas diagonal so the rays reach the corners of the screen regardless
    // of portrait/wide mode, rather than a fixed pixel size that only worked at one aspect.
    const diag = Math.hypot(W, H);
    this.sunburstBaseScale = (diag * 0.62) / 128; // 'glow' texture radius is 128px
    this.sunburstGlow = this.add.image(CX, textY, 'glow')
      .setTint(0xf2c14e).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(this.sunburstBaseScale).setAlpha(0);
    this.sunburstRays = this.add.container(CX, textY).setAlpha(0).setScale(diag / 260);
    const raysG = this.add.graphics();
    const rayCount = 10;
    for (let i = 0; i < rayCount; i++) {
      const angle = (360 / rayCount) * i;
      const a = Phaser.Math.DegToRad(angle);
      const perp = a + Math.PI / 2;
      const r0 = 30, r1 = 260, half = 16;
      const x0 = Math.cos(a) * r0, y0 = Math.sin(a) * r0;
      const x1 = Math.cos(a) * r1, y1 = Math.sin(a) * r1;
      const dx = Math.cos(perp) * half, dy = Math.sin(perp) * half;
      raysG.fillStyle(0xf2c14e, 0.13);
      raysG.fillTriangle(x0, y0, x1 + dx, y1 + dy, x1 - dx, y1 - dy);
    }
    this.sunburstRays.add(raysG);
    this.resultText = this.add.text(CX, textY, '', {
      fontFamily: HEAD, fontSize: '54px', fontStyle: 'bold', color: '#ffffff',
      align: 'center', wordWrap: { width: 680 },
    }).setOrigin(0.5);
    const againBtn = this.add.rectangle(CX, textY + 160, 320, 96, 0x3d6cff).setInteractive({ useHandCursor: true });
    const againText = this.add.text(CX, textY + 160, 'Play Again', {
      fontFamily: HEAD, fontSize: '38px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    againBtn.on('pointerdown', () => { this.sfx.play('newgame'); this.scene.restart(); });
    this.overlay.add([bg, this.sunburstGlow, this.sunburstRays, this.resultText, againBtn, againText]);
  }

  // Fades in the sunburst glow + starts the rays spinning/pulsing. Only called for a Total
  // Victory (see checkWin/showGameOver) - a normal win never touches these.
  showSunburst() {
    // Alpha capped well under 1 - the glow texture + ADD blend already stack up bright,
    // and a full-alpha pulse washed the result text out.
    this.tweens.add({ targets: this.sunburstGlow, alpha: 0.28, duration: 260, ease: 'Quad.easeOut' });
    this.tweens.add({
      targets: this.sunburstGlow, scale: this.sunburstBaseScale * 1.08, duration: 1800,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.tweens.add({ targets: this.sunburstRays, alpha: 1, duration: 260, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: this.sunburstRays, angle: 360, duration: 9000, repeat: -1, ease: 'Linear' });
  }

  // Confirmation dialog for New Game, shown only when the player has already acted.
  // Hidden by default; onNewGame() toggles it. The dim bg is interactive so taps behind
  // the dialog are swallowed instead of hitting the board.
  buildNewGameConfirm() {
    const font = 'system-ui, -apple-system, sans-serif';
    const W = this.scale.gameSize.width, CX = W / 2;
    const H = this.scale.gameSize.height;
    this.confirmOverlay = this.add.container(0, 0).setVisible(false).setDepth(11);
    const dim = this.add.rectangle(CX, H / 2, W, H, 0x000000, 0.72).setInteractive();

    const cardW = 560, cardH = 300;
    const cardX = CX - cardW / 2, cardY = Math.round(H / 2 - cardH / 2);
    const card = this.panel(cardX, cardY, cardW, cardH, 0x22263a, 18);

    const title = this.add.text(CX, cardY + 74, 'Start a new game?', {
      fontFamily: HEAD, fontSize: '36px', fontStyle: 'bold', color: '#e7e9f0',
    }).setOrigin(0.5);
    const sub = this.add.text(CX, cardY + 128, 'Your current progress will be lost.', {
      fontFamily: font, fontSize: '20px', color: '#aeb4c6',
    }).setOrigin(0.5);

    // Two buttons: Cancel (grey, left) and New Game (blue, right).
    const bw = 244, bh = 84, gap = 20, by = cardY + cardH - 66;
    const cancelCx = CX - (bw + gap) / 2, confirmCx = CX + (bw + gap) / 2;

    const cancelBtn = this.add.rectangle(cancelCx, by, bw, bh, 0x39405c).setInteractive({ useHandCursor: true });
    const cancelText = this.add.text(cancelCx, by, 'Cancel', {
      fontFamily: HEAD, fontSize: '30px', fontStyle: 'bold', color: '#e7e9f0',
    }).setOrigin(0.5);
    cancelBtn.on('pointerdown', () => this.confirmOverlay.setVisible(false));

    const confirmBtn = this.add.rectangle(confirmCx, by, bw, bh, 0x3d6cff).setInteractive({ useHandCursor: true });
    const confirmText = this.add.text(confirmCx, by, 'New Game', {
      fontFamily: HEAD, fontSize: '30px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    confirmBtn.on('pointerdown', () => { this.sfx.play('newgame'); this.scene.restart(); });

    this.confirmOverlay.add([dim, card, title, sub, cancelBtn, cancelText, confirmBtn, confirmText]);
  }

  // ---------------------------------------------------------------- turn flow
  startPlayerTurn() {
    this.current = 1;
    this.addIncome(1);
    this.inputLocked = false;
    this.refresh();
  }

  onEndTurn() {
    if (this.inputLocked || this.gameOver) return;
    this.hasActed = true;
    this.sfx.unlock();
    this.sfx.play('endturn');
    this.inputLocked = true;
    this.refresh();
    // Small delay so the human sees the AI "think" rather than teleport.
    this.time.delayedCall(320, () => this.runAITurn());
  }

  runAITurn() {
    this.current = 2;
    this.addIncome(2);
    this.refresh();
    // Play the AI's moves one at a time with a beat between them, so each one animates and
    // sounds distinctly instead of resolving in a single invisible burst.
    this.aiStep(0);
  }

  aiStep(count) {
    if (this.gameOver) return;
    if (count >= AI_MAX_ACTIONS) return this.endAITurn();
    const move = this.aiPickMove();
    if (!move) return this.endAITurn();
    this.applyMove(2, move);
    this.refresh();
    this.juiceAction(move);
    if (this.checkWin()) return; // domination / base capture mid-turn
    this.time.delayedCall(280, () => this.aiStep(count + 1));
  }

  endAITurn() {
    this.round += 1;
    this.refresh();
    if (this.checkWin()) return;
    this.startPlayerTurn();
  }

  addIncome(p) {
    const inc = this.computeIncome(p);
    for (const res of ['wood', 'gold', 'stone']) {
      // Hard cap: anything earned past RESOURCE_CAP is simply lost (no hoarding a huge war chest).
      this.resources[p][res] = Math.min(RESOURCE_CAP, this.resources[p][res] + inc[res]);
    }
  }

  computeIncome(p) {
    const inc = { wood: 0, gold: 0, stone: 0 };
    this.forEachTile((t) => {
      if (t.owner !== p) return;
      // Home tile trickles a little of everything so you're never fully locked out.
      if (t.home) { inc.wood += BASE_INCOME; inc.gold += BASE_INCOME; inc.stone += BASE_INCOME; }
      // Upgraded nodes double their output - the whole point of the Upgrade action.
      const m = t.upgraded ? 2 : 1;
      if (t.resource === 'wood') inc.wood += NODE_INCOME * m;
      else if (t.resource === 'gold') inc.gold += NODE_INCOME * m;
      else if (t.resource === 'stone') inc.stone += NODE_INCOME * m;
      // Special = generalist: a flat little of all three (doubles too when upgraded).
      else if (t.resource === 'special') {
        inc.wood += SPECIAL_INCOME * m; inc.gold += SPECIAL_INCOME * m; inc.stone += SPECIAL_INCOME * m;
      }
    });
    return inc;
  }

  // ---------------------------------------------------------------- moves
  // Touch has no hover, so a tap can't preview-then-commit the way a mouse click does (hover
  // shows the tooltip, click confirms). Instead: the first tap on a tile only selects it and
  // shows the tooltip; a second tap on that SAME tile commits the move. On desktop this is
  // invisible - the mouse hover already selects the tile before the click lands, so a single
  // click still commits in one motion, same as before.
  onTilePointerDown(r, c) {
    if (this.selected && this.selected.r === r && this.selected.c === c) {
      this.onTileTap(r, c);
      return;
    }
    this.showTooltip(r, c); // selects this tile if (and only if) it has an actionable move
  }

  onTileTap(r, c) {
    if (this.inputLocked || this.gameOver || this.current !== 1) return;
    this.sfx.unlock();
    const t = this.tiles[r][c];
    if (t.river) return; // water is impassable (bridges are claimable and handled below)
    const res = this.resources[1];
    const adj = this.isAdjacentTo(r, c, 1);

    // Resolve the tap to a single legal move (or none), so juice/apply share one path.
    let move = null;
    if (t.owner === 0 && adj) {
      // Neutral tile: Claim if empty (gold), Build if it holds a resource (wood).
      if (!t.resource && res.gold >= CLAIM_COST) move = { type: 'claim', r, c };
      else if (t.resource && res.wood >= BUILD_COST) move = { type: 'build', r, c };
    } else if (t.owner === 2 && adj) {
      // Enemy tile: Siege (gold, +wood to re-develop a captured node). Home is very steep.
      if (res.gold >= this.siegeCost(t) && res.wood >= this.siegeWoodCost(t)) move = { type: 'siege', r, c };
    } else if (t.owner === 1 && t.resource && !t.home && !t.upgraded && res.stone >= UPGRADE_COST) {
      // Upgrade one of your own resource nodes (never home) - doubles its output. Once only.
      move = { type: 'upgrade', r, c };
    }
    if (!move) return; // invalid tap, ignore

    this.applyMove(1, move);
    this.hasActed = true;
    this.refresh();
    this.juiceAction(move);
    this.checkWin();
    // The cursor is still on this tile but refresh() hid the (now stale) tooltip. Re-show it for
    // the new state so the next action (e.g. Upgrade the node you just claimed) appears seamlessly
    // without needing to mouse out and back in. Resolves to null → stays hidden if nothing's actionable.
    this.showTooltip(r, c);
  }

  // ---------------------------------------------------------------- juice / game feel
  // One place that reacts to a resolved move: sound + a colored particle burst + a tile pop,
  // with camera shake scaled to how big a deal the move is (siege small, base-capture large).
  // Called for BOTH players so you feel the AI's attacks land on you too.
  juiceAction(move) {
    const t = this.tiles[move.r][move.c];
    const v = this.views[move.r][move.c];
    const x = v.rect.x, y = v.rect.y;
    const color = ACTION_COLOR[move.type] || 0xffffff;
    const baseCapture = move.type === 'siege' && t.home;
    const isSpecial = t.resource === 'special';
    // Capturing a normal resource NODE gets its own destructive sound; if it was upgraded when
    // taken, pitch it down further so a bigger prize lands heavier. (t.resource survives capture.)
    const nodeCapture = move.type === 'siege' && !t.home && !!t.resource;

    if (baseCapture) this.sfx.play('capture');
    // The ★ special node sounds magical when you build it (peaceful acquire) and a touch higher
    // when you upgrade it. Sieging it is violent, so it uses the destructive node-capture sound
    // below instead - the nodeCapture branch catches a special siege since it's a resource node.
    else if (isSpecial && move.type === 'upgrade') this.sfx.play('special', { pitch: 1.2 });
    else if (isSpecial && move.type === 'build') this.sfx.play('special');
    else if (nodeCapture) this.sfx.play('siegeNode', { pitch: move.wasUpgraded ? 0.6 : 1 });
    else this.sfx.play(move.type);
    this.spark(x, y, color, baseCapture ? 30 : (move.type === 'siege' ? 16 : 12), baseCapture ? 340 : 220);
    // Ownership-changing moves get the capture sweep (upgrade keeps the same owner, so it doesn't).
    // On a siege the tile flips from the opponent (3 - p); a claim/build flips from neutral (0).
    if (move.type === 'claim' || move.type === 'build' || move.type === 'siege') {
      this.captureFill(move.r, move.c, t.owner, move.type === 'siege' ? (3 - t.owner) : 0);
    }
    this.popTile(move.r, move.c);
    if (baseCapture) this.cameras.main.shake(360, 0.012);
    else if (move.type === 'siege') this.cameras.main.shake(150, 0.005);
  }

  // A one-shot particle explosion at (x,y), tinted to the action color, then self-destructs.
  spark(x, y, color, count = 12, speed = 220) {
    const p = this.add.particles(x, y, 'spark', {
      tint: color,
      lifespan: 460,
      speed: { min: 50, max: speed },
      angle: { min: 0, max: 360 },
      scale: { start: 0.85, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    }).setDepth(8);
    // Emit at the emitter's own (x,y) - passing x,y to explode again would double the offset.
    p.explode(count);
    this.time.delayedCall(520, () => p.destroy());
  }

  // A quick "Back" overshoot pop on a tile's rect + icon, so a captured/built tile punches in
  // rather than snapping. The icon tween returns to its live scale (setDisplaySize sets a
  // non-1 scale), so it never ends up the wrong size.
  popTile(r, c) {
    const v = this.views[r][c];
    this.tweens.add({
      targets: v.rect, scaleX: { from: 1.22, to: 1 }, scaleY: { from: 1.22, to: 1 },
      ease: 'Back.easeOut', duration: 240,
    });
    if (v.icon.visible) {
      const s = v.icon.scaleX;
      this.tweens.add({
        targets: v.icon, scaleX: { from: s * 1.3, to: s }, scaleY: { from: s * 1.3, to: s },
        ease: 'Back.easeOut', duration: 240,
      });
    }
  }

  // Pulse a resource counter to telegraph a change: green + roll/bounce UP for income (a gain),
  // amber + roll/bounce DOWN for a purchase (a spend). Colour resets to neutral when it settles.
  pulseCounter(res, dir) {
    const o = this.counters[res];
    const t = o.amt;
    const gain = dir === 'gain';
    this.tweens.killTweensOf(t);
    // Reset to a known baseline first (a prior pulse may have been interrupted mid-flight).
    // Keep a FIXED origin/anchor (top-right, y=o.baseY) the whole time. The earlier version
    // flipped the origin to y=1 for spends and offset y by the text height, but the two tweens
    // then disagreed on the resting y - the positional tween finished last and left the digit one
    // line lower with a top origin. A single stable anchor removes that race entirely.
    const reset = () => { t.setScale(1).setColor(this.restColor(res)).setOrigin(1, 0); t.y = o.baseY; };
    reset();
    t.setColor(gain ? '#5ac16f' : '#f2b23a');
    // Roll like a flip-clock digit: collapse vertically to a thin line, then unfold back.
    this.tweens.add({
      targets: t, scaleY: 0,
      duration: 130, ease: 'Quad.easeIn', yoyo: true,
    });
    // Positional bounce in the direction of the change (up for income, down for a spend). Yoyo
    // returns y to o.baseY; its onComplete restores the neutral colour/scale as the authoritative
    // final state, so whichever tween ends last, the digit always settles on its baseline.
    this.tweens.add({
      targets: t, y: o.baseY + (gain ? -8 : 8),
      duration: 130, ease: 'Quad.easeOut', yoyo: true,
      onComplete: reset,
    });
  }

  // Capture sweep: on any ownership change, the new owner's colour fills the tile from one edge
  // over ~200ms so the capture reads visually. Player (blue) fills bottom→top; AI (red) fills
  // top→bottom, same speed. The tile shows its pre-capture colour underneath during the sweep.
  captureFill(r, c, owner, prevOwner) {
    const v = this.views[r][c];
    const size = TILE - 4;
    v.rect.setFillStyle(FILL[prevOwner]); // hold the old colour while the new one sweeps over it
    const fromBottom = owner === 1;
    const edgeY = fromBottom ? v.rect.y + size / 2 : v.rect.y - size / 2;
    // Depth 0.5: above the tile rect (0), but BELOW the water ribbon (depth 1) and the bridge
    // decks (depth 2), so on a bridge tile the sweep fills under both the water and the plank
    // deck instead of painting over them.
    const ov = this.add.rectangle(v.rect.x, edgeY, size, size, FILL[owner])
      .setOrigin(0.5, fromBottom ? 1 : 0).setDepth(0.5).setScale(1, 0);
    this.tweens.add({
      targets: ov, scaleY: 1, duration: 200, ease: 'Quad.easeOut',
      onComplete: () => { v.rect.setFillStyle(FILL[owner]); ov.destroy(); },
    });
  }

  applyMove(p, move) {
    const t = this.tiles[move.r][move.c];
    if (move.type === 'claim') {
      this.resources[p].gold -= CLAIM_COST;
      t.owner = p;
    } else if (move.type === 'build') {
      this.resources[p].wood -= BUILD_COST;
      t.owner = p;
    } else if (move.type === 'siege') {
      this.resources[p].gold -= this.siegeCost(t);
      this.resources[p].wood -= this.siegeWoodCost(t); // re-develop the captured node (0 for plain tiles)
      move.wasUpgraded = t.upgraded;  // remember for the capture SFX before we strip it
      t.owner = p;
      t.upgraded = false;             // a captured node arrives damaged - re-upgrade it with stone
    } else if (move.type === 'upgrade') {
      this.resources[p].stone -= UPGRADE_COST;
      t.upgraded = true;
    }
  }

  // ---------------------------------------------------------------- AI (greedy)
  aiPickMove() {
    const me = 2, foe = 1;
    const wood = this.resources[2].wood;
    const gold = this.resources[2].gold;
    const stone = this.resources[2].stone;

    const empties = [];  // neutral EMPTY tiles adjacent to AI       (Claim, gold)
    const builds = [];   // neutral RESOURCE tiles adjacent to AI     (Build, wood)
    const sieges = [];   // enemy tiles adjacent to AI                (Siege, gold; +wood for nodes)
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        const t = this.tiles[r][c];
        if (t.river) continue; // water: never claimable/passable
        if (!this.isAdjacentTo(r, c, me)) continue;
        if (t.owner === 0 && t.resource) builds.push({ r, c, t });
        else if (t.owner === 0) empties.push({ r, c, t }); // includes bridges (claimable)
        else if (t.owner === foe) sieges.push({ r, c, t });
      }
    }

    const nodeRank = (t) => (t.resource === 'special' ? 3 : t.resource ? 2 : 1);
    const byNode = (a, b) => nodeRank(b.t) - nodeRank(a.t);
    builds.sort(byNode);
    sieges.sort(byNode);
    // A siege is affordable only if BOTH its gold and its (node-only) wood cost are covered.
    const canSiege = (t) => gold >= this.siegeCost(t) && wood >= this.siegeWoodCost(t);

    // Priority: siege enemy node > build own node > siege anything > claim empty > upgrade a node.
    const sgNode = sieges.find((x) => x.t.resource && canSiege(x.t));
    if (sgNode) return { type: 'siege', r: sgNode.r, c: sgNode.c };

    if (wood >= BUILD_COST && builds.length) {
      return { type: 'build', r: builds[0].r, c: builds[0].c };
    }

    const sgAny = sieges.find((x) => canSiege(x.t));
    if (sgAny) return { type: 'siege', r: sgAny.r, c: sgAny.c };

    if (gold >= CLAIM_COST && empties.length) {
      return { type: 'claim', r: empties[0].r, c: empties[0].c };
    }

    // Otherwise upgrade one of its own resource nodes to grow income. Prefer a SAFE node (not
    // bordering the enemy) - upgrading a frontline node just hands a doubled tile to the foe if
    // it's captured. Fall back to any own node if every one is on the frontline.
    if (stone >= UPGRADE_COST) {
      const own = [];
      for (let r = 0; r < GRID_H; r++) {
        for (let c = 0; c < GRID_W; c++) {
          const t = this.tiles[r][c];
          if (t.owner === me && t.resource && !t.home && !t.upgraded) own.push({ r, c });
        }
      }
      const safe = own.find((n) => !this.isAdjacentTo(n.r, n.c, foe));
      const pick = safe || own[0];
      if (pick) return { type: 'upgrade', r: pick.r, c: pick.c };
    }
    return null;
  }

  // ---------------------------------------------------------------- helpers
  // Gold cost to siege an enemy tile: the home base is deliberately steep, every other tile
  // costs the flat 2x-a-claim siege price (upgrades no longer affect capture cost).
  siegeCost(t) {
    if (t.home) return HOME_SIEGE_COST;
    return SIEGE_COST;
  }

  // Extra WOOD to capture an enemy tile: only resource NODES cost wood (you re-develop them);
  // plain territory and the home base cost gold only.
  siegeWoodCost(t) {
    return (t.resource && !t.home) ? SIEGE_NODE_WOOD : 0;
  }

  forEachTile(fn) {
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) fn(this.tiles[r][c], r, c);
    }
  }

  // True if cell (r,c) has an orthogonal neighbour owned by player p.
  isAdjacentTo(r, c, p) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= GRID_H || nc < 0 || nc >= GRID_W) continue;
      if (this.tiles[nr][nc].owner === p) return true;
    }
    return false;
  }

  countTiles(p) {
    let n = 0;
    this.forEachTile((t) => { if (t.owner === p) n += 1; });
    return n;
  }

  // ---------------------------------------------------------------- win / render
  checkWin() {
    if (this.gameOver) return false;
    const you = this.countTiles(1);
    const ai = this.countTiles(2);

    // Two ways to win: capture the enemy base (instant), or hold the most tiles at time up.
    const aiBaseOwner = this.tiles[0][0].owner;            // AI base, top-left
    const yourBaseOwner = this.tiles[GRID_H - 1][GRID_W - 1].owner; // your base, bottom-right

    // The round the game actually ends on (capped at MAX_ROUNDS for a time-up finish).
    const winRound = Math.min(this.round, MAX_ROUNDS);
    let done = false, msg = null, sub = `${you} vs ${ai} tiles`, result = null, totalVictory = false;
    if (aiBaseOwner === 1) {
      done = true; result = 'you';
      // Total Victory: base captured AND you own every non-river tile AND every resource node
      // you hold is upgraded - full-map domination, not just a base rush.
      let totalNonRiver = 0, ownedNonRiver = 0, allNodesUpgraded = true;
      this.forEachTile((t) => {
        if (t.river) return;
        totalNonRiver += 1;
        if (t.owner === 1) ownedNonRiver += 1;
        if (t.owner === 1 && t.resource && !t.upgraded) allNodesUpgraded = false;
      });
      totalVictory = ownedNonRiver === totalNonRiver && allNodesUpgraded;
      if (totalVictory) { msg = `Complete Foothold!\nRound ${winRound}`; sub = 'The enemy has nothing left'; }
      else { msg = `You Win on Round ${winRound}!`; sub = 'Enemy base captured'; }
    }
    else if (yourBaseOwner === 2) { done = true; result = 'ai'; msg = 'Enemy wins'; sub = 'Your base fell'; }
    else if (this.round > MAX_ROUNDS) {                   // time up → most tiles wins
      done = true;
      if (you > ai) { result = 'you'; msg = `You Win on Round ${winRound}!`; }
      else if (ai > you) { result = 'ai'; msg = 'Enemy wins'; }
      else {
        // Tile tie: the stronger economy wins (total per-turn income across all three
        // resources). Only a full economic tie is a true draw.
        const yi = this.computeIncome(1), ei = this.computeIncome(2);
        const ySum = yi.wood + yi.gold + yi.stone;
        const eSum = ei.wood + ei.gold + ei.stone;
        if (ySum > eSum) { result = 'you'; msg = `You Win on Round ${winRound}!`; sub = `Tiles tied ${you}-${ai} - your income is higher`; }
        else if (eSum > ySum) { result = 'ai'; msg = 'Enemy wins'; sub = `Tiles tied ${you}-${ai} - enemy income is higher`; }
        else { result = 'draw'; msg = 'Draw'; sub = `Tied on tiles and income`; }
      }
    }

    if (!done) return false;

    this.gameOver = true;
    this.inputLocked = true;
    this.refresh();
    this.showGameOver(msg, sub, result, totalVictory);
    return true;
  }

  // Fade the dark overlay in and pop the result text, with a win/lose sting slightly delayed
  // so it doesn't collide with the final action's sound (e.g. the base-capture siege hit).
  // Total Victory gets its own bigger sting (grand-finale fanfare, gold sunburst, a harder
  // shake + flash) instead of the normal win treatment - see stage/total-victory.html.
  showGameOver(msg, sub, result, totalVictory = false) {
    this.resultText.setText(`${msg}\n${sub}`);
    this.overlay.setAlpha(0).setVisible(true);
    this.tweens.add({ targets: this.overlay, alpha: 1, duration: 300, ease: 'Quad.easeOut' });
    this.resultText.setScale(0.6);
    this.tweens.add({ targets: this.resultText, scale: 1, duration: 500, ease: 'Back.easeOut', delay: 120 });
    if (totalVictory) {
      this.time.delayedCall(220, () => { this.sfx.play('totalVictory'); this.showSunburst(); });
      this.cameras.main.flash(450, 255, 210, 110);
      this.cameras.main.shake(400, 0.014);
    } else if (result === 'you') this.time.delayedCall(220, () => this.sfx.play('win'));
    else if (result === 'ai') this.time.delayedCall(220, () => this.sfx.play('lose'));
  }

  refresh() {
    this.hideTooltip(); // any shown tooltip is stale once the board re-renders

    this.forEachTile((t, r, c) => {
      const v = this.views[r][c];
      // Tile fill sits UNDER the water ribbon/bridge decks (drawn as graphics on top). River tiles
      // get a darker shade of the neutral tile so they read as unclaimable; bridges keep the normal
      // shade (a claimed bridge shows its owner color at the corners the deck doesn't cover).
      v.rect.setFillStyle(t.river ? RIVER_TILE : FILL[t.owner]);

      // Node/home icon (always shown so both players can plan around the map).
      // setTexture resets to the frame's native size, so re-apply the on-tile display size.
      if (t.resource) {
        v.icon.setTexture(`ic_${t.resource}`).setDisplaySize(50 * this.tileK, 50 * this.tileK).setTint(TINT[t.resource]).setVisible(true);
      } else if (t.home) {
        v.icon.setTexture('ic_home').setDisplaySize(66 * this.tileK, 66 * this.tileK).setTint(0xffffff).setVisible(true);
      } else {
        v.icon.setVisible(false);
      }

      v.badge.setVisible(t.upgraded);

      // Income label on owned resource nodes: the actual per-turn yield (doubled if upgraded).
      if (t.owner !== 0 && t.resource) {
        const m = t.upgraded ? 2 : 1;
        const txt = t.resource === 'special' ? `+${SPECIAL_INCOME * m} all` : `+${NODE_INCOME * m}`;
        v.income.setText(txt).setVisible(true);
      } else {
        v.income.setVisible(false);
      }

      // Highlight actionable tiles for the human, colored by action (mirror the legend).
      // Same source of truth as the hover tooltip, so glow and tooltip never disagree.
      const act = this.actionFor(r, c);
      if (act) v.rect.setStrokeStyle(4, act.color);
      else v.rect.setStrokeStyle(0);
    });

    // Bridge decks redraw so their rails tint to whoever now owns the crossing.
    this.drawBridges();

    // HUD - resource counter cards show the stockpile + green per-turn income delta (Mockup 1).
    const r1 = this.resources[1];
    const inc = this.computeIncome(1);
    ['gold', 'wood', 'stone'].forEach((res) => {
      const now = r1[res], was = this.prevResources[res];
      this.counters[res].amt.setText(`${now}`);
      this.counters[res].inc.setText(`+${inc[res]}`);
      if (now > was) this.pulseCounter(res, 'gain');
      else if (now < was) this.pulseCounter(res, 'spend');
      else this.counters[res].amt.setColor(this.restColor(res)); // no change: still reflect maxed state
    });
    this.prevResources = { ...r1 };
    this.updateTileBar();
    const shownRound = Math.min(this.round, MAX_ROUNDS);
    this.roundPips.forEach((p, i) => {
      const on = i < shownRound;
      p.setFillStyle(on ? this.dayColor(i / (MAX_ROUNDS - 1)) : 0x20233a);
      // White ring marks the round in play; cleared once the game is over.
      p.setStrokeStyle(!this.gameOver && i === shownRound - 1 ? 2 : 0, 0xffffff, 0.9);
    });

    // Bottom buttons reflect current state (End Turn ghost/solid + hover; New Game hover).
    this.styleEndBtn();
    this.styleNewBtn();
  }

  // ---------------------------------------------------------------- hover tooltip (style C)
  // The single source of truth for "what can the human do on this tile right now": returns the
  // action (verb, glow color, cost) or null. Used by BOTH the board highlight and the tooltip.
  actionFor(r, c) {
    if (this.current !== 1 || this.inputLocked || this.gameOver) return null;
    const t = this.tiles[r][c];
    if (t.river) return null;
    const res = this.resources[1];
    const adj = this.isAdjacentTo(r, c, 1);
    if (t.owner === 0 && adj && !t.resource && res.gold >= CLAIM_COST)
      return { action: 'claim', verb: 'Expand', color: ACTION_COLOR.claim, costRes: 'gold', cost: CLAIM_COST };
    if (t.owner === 0 && adj && t.resource && res.wood >= BUILD_COST)
      return { action: 'build', verb: 'Build', color: ACTION_COLOR.build, costRes: 'wood', cost: BUILD_COST };
    if (t.owner === 2 && adj && res.gold >= this.siegeCost(t) && res.wood >= this.siegeWoodCost(t)) {
      const wc = this.siegeWoodCost(t);
      const act = { action: 'siege', verb: 'Siege', color: ACTION_COLOR.siege, costRes: 'gold', cost: this.siegeCost(t) };
      if (wc > 0) { act.costRes2 = 'wood'; act.cost2 = wc; } // nodes also cost wood to re-develop
      return act;
    }
    if (t.owner === 1 && t.resource && !t.home && !t.upgraded && res.stone >= UPGRADE_COST)
      return { action: 'upgrade', verb: 'Upgrade', color: ACTION_COLOR.upgrade, costRes: 'stone', cost: UPGRADE_COST };
    return null;
  }

  // What the player GAINS from the action - the star of the tooltip (big icon + number).
  gainFor(action, t) {
    const GREEN = '#5ac16f';
    // Upgrade doubles the node - the marginal gain is one more base income of its resource.
    if (action === 'upgrade') {
      if (t.resource === 'special') return { icon: 'special', tint: TINT.special, big: `+${SPECIAL_INCOME}`, unit: 'each / turn', color: GREEN };
      return { icon: t.resource, tint: TINT[t.resource], big: `+${NODE_INCOME}`, unit: '/ turn', color: GREEN };
    }
    if (action === 'claim') return { icon: null, big: '+1', unit: 'tile', color: '#aeb4c6' };
    // build / siege - you take the tile's node income. A captured node arrives un-upgraded (siege
    // strips the ×2) and neutral build targets are never upgraded, so the gain is always the base.
    if (t.home) return { icon: 'home', tint: 0xf2c14e, big: 'WIN', unit: 'take their base', color: '#f2c14e' };
    if (t.resource === 'special') return { icon: 'special', tint: TINT.special, big: `+${SPECIAL_INCOME}`, unit: 'each / turn', color: GREEN };
    if (t.resource) return { icon: t.resource, tint: TINT[t.resource], big: `+${NODE_INCOME}`, unit: '/ turn', color: GREEN };
    return { icon: null, big: '+1', unit: 'tile', color: '#aeb4c6' }; // plain enemy tile
  }

  hideTooltip() {
    if (this.tooltip) { this.tooltip.destroy(); this.tooltip = null; }
    this.selected = null;
  }

  // Icon-forward callout (mockup style C): big gain up top on a dark card with a colored border,
  // the action + cost in a colored footer, and a pointer down to the tile (flips up near the top).
  // Also marks (r,c) as the selected tile - see onTilePointerDown for why that matters on touch.
  showTooltip(r, c) {
    const act = this.actionFor(r, c);
    if (!act) { this.hideTooltip(); return; }
    this.hideTooltip();
    this.selected = { r, c };
    const t = this.tiles[r][c];
    const gain = this.gainFor(act.action, t);
    const font = 'system-ui, -apple-system, sans-serif';
    const DARK = '#12141f', DARK_HEX = 0x12141f;

    const cont = this.add.container(0, 0).setDepth(50);
    const g = this.add.graphics();
    cont.add(g);

    // Gain row: [icon] [big number] [small unit], measured so we can center it.
    const gap = 8;
    const parts = [];
    if (gain.icon) {
      const im = this.add.image(0, 0, `ic_${gain.icon}`).setDisplaySize(32, 32).setTint(gain.tint).setOrigin(0, 0.5);
      parts.push({ o: im, w: 32 });
    }
    const num = this.add.text(0, 0, gain.big, { fontFamily: font, fontSize: '38px', fontStyle: 'bold', color: gain.color }).setOrigin(0, 0.5);
    parts.push({ o: num, w: num.width });
    if (gain.unit) {
      const un = this.add.text(0, 0, gain.unit, { fontFamily: font, fontSize: '15px', fontStyle: 'bold', color: '#7c8398' }).setOrigin(0, 0.5);
      parts.push({ o: un, w: un.width });
    }
    const gainW = parts.reduce((s, p) => s + p.w, 0) + gap * (parts.length - 1);

    // Footer row: [verb] then one or two [cost icon][cost number] pairs (a node siege costs
    // gold + wood), all in the dark ink over the colored bar.
    const ICON_W = 21, GAP_IN = 4, GAP_PAIR = 10;
    const verb = this.add.text(0, 0, act.verb, { fontFamily: font, fontSize: '18px', fontStyle: 'bold', color: DARK }).setOrigin(0, 0.5);
    const costs = [{ res: act.costRes, val: act.cost }];
    if (act.costRes2) costs.push({ res: act.costRes2, val: act.cost2 });
    // Costs are shown as "-N" (a minus, matching the "+N" gains up top) so the footer reads
    // unmistakably as "this SPENDS N", not "you gain N" - fixes the ambiguous "Claim 5 gold".
    const costParts = costs.map(({ res, val }) => ({
      icon: this.add.image(0, 0, `ic_${res}`).setDisplaySize(ICON_W, ICON_W).setTint(DARK_HEX).setOrigin(0, 0.5),
      num: this.add.text(0, 0, `-${val}`, { fontFamily: font, fontSize: '18px', fontStyle: 'bold', color: DARK }).setOrigin(0, 0.5),
    }));
    const footW = verb.width + costParts.reduce((s, cp) => s + GAP_PAIR + ICON_W + GAP_IN + cp.num.width, 0);

    // Card geometry.
    const PAD = 15, RADIUS = 14, FOOT_H = 34, TIP = 11, GAIN_H = 52;
    const bodyW = Math.max(gainW, footW) + PAD * 2;
    const bodyH = GAIN_H + FOOT_H;

    // Position: pointer tip on the tile's top-center; flip below the tile if it would clip the top.
    const cx = this.originX + c * TILE + TILE / 2;
    const tileTop = this.originY + r * TILE, tileBot = this.originY + (r + 1) * TILE;
    const bx = Phaser.Math.Clamp(cx - bodyW / 2, 8, this.scale.gameSize.width - 8 - bodyW);
    let by = tileTop - 4 - TIP - bodyH;
    let flip = false;
    if (by < 8) { flip = true; by = tileBot + 4 + TIP; }
    const px = Phaser.Math.Clamp(cx - bx, RADIUS + 9, bodyW - RADIUS - 9); // pointer x, local

    // Draw: dark body, colored footer, colored border, colored pointer.
    g.fillStyle(DARK_HEX, 1).fillRoundedRect(0, 0, bodyW, bodyH, RADIUS);
    g.fillStyle(act.color, 1).fillRoundedRect(0, bodyH - FOOT_H, bodyW, FOOT_H, { tl: 0, tr: 0, bl: RADIUS, br: RADIUS });
    g.lineStyle(2, act.color, 1).strokeRoundedRect(0, 0, bodyW, bodyH, RADIUS);
    g.fillStyle(act.color, 1);
    if (!flip) g.fillTriangle(px - 9, bodyH, px + 9, bodyH, px, bodyH + TIP);
    else g.fillTriangle(px - 9, 0, px + 9, 0, px, -TIP);

    // Place the gain row (centered in the gain area).
    let gx = (bodyW - gainW) / 2;
    for (const p of parts) { p.o.x = gx; p.o.y = GAIN_H / 2; cont.add(p.o); gx += p.w + gap; }

    // Place the footer row (centered in the footer bar).
    const fcy = bodyH - FOOT_H / 2;
    let fx = (bodyW - footW) / 2;
    verb.x = fx; verb.y = fcy; fx += verb.width;
    cont.add(verb);
    for (const cp of costParts) {
      fx += GAP_PAIR;
      cp.icon.x = fx; cp.icon.y = fcy; fx += ICON_W + GAP_IN;
      cp.num.x = fx; cp.num.y = fcy; fx += cp.num.width;
      cont.add([cp.icon, cp.num]);
    }

    cont.setPosition(bx, by);
    this.tooltip = cont;
  }
}
