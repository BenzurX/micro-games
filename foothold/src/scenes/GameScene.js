// GameScene: the whole prototype loop lives here for now. Once the loop is proven
// fun we'll extract reusable pieces (board, economy, AI) into /src/lib and the
// template. Kept in one file while the design is still moving.

import { Sfx } from '../lib/sfx.js';

// ---- Design constants (mirror DESIGN.md; structure locked, NUMBERS tunable by playtest) ----
// Four actions, one job per resource (see DESIGN.md "Actions & the resource split"):
//   Claim  (gold)   = buy an EMPTY neutral tile.
//   Build  (wood)   = buy a neutral tile that HAS a resource node.
//   Siege  (gold)   = take an enemy tile (3x cost if the enemy fortified it).
//   Fortify(stone)  = wall one of your OWN resource nodes (never your home tile).
const GRID_W = 6;               // columns (portrait board)
const GRID_H = 9;               // rows
const MAX_ROUNDS = 12;          // each side gets this many turns, then most tiles wins

// River runs left→right through the middle band of rows; one tile per column, meandering
// ≤1 row per step so it always fully separates the top (enemy) and bottom (player) halves.
const RIVER_BAND = [3, 5];      // inclusive row range the river is allowed to occupy
const BRIDGE_COUNT = 2;         // claimable/passable crossings cut into the river

const CLAIM_COST = 5;             // GOLD to claim an empty neutral tile
const BUILD_COST = 5;            // WOOD to build (buy a neutral resource tile)
const SIEGE_COST = 5;             // GOLD to siege an un-fortified enemy tile (== claim cost)
const SIEGE_FORTIFIED_COST = SIEGE_COST * 3;  // GOLD to siege a fortified enemy tile (3x defense)
const HOME_SIEGE_COST = 50;       // GOLD to siege the enemy HOME tile (deliberately steep)
const FORTIFY_COST = 5;           // STONE to fortify one of your resource nodes

const NODE_INCOME = 10;         // per-turn yield of a matching resource node
const SPECIAL_INCOME = 5;       // per-turn yield of EACH resource from a special (★) node
const BASE_INCOME = 2;          // per-turn yield of EACH resource from your home tile
const START = { wood: 10, gold: 10, stone: 5 }; // each player's opening stockpile

const AI_MAX_ACTIONS = 5;       // cap so the AI can't run away in a single turn

// Action highlight colors (mirror the DESIGN.md / mockup legend).
const ACTION_COLOR = {
  claim:   0xffce3a, // gold
  build:   0x57c97a, // green
  fortify: 0xb06bff, // purple
  siege:   0xff6a3d, // red/orange
};

// Board layout in our fixed 720x1280 design space. Square tiles; 6 wide x 9 tall.
const TILE = 82;
const BOARD_W = GRID_W * TILE;         // 492
const BOARD_H = GRID_H * TILE;         // 738
const ORIGIN_X = (720 - BOARD_W) / 2;  // centered horizontally
const ORIGIN_Y = 250;

// Owner tile fill colours.
const FILL = { 0: 0x2b2f45, 1: 0x274a9d, 2: 0x9d2f3a };
const RIVER_COLOR = 0x264f6e;   // deep water (main body of the flowing river ribbon)
const RIVER_TILE = 0x1a1c29;    // river-tile background: same hue as the neutral tile, just darker
                                // (reads as unclaimable). Bridges keep the normal shade — they ARE claimable.

// Per-resource tint applied to the white icon SVGs (HUD counters + on-board nodes + legend),
// so one icon file reads in each resource's colour and stays on-palette.
const TINT = { gold: 0xf2c14e, wood: 0xb5793a, stone: 0xb9c2d0, special: 0x5ad1c8 };

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.sfx = new Sfx();
    // Web Audio is blocked until a user gesture — resume it on the very first tap.
    this.input.once('pointerdown', () => this.sfx.unlock());
    this.makeSparkTexture();

    this.setupState();
    this.buildBoard();
    this.buildRiver();
    this.buildHud();
    this.buildControls();
    this.buildGameOverOverlay();

    this.startPlayerTurn();
  }

  // A soft white dot used for every particle burst; tinted per action at emit time.
  makeSparkTexture() {
    if (this.textures.exists('spark')) return;
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
    g.generateTexture('spark', 16, 16);
    g.destroy();
  }

  // ---------------------------------------------------------------- state / board gen
  setupState() {
    this.round = 1;
    this.current = 1;          // 1 = human, 2 = AI
    this.inputLocked = false;  // true during AI turn / game over
    this.gameOver = false;

    this.resources = {
      1: { ...START },
      2: { ...START },
    };

    // tiles[r][c] = { owner, resource, fortified, home, river, bridge }
    this.tiles = [];
    for (let r = 0; r < GRID_H; r++) {
      const row = [];
      for (let c = 0; c < GRID_W; c++) {
        row.push({ owner: 0, resource: null, fortified: false, home: false, river: false, bridge: false });
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

    this.ensureHomeOpening(this.homeAI);
    this.ensureHomeOpening(this.homePlayer);
  }

  // A special node one row off the water on the given side — contested, both must push for it.
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

  // Guarantee an opening move: a resource node within 2 tiles of the home, else drop one.
  ensureHomeOpening(home) {
    const near = [];
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        const d = Math.abs(r - home.r) + Math.abs(c - home.c);
        if (d === 0 || d > 2) continue;
        const t = this.tiles[r][c];
        if (t.resource) return; // already has a nearby node
        if (!t.home && !t.river && !t.bridge) near.push({ r, c, d });
      }
    }
    if (near.length) {
      near.sort((a, b) => a.d - b.d);
      const spot = near.find((n) => !this.hasAdjacentNode(n.r, n.c)) || near[0];
      this.tiles[spot.r][spot.c].resource = 'wood';
    }
  }

  buildBoard() {
    // One rectangle + icon image + fortify marker per cell. River tiles are non-interactive.
    this.views = [];
    for (let r = 0; r < GRID_H; r++) {
      const row = [];
      for (let c = 0; c < GRID_W; c++) {
        const x = ORIGIN_X + c * TILE + TILE / 2;
        const y = ORIGIN_Y + r * TILE + TILE / 2;

        const rect = this.add.rectangle(x, y, TILE - 4, TILE - 4, FILL[0]);
        if (!this.tiles[r][c].river) {
          rect.setInteractive({ useHandCursor: true });
          rect.on('pointerdown', () => this.onTileTap(r, c));
          rect.on('pointerover', () => this.showTooltip(r, c));
          rect.on('pointerout', () => this.hideTooltip());
        }

        // Node/home icon: a tinted SVG image, texture + tint set per tile in refresh().
        // Starts hidden with a placeholder texture (empty tiles show nothing).
        // Depth 4 keeps icons above the water ribbon (depth 1-2) at any diagonal overlap.
        const icon = this.add.image(x, y, 'ic_gold').setDisplaySize(50, 50).setVisible(false).setOrigin(0.5).setDepth(4);

        // Fortified marker (top-right): a purple watchtower icon, shown when the tile is walled.
        const fort = this.add.image(x + TILE / 2 - 17, y - TILE / 2 + 17, 'ic_fortify')
          .setDisplaySize(32, 32).setTint(ACTION_COLOR.fortify).setVisible(false).setOrigin(0.5).setDepth(5);

        row.push({ rect, icon, fort });
      }
      this.views.push(row);
    }
  }

  // Draw the river as one continuous, organic water ribbon flowing left→right through the
  // river/bridge columns, instead of solid-blue squares. A Catmull-Rom spline through each
  // column's water-tile center gives smooth, self-connecting curves at the diagonal steps;
  // layered strokes (dark banks → water → lit channel) plus offset ripple lines make it read
  // as flowing water. Bridges are drawn on top as N–S plank decks (see drawBridges).
  buildRiver() {
    const cx = (c) => ORIGIN_X + c * TILE + TILE / 2;
    const cy = (r) => ORIGIN_Y + r * TILE + TILE / 2;

    // Spine points clamped to the board edges so the river is cut cleanly at the frame
    // (the end caps sit vertical on the edge) instead of spilling off the board.
    const pts = [new Phaser.Math.Vector2(ORIGIN_X, cy(this.riverRow[0]))];
    for (let c = 0; c < GRID_W; c++) pts.push(new Phaser.Math.Vector2(cx(c), cy(this.riverRow[c])));
    pts.push(new Phaser.Math.Vector2(ORIGIN_X + BOARD_W, cy(this.riverRow[GRID_W - 1])));

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
    fillRibbon(TILE * 0.35, 0x1c3a52);   // outer depth / bank shadow
    fillRibbon(TILE * 0.29, RIVER_COLOR); // main water
    fillRibbon(TILE * 0.20, 0x35709a);   // lit central channel

    // Ripple highlights: thin lines offset perpendicular to the flow, waving along its length.
    const ripple = (amp, phase, color, alpha) => {
      g.lineStyle(2.5, color, alpha);
      g.beginPath();
      line.forEach((p, i) => {
        const a = line[Math.max(0, i - 1)];
        const b = line[Math.min(line.length - 1, i + 1)];
        const tx = b.x - a.x, ty = b.y - a.y;
        const len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len, ny = tx / len;              // unit normal to the flow
        const off = Math.sin(i * 0.45 + phase) * amp;      // sine wave along the run
        const x = p.x + nx * off, y = p.y + ny * off;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.strokePath();
    };
    ripple(TILE * 0.15, 0.0, 0x8fc4e6, 0.5);
    ripple(TILE * 0.11, 2.3, 0xc4e3f4, 0.32);

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
    // Each card = icon + big amount + green income delta. Emoji are placeholders for a TBD
    // icon set (matches the mockup). Gear is a visual placeholder; settings not wired yet.
    const pad = 20, gap = 12, gearW = 60, cardH = 76, top = 24;
    const cardW = Math.floor((720 - pad * 2 - gearW - gap * 3) / 3); // 3 cards + gear across
    const order = ['gold', 'wood', 'stone'];

    this.counters = {};
    order.forEach((res, i) => {
      const x = pad + i * (cardW + gap);
      this.panel(x, top, cardW, cardH, PANEL);
      // Icon pinned far left; total floats to the right edge with a big gap between them.
      this.add.image(x + 14 + 20, top + cardH / 2, `ic_${res}`)
        .setDisplaySize(40, 40).setTint(TINT[res]).setOrigin(0.5);
      // Total on top, floated right; smaller green income stacked just below it with a gap.
      const amt = this.add.text(x + cardW - 14, top + 8, '', {
        fontFamily: font, fontSize: '36px', fontStyle: 'bold', color: '#e7e9f0',
      }).setOrigin(1, 0);
      const inc = this.add.text(x + cardW - 14, top + 8 + 36 + 5, '', {
        fontFamily: font, fontSize: '20px', fontStyle: 'bold', color: '#5ac16f',
      }).setOrigin(1, 0);
      this.counters[res] = { amt, inc };
    });

    // Gear (settings placeholder — not interactive until a settings screen exists).
    const gx = 720 - pad - gearW;
    this.panel(gx, top, gearW, cardH, PANEL);
    this.add.text(gx + gearW / 2, top + cardH / 2, '⚙️', { fontFamily: font, fontSize: '30px' })
      .setOrigin(0.5);

    // --- Round + turn status, and the tile score (the win metric — kept though B omits it) ---
    this.turnText = this.add.text(360, 140, '', {
      fontFamily: font, fontSize: '34px', fontStyle: 'bold', color: '#e7e9f0',
    }).setOrigin(0.5, 0);
    this.tilesText = this.add.text(360, 196, '', {
      fontFamily: font, fontSize: '26px', color: '#aeb4c6',
    }).setOrigin(0.5, 0);
  }

  buildControls() {
    const font = 'system-ui, -apple-system, sans-serif';

    // --- Action color-key legend (HUD direction B), as paneled swatch rows in a 2x2 grid. ---
    // Each row: swatch in the action's board-glow color + label + what it targets + its cost.
    // So "what can I do, and which tiles" reads in one place. Emoji costs are icon placeholders.
    const legend = [
      { color: ACTION_COLOR.claim,   label: 'Claim empty tiles',      desc: 'Expand your territory',       res: 'gold',  amt: CLAIM_COST },
      { color: ACTION_COLOR.build,   label: 'Build on resource nodes', desc: 'Harvest tile resources',     res: 'wood',  amt: BUILD_COST },
      { color: ACTION_COLOR.fortify, label: 'Fortify resource nodes',  desc: 'x3 enemy capture cost',      res: 'stone', amt: FORTIFY_COST },
      { color: ACTION_COLOR.siege,   label: 'Siege enemy tiles',       desc: 'x3 against fortified nodes', res: 'gold',  amt: SIEGE_COST },
    ];
    const pad = 20, gap = 12, rowW = Math.floor((720 - pad * 2 - gap) / 2), rowH = 60;
    const legTop = ORIGIN_Y + BOARD_H + 12; // just under the board
    const SW = 30; // swatch size, outline-only to echo the board tiles
    legend.forEach((item, i) => {
      const x = pad + (i % 2) * (rowW + gap);
      const y = legTop + Math.floor(i / 2) * (rowH + 8);
      const yMid = y + rowH / 2;
      const g = this.panel(x, y, rowW, rowH, 0x22263a, 10);
      // Border-only swatch in the action's board-glow color — same read as an outlined tile.
      g.lineStyle(4, item.color, 1).strokeRoundedRect(x + 12, yMid - SW / 2, SW, SW, 6);
      const textX = x + 12 + SW + 14;
      // Label + desc tightened around the row's vertical center so the title sits centered.
      this.add.text(textX, yMid + 1, item.label, {
        fontFamily: font, fontSize: '18px', fontStyle: 'bold', color: '#e7e9f0',
      }).setOrigin(0, 1);
      this.add.text(textX, yMid + 3, item.desc, {
        fontFamily: font, fontSize: '15px', color: '#7c8398',
      }).setOrigin(0, 0);
      // Cost: number right-aligned, with a tinted resource icon just to its left.
      const amtText = this.add.text(x + rowW - 12, yMid, `${item.amt}`, {
        fontFamily: font, fontSize: '28px', fontStyle: 'bold', color: '#e7e9f0',
      }).setOrigin(1, 0.5);
      this.add.image(x + rowW - 12 - amtText.width - 8, yMid, `ic_${item.res}`)
        .setDisplaySize(30, 30).setTint(TINT[item.res]).setOrigin(1, 0.5);
    });

    // --- End Turn, below the legend ---
    const btnY = legTop + 2 * rowH + 8 + 16 + 48; // legend block + gap + half button height
    this.endBtn = this.add.rectangle(360, btnY, 320, 96, 0x3d6cff)
      .setInteractive({ useHandCursor: true });
    this.endBtnText = this.add.text(360, btnY, 'End Turn', {
      fontFamily: font, fontSize: '38px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    this.endBtn.on('pointerdown', () => this.onEndTurn());
  }

  buildGameOverOverlay() {
    this.overlay = this.add.container(0, 0).setVisible(false).setDepth(10);
    const bg = this.add.rectangle(360, 640, 720, 1280, 0x000000, 0.72);
    this.resultText = this.add.text(360, 560, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '54px', fontStyle: 'bold', color: '#ffffff',
      align: 'center', wordWrap: { width: 680 },
    }).setOrigin(0.5);
    const againBtn = this.add.rectangle(360, 720, 320, 96, 0x3d6cff).setInteractive({ useHandCursor: true });
    const againText = this.add.text(360, 720, 'Play Again', {
      fontFamily: 'system-ui, sans-serif', fontSize: '38px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    againBtn.on('pointerdown', () => this.scene.restart());
    this.overlay.add([bg, this.resultText, againBtn, againText]);
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
    this.resources[p].wood += inc.wood;
    this.resources[p].gold += inc.gold;
    this.resources[p].stone += inc.stone;
  }

  computeIncome(p) {
    const inc = { wood: 0, gold: 0, stone: 0 };
    this.forEachTile((t) => {
      if (t.owner !== p) return;
      // Home tile trickles a little of everything so you're never fully locked out.
      if (t.home) { inc.wood += BASE_INCOME; inc.gold += BASE_INCOME; inc.stone += BASE_INCOME; }
      if (t.resource === 'wood') inc.wood += NODE_INCOME;
      else if (t.resource === 'gold') inc.gold += NODE_INCOME;
      else if (t.resource === 'stone') inc.stone += NODE_INCOME;
      // Special = generalist: a flat little of all three (additive, never a multiplier).
      else if (t.resource === 'special') {
        inc.wood += SPECIAL_INCOME; inc.gold += SPECIAL_INCOME; inc.stone += SPECIAL_INCOME;
      }
    });
    return inc;
  }

  // ---------------------------------------------------------------- moves
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
      // Enemy tile: Siege (gold). Fortified tiles cost 3x; the enemy home is very steep.
      if (res.gold >= this.siegeCost(t)) move = { type: 'siege', r, c };
    } else if (t.owner === 1 && t.resource && !t.home && !t.fortified && res.stone >= FORTIFY_COST) {
      // Fortify one of your own resource nodes (never your home tile).
      move = { type: 'fortify', r, c };
    }
    if (!move) return; // invalid tap, ignore

    this.applyMove(1, move);
    this.refresh();
    this.juiceAction(move);
    this.checkWin();
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

    this.sfx.play(baseCapture ? 'capture' : move.type);
    this.spark(x, y, color, baseCapture ? 30 : (move.type === 'siege' ? 16 : 12), baseCapture ? 340 : 220);
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
    // Emit at the emitter's own (x,y) — passing x,y to explode again would double the offset.
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
      t.owner = p;
      t.fortified = false; // siege breaks the wall as it takes the tile
    } else if (move.type === 'fortify') {
      this.resources[p].stone -= FORTIFY_COST;
      t.fortified = true;
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
    const sieges = [];   // enemy tiles adjacent to AI                (Siege, gold; 3x if walled)
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
    const siegeCost = (t) => this.siegeCost(t);

    // Priority: siege enemy node > build own node > siege anything > claim empty > fortify frontline.
    const sgNode = sieges.find((x) => x.t.resource && gold >= siegeCost(x.t));
    if (sgNode) return { type: 'siege', r: sgNode.r, c: sgNode.c };

    if (wood >= BUILD_COST && builds.length) {
      return { type: 'build', r: builds[0].r, c: builds[0].c };
    }

    const sgAny = sieges.find((x) => gold >= siegeCost(x.t));
    if (sgAny) return { type: 'siege', r: sgAny.r, c: sgAny.c };

    if (gold >= CLAIM_COST && empties.length) {
      return { type: 'claim', r: empties[0].r, c: empties[0].c };
    }

    // Otherwise fortify a frontline resource node (own node bordering the enemy, never home).
    if (stone >= FORTIFY_COST) {
      for (let r = 0; r < GRID_H; r++) {
        for (let c = 0; c < GRID_W; c++) {
          const t = this.tiles[r][c];
          if (t.owner === me && t.resource && !t.home && !t.fortified && this.isAdjacentTo(r, c, foe)) {
            return { type: 'fortify', r, c };
          }
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- helpers
  // Gold cost to siege an enemy tile: home is deliberately steep, walls triple the base.
  siegeCost(t) {
    if (t.home) return HOME_SIEGE_COST;
    return t.fortified ? SIEGE_FORTIFIED_COST : SIEGE_COST;
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
    let done = false, msg = null, sub = `${you} vs ${ai} tiles`, result = null;
    if (aiBaseOwner === 1) { done = true; result = 'you'; msg = `You Win on Round ${winRound}!`; sub = 'Enemy base captured'; }
    else if (yourBaseOwner === 2) { done = true; result = 'ai'; msg = 'AI wins'; sub = 'Your base fell'; }
    else if (this.round > MAX_ROUNDS) {                   // time up → most tiles wins
      done = true;
      if (you > ai) { result = 'you'; msg = `You Win on Round ${winRound}!`; }
      else if (ai > you) { result = 'ai'; msg = 'AI wins'; }
      else { result = 'draw'; msg = 'Draw'; }
    }

    if (!done) return false;

    this.gameOver = true;
    this.inputLocked = true;
    this.refresh();
    this.showGameOver(msg, sub, result);
    return true;
  }

  // Fade the dark overlay in and pop the result text, with a win/lose sting slightly delayed
  // so it doesn't collide with the final action's sound (e.g. the base-capture siege hit).
  showGameOver(msg, sub, result) {
    this.resultText.setText(`${msg}\n${sub}`);
    this.overlay.setAlpha(0).setVisible(true);
    this.tweens.add({ targets: this.overlay, alpha: 1, duration: 300, ease: 'Quad.easeOut' });
    this.resultText.setScale(0.6);
    this.tweens.add({ targets: this.resultText, scale: 1, duration: 500, ease: 'Back.easeOut', delay: 120 });
    if (result === 'you') this.time.delayedCall(220, () => this.sfx.play('win'));
    else if (result === 'ai') this.time.delayedCall(220, () => this.sfx.play('lose'));
  }

  refresh() {
    const humanTurn = this.current === 1 && !this.inputLocked && !this.gameOver;
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
        v.icon.setTexture(`ic_${t.resource}`).setDisplaySize(50, 50).setTint(TINT[t.resource]).setVisible(true);
      } else if (t.home) {
        v.icon.setTexture('ic_home').setDisplaySize(50, 50).setTint(0xffffff).setVisible(true);
      } else {
        v.icon.setVisible(false);
      }

      v.fort.setVisible(t.fortified);

      // Highlight actionable tiles for the human, colored by action (mirror the legend).
      // Same source of truth as the hover tooltip, so glow and tooltip never disagree.
      const act = this.actionFor(r, c);
      if (act) v.rect.setStrokeStyle(4, act.color);
      else v.rect.setStrokeStyle(0);
    });

    // Bridge decks redraw so their rails tint to whoever now owns the crossing.
    this.drawBridges();

    // HUD — resource counter cards show the stockpile + green per-turn income delta (Mockup 1).
    const r1 = this.resources[1];
    const inc = this.computeIncome(1);
    ['gold', 'wood', 'stone'].forEach((res) => {
      this.counters[res].amt.setText(`${r1[res]}`);
      this.counters[res].inc.setText(`+${inc[res]}`);
    });
    this.tilesText.setText(`Tiles  You ${this.countTiles(1)}  •  AI ${this.countTiles(2)}`);
    if (this.gameOver) this.turnText.setText('Game Over');
    else this.turnText.setText(`Round ${Math.min(this.round, MAX_ROUNDS)}/${MAX_ROUNDS}  —  ${this.current === 1 ? 'Your turn' : 'AI thinking…'}`);

    // End Turn button state.
    const canEnd = humanTurn;
    this.endBtn.setFillStyle(canEnd ? 0x3d6cff : 0x3a3f57);
    this.endBtnText.setColor(canEnd ? '#ffffff' : '#8a90a6');
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
      return { action: 'claim', verb: 'Claim', color: ACTION_COLOR.claim, costRes: 'gold', cost: CLAIM_COST };
    if (t.owner === 0 && adj && t.resource && res.wood >= BUILD_COST)
      return { action: 'build', verb: 'Build', color: ACTION_COLOR.build, costRes: 'wood', cost: BUILD_COST };
    if (t.owner === 2 && adj && res.gold >= this.siegeCost(t))
      return { action: 'siege', verb: 'Siege', color: ACTION_COLOR.siege, costRes: 'gold', cost: this.siegeCost(t) };
    if (t.owner === 1 && t.resource && !t.home && !t.fortified && res.stone >= FORTIFY_COST)
      return { action: 'fortify', verb: 'Fortify', color: ACTION_COLOR.fortify, costRes: 'stone', cost: FORTIFY_COST };
    return null;
  }

  // What the player GAINS from the action — the star of the tooltip (big icon + number).
  gainFor(action, t) {
    const GREEN = '#5ac16f';
    if (action === 'fortify') return { icon: 'fortify', tint: ACTION_COLOR.fortify, big: '×3', unit: 'vs siege', color: '#caa9ff' };
    if (action === 'claim') return { icon: null, big: '+1', unit: 'tile', color: '#aeb4c6' };
    // build / siege — you take the tile's node income (siege steals it from the enemy).
    if (t.home) return { icon: 'home', tint: 0xf2c14e, big: 'WIN', unit: 'take their base', color: '#f2c14e' };
    if (t.resource === 'special') return { icon: 'special', tint: TINT.special, big: '+5', unit: 'each / turn', color: GREEN };
    if (t.resource) return { icon: t.resource, tint: TINT[t.resource], big: `+${NODE_INCOME}`, unit: '/ turn', color: GREEN };
    return { icon: null, big: '+1', unit: 'tile', color: '#aeb4c6' }; // plain enemy tile
  }

  hideTooltip() {
    if (this.tooltip) { this.tooltip.destroy(); this.tooltip = null; }
  }

  // Icon-forward callout (mockup style C): big gain up top on a dark card with a colored border,
  // the action + cost in a colored footer, and a pointer down to the tile (flips up near the top).
  showTooltip(r, c) {
    const act = this.actionFor(r, c);
    if (!act) { this.hideTooltip(); return; }
    this.hideTooltip();
    const t = this.tiles[r][c];
    const gain = this.gainFor(act.action, t);
    const font = 'system-ui, -apple-system, sans-serif';
    const DARK = '#12141f', DARK_HEX = 0x12141f;

    const cont = this.add.container(0, 0).setDepth(50);
    const g = this.add.graphics();
    cont.add(g);

    // Gain row: [icon] [big number] [small unit], measured so we can center it.
    const gap = 6;
    const parts = [];
    if (gain.icon) {
      const im = this.add.image(0, 0, `ic_${gain.icon}`).setDisplaySize(26, 26).setTint(gain.tint).setOrigin(0, 0.5);
      parts.push({ o: im, w: 26 });
    }
    const num = this.add.text(0, 0, gain.big, { fontFamily: font, fontSize: '30px', fontStyle: 'bold', color: gain.color }).setOrigin(0, 0.5);
    parts.push({ o: num, w: num.width });
    if (gain.unit) {
      const un = this.add.text(0, 0, gain.unit, { fontFamily: font, fontSize: '12px', fontStyle: 'bold', color: '#7c8398' }).setOrigin(0, 0.5);
      parts.push({ o: un, w: un.width });
    }
    const gainW = parts.reduce((s, p) => s + p.w, 0) + gap * (parts.length - 1);

    // Footer row: [verb] [cost icon] [cost number], all in the dark ink over the colored bar.
    const verb = this.add.text(0, 0, act.verb, { fontFamily: font, fontSize: '15px', fontStyle: 'bold', color: DARK }).setOrigin(0, 0.5);
    const cIcon = this.add.image(0, 0, `ic_${act.costRes}`).setDisplaySize(17, 17).setTint(DARK_HEX).setOrigin(0, 0.5);
    const cNum = this.add.text(0, 0, `${act.cost}`, { fontFamily: font, fontSize: '15px', fontStyle: 'bold', color: DARK }).setOrigin(0, 0.5);
    const footW = verb.width + 8 + 17 + 3 + cNum.width;

    // Card geometry.
    const PAD = 12, RADIUS = 12, FOOT_H = 28, TIP = 9, GAIN_H = 42;
    const bodyW = Math.max(gainW, footW) + PAD * 2;
    const bodyH = GAIN_H + FOOT_H;

    // Position: pointer tip on the tile's top-center; flip below the tile if it would clip the top.
    const cx = ORIGIN_X + c * TILE + TILE / 2;
    const tileTop = ORIGIN_Y + r * TILE, tileBot = ORIGIN_Y + (r + 1) * TILE;
    const bx = Phaser.Math.Clamp(cx - bodyW / 2, 8, 720 - 8 - bodyW);
    let by = tileTop - 4 - TIP - bodyH;
    let flip = false;
    if (by < 8) { flip = true; by = tileBot + 4 + TIP; }
    const px = Phaser.Math.Clamp(cx - bx, RADIUS + 7, bodyW - RADIUS - 7); // pointer x, local

    // Draw: dark body, colored footer, colored border, colored pointer.
    g.fillStyle(DARK_HEX, 1).fillRoundedRect(0, 0, bodyW, bodyH, RADIUS);
    g.fillStyle(act.color, 1).fillRoundedRect(0, bodyH - FOOT_H, bodyW, FOOT_H, { tl: 0, tr: 0, bl: RADIUS, br: RADIUS });
    g.lineStyle(2, act.color, 1).strokeRoundedRect(0, 0, bodyW, bodyH, RADIUS);
    g.fillStyle(act.color, 1);
    if (!flip) g.fillTriangle(px - 7, bodyH, px + 7, bodyH, px, bodyH + TIP);
    else g.fillTriangle(px - 7, 0, px + 7, 0, px, -TIP);

    // Place the gain row (centered in the gain area).
    let gx = (bodyW - gainW) / 2;
    for (const p of parts) { p.o.x = gx; p.o.y = GAIN_H / 2; cont.add(p.o); gx += p.w + gap; }

    // Place the footer row (centered in the footer bar).
    const fcy = bodyH - FOOT_H / 2;
    let fx = (bodyW - footW) / 2;
    verb.x = fx; verb.y = fcy; fx += verb.width + 8;
    cIcon.x = fx; cIcon.y = fcy; fx += 17 + 3;
    cNum.x = fx; cNum.y = fcy;
    cont.add([verb, cIcon, cNum]);

    cont.setPosition(bx, by);
    this.tooltip = cont;
  }
}
