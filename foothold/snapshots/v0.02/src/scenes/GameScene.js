// GameScene: the whole prototype loop lives here for now. Once the loop is proven
// fun we'll extract reusable pieces (board, economy, AI) into /src/lib and the
// template. Kept in one file while the design is still moving.

// ---- Design constants (mirror DESIGN.md; structure locked, NUMBERS tunable by playtest) ----
// Four actions, one job per resource (see DESIGN.md "Actions & the resource split"):
//   Claim  (gold)   = buy an EMPTY neutral tile.
//   Build  (wood)   = buy a neutral tile that HAS a resource node.
//   Siege  (gold)   = take an enemy tile (2x cost if the enemy fortified it).
//   Fortify(stone)  = wall one of your OWN resource nodes (never your home tile).
const GRID = 8;                 // 8x8 board
const MAX_ROUNDS = 12;          // each side gets this many turns, then most tiles wins

const CLAIM_COST = 5;             // GOLD to claim an empty neutral tile
const BUILD_COST = 5;            // WOOD to build (buy a neutral resource tile)
const SIEGE_COST = 5;             // GOLD to siege an un-fortified enemy tile (== claim cost)
const SIEGE_FORTIFIED_COST = 10;  // GOLD to siege a fortified enemy tile (2x)
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

// Board layout in our fixed 720x1280 design space.
const BOARD_PX = 680;
const TILE = BOARD_PX / GRID;   // 85px tiles
const ORIGIN_X = (720 - BOARD_PX) / 2;
const ORIGIN_Y = 300;

// Node visuals: letter + colour.
const NODES = {
  wood:    { label: 'W', color: '#b5793a' },
  gold:    { label: 'G', color: '#f2c14e' },
  stone:   { label: 'S', color: '#b9c2d0' },
  special: { label: '★', color: '#5ad1c8' },
};

// Owner tile fill colours.
const FILL = { 0: 0x2b2f45, 1: 0x274a9d, 2: 0x9d2f3a };

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.setupState();
    this.buildBoard();
    this.buildHud();
    this.buildControls();
    this.buildGameOverOverlay();

    this.startPlayerTurn();
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

    // tiles[r][c] = { owner, resource, fortified, home }
    this.tiles = [];
    for (let r = 0; r < GRID; r++) {
      const row = [];
      for (let c = 0; c < GRID; c++) {
        row.push({ owner: 0, resource: null, fortified: false, home: false });
      }
      this.tiles.push(row);
    }

    // Home corners: player (1) bottom-right, AI (2) top-left.
    this.tiles[GRID - 1][GRID - 1].owner = 1;
    this.tiles[GRID - 1][GRID - 1].home = true;
    this.tiles[0][0].owner = 2;
    this.tiles[0][0].home = true;

    // Scatter resource nodes on random non-home cells (procedural = replayable).
    const cells = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (this.tiles[r][c].home) continue;
        cells.push({ r, c });
      }
    }
    Phaser.Utils.Array.Shuffle(cells);
    const plan = [
      ['wood', 6], ['gold', 6], ['stone', 6], ['special', 2],
    ];
    let i = 0;
    for (const [type, count] of plan) {
      for (let n = 0; n < count; n++) {
        const { r, c } = cells[i++];
        this.tiles[r][c].resource = type;
      }
    }
  }

  buildBoard() {
    // One interactive rectangle + icon text + fortify marker per cell.
    this.views = [];
    for (let r = 0; r < GRID; r++) {
      const row = [];
      for (let c = 0; c < GRID; c++) {
        const x = ORIGIN_X + c * TILE + TILE / 2;
        const y = ORIGIN_Y + r * TILE + TILE / 2;

        const rect = this.add.rectangle(x, y, TILE - 4, TILE - 4, FILL[0])
          .setInteractive({ useHandCursor: true });
        rect.on('pointerdown', () => this.onTileTap(r, c));

        const icon = this.add.text(x, y, '', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '34px',
          fontStyle: 'bold',
        }).setOrigin(0.5);

        // Filled purple shield marker (top-right) for fortified tiles. Drawn as a polygon
        // rather than an emoji so it can be the exact fortify-purple with a dark outline for
        // contrast against blue/red owner fills.
        const sx = x + TILE / 2 - 15;
        const sy = y - TILE / 2 + 15;
        const sw = 18, sh = 22;
        const fort = this.add.graphics().setVisible(false);
        fort.fillStyle(ACTION_COLOR.fortify, 1);
        fort.lineStyle(2, 0x2a1b3d, 1);
        const pts = [
          sx - sw / 2, sy - sh / 2,
          sx + sw / 2, sy - sh / 2,
          sx + sw / 2, sy,
          sx,          sy + sh / 2,
          sx - sw / 2, sy,
        ];
        fort.beginPath();
        fort.moveTo(pts[0], pts[1]);
        for (let p = 2; p < pts.length; p += 2) fort.lineTo(pts[p], pts[p + 1]);
        fort.closePath();
        fort.fillPath();
        fort.strokePath();

        row.push({ rect, icon, fort });
      }
      this.views.push(row);
    }
  }

  buildHud() {
    const style = { fontFamily: 'system-ui, sans-serif', fontSize: '30px', color: '#e7e9f0' };
    this.turnText = this.add.text(360, 40, '', { ...style, fontSize: '34px', fontStyle: 'bold' }).setOrigin(0.5, 0);
    this.youText = this.add.text(20, 110, '', { ...style, fontSize: '23px', color: '#8fb0ff' }).setOrigin(0, 0);
    this.aiText = this.add.text(700, 110, '', { ...style, fontSize: '23px', color: '#ff9aa5' }).setOrigin(1, 0);
    this.countText = this.add.text(360, 200, '', { ...style, fontSize: '26px', color: '#aeb4c6' }).setOrigin(0.5, 0);
  }

  buildControls() {
    const y = ORIGIN_Y + BOARD_PX + 90;
    this.endBtn = this.add.rectangle(360, y, 320, 96, 0x3d6cff)
      .setInteractive({ useHandCursor: true });
    this.endBtnText = this.add.text(360, y, 'End Turn', {
      fontFamily: 'system-ui, sans-serif', fontSize: '38px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    this.endBtn.on('pointerdown', () => this.onEndTurn());

    // Action color-key legend (the B direction): each label is tinted with the same color the
    // matching tiles glow on the board, so "which tiles can I act on" reads at a glance.
    // 2x2 layout below the End Turn button. (Material icons TBD — using letters for now.)
    const legend = [
      { label: 'Claim · 5 gold',        color: '#ffce3a' },
      { label: 'Build · 5 wood',        color: '#57c97a' },
      { label: 'Fortify · 5 stone',     color: '#b06bff' },
      { label: 'Siege · 5 gold (·10 walled)', color: '#ff6a3d' },
    ];
    const lx = [200, 500];
    const ly = [y + 66, y + 104];
    legend.forEach((item, i) => {
      this.add.text(lx[i % 2], ly[Math.floor(i / 2)], item.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '22px', fontStyle: 'bold', color: item.color,
      }).setOrigin(0.5);
    });
  }

  buildGameOverOverlay() {
    this.overlay = this.add.container(0, 0).setVisible(false).setDepth(10);
    const bg = this.add.rectangle(360, 640, 720, 1280, 0x000000, 0.72);
    this.resultText = this.add.text(360, 560, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '64px', fontStyle: 'bold', color: '#ffffff',
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
    this.inputLocked = true;
    this.refresh();
    // Small delay so the human sees the AI "think" rather than teleport.
    this.time.delayedCall(300, () => this.runAITurn());
  }

  runAITurn() {
    this.current = 2;
    this.addIncome(2);

    let actions = 0;
    while (actions < AI_MAX_ACTIONS) {
      const move = this.aiPickMove();
      if (!move) break;
      this.applyMove(2, move);
      actions++;
      if (this.checkWin()) return; // domination mid-turn
    }

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
    const t = this.tiles[r][c];
    const res = this.resources[1];
    const adj = this.isAdjacentTo(r, c, 1);

    if (t.owner === 0 && adj) {
      // Neutral tile: Claim if empty (gold), Build if it holds a resource (wood).
      if (!t.resource && res.gold >= CLAIM_COST) this.applyMove(1, { type: 'claim', r, c });
      else if (t.resource && res.wood >= BUILD_COST) this.applyMove(1, { type: 'build', r, c });
      else return;
    } else if (t.owner === 2 && adj) {
      // Enemy tile: Siege (gold); a fortified tile costs 2x.
      const cost = t.fortified ? SIEGE_FORTIFIED_COST : SIEGE_COST;
      if (res.gold >= cost) this.applyMove(1, { type: 'siege', r, c });
      else return;
    } else if (t.owner === 1 && t.resource && !t.home && !t.fortified && res.stone >= FORTIFY_COST) {
      // Fortify one of your own resource nodes (never your home tile).
      this.applyMove(1, { type: 'fortify', r, c });
    } else {
      return; // invalid tap, ignore
    }
    this.refresh();
    this.checkWin();
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
      this.resources[p].gold -= t.fortified ? SIEGE_FORTIFIED_COST : SIEGE_COST;
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
    const sieges = [];   // enemy tiles adjacent to AI                (Siege, gold; 2x if walled)
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const t = this.tiles[r][c];
        if (!this.isAdjacentTo(r, c, me)) continue;
        if (t.owner === 0 && t.resource) builds.push({ r, c, t });
        else if (t.owner === 0) empties.push({ r, c, t });
        else if (t.owner === foe) sieges.push({ r, c, t });
      }
    }

    const nodeRank = (t) => (t.resource === 'special' ? 3 : t.resource ? 2 : 1);
    const byNode = (a, b) => nodeRank(b.t) - nodeRank(a.t);
    builds.sort(byNode);
    sieges.sort(byNode);
    const siegeCost = (t) => (t.fortified ? SIEGE_FORTIFIED_COST : SIEGE_COST);

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
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
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
  forEachTile(fn) {
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) fn(this.tiles[r][c], r, c);
    }
  }

  // True if cell (r,c) has an orthogonal neighbour owned by player p.
  isAdjacentTo(r, c, p) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
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
    const yourBaseOwner = this.tiles[GRID - 1][GRID - 1].owner; // your base, bottom-right

    let done = false, msg = null, sub = `${you} vs ${ai} tiles`;
    if (aiBaseOwner === 1) { done = true; msg = 'You win!'; sub = 'Enemy base captured'; }
    else if (yourBaseOwner === 2) { done = true; msg = 'AI wins'; sub = 'Your base fell'; }
    else if (this.round > MAX_ROUNDS) {                   // time up → most tiles wins
      done = true;
      if (you > ai) msg = 'You win!';
      else if (ai > you) msg = 'AI wins';
      else msg = 'Draw';
    }

    if (!done) return false;

    this.gameOver = true;
    this.inputLocked = true;
    this.resultText.setText(`${msg}\n${sub}`);
    this.overlay.setVisible(true);
    this.refresh();
    return true;
  }

  refresh() {
    const myWood = this.resources[1].wood;
    const myGold = this.resources[1].gold;
    const myStone = this.resources[1].stone;
    const humanTurn = this.current === 1 && !this.inputLocked && !this.gameOver;

    this.forEachTile((t, r, c) => {
      const v = this.views[r][c];
      v.rect.setFillStyle(FILL[t.owner]);

      // Node icon (always shown so both players can plan around the map).
      if (t.resource) {
        v.icon.setText(NODES[t.resource].label).setColor(NODES[t.resource].color);
      } else if (t.home) {
        v.icon.setText('⌂').setColor('#ffffff');
      } else {
        v.icon.setText('');
      }

      v.fort.setVisible(t.fortified);

      // Highlight actionable tiles for the human, colored by action (mirror the legend).
      let stroke = null;
      if (humanTurn) {
        const adj = this.isAdjacentTo(r, c, 1);
        if (t.owner === 0 && adj && !t.resource && myGold >= CLAIM_COST) stroke = ACTION_COLOR.claim;          // Claim empty (gold)
        else if (t.owner === 0 && adj && t.resource && myWood >= BUILD_COST) stroke = ACTION_COLOR.build;      // Build node (wood)
        else if (t.owner === 2 && adj && myGold >= (t.fortified ? SIEGE_FORTIFIED_COST : SIEGE_COST)) stroke = ACTION_COLOR.siege; // Siege enemy (gold)
        else if (t.owner === 1 && t.resource && !t.home && !t.fortified && myStone >= FORTIFY_COST) stroke = ACTION_COLOR.fortify; // Fortify own node (stone)
      }
      if (stroke !== null) v.rect.setStrokeStyle(4, stroke);
      else v.rect.setStrokeStyle(0);
    });

    // HUD — player resources show per-turn income in parentheses (like Mockup 1's +N deltas).
    const r1 = this.resources[1], r2 = this.resources[2];
    const inc = this.computeIncome(1);
    this.youText.setText(`YOU\nG ${r1.gold} (+${inc.gold})  W ${r1.wood} (+${inc.wood})  S ${r1.stone} (+${inc.stone})`);
    this.aiText.setText(`AI\nG ${r2.gold}  W ${r2.wood}  S ${r2.stone}`);
    this.countText.setText(`Tiles  You ${this.countTiles(1)}  •  AI ${this.countTiles(2)}`);
    if (this.gameOver) this.turnText.setText('Game Over');
    else this.turnText.setText(`Round ${Math.min(this.round, MAX_ROUNDS)}/${MAX_ROUNDS}  —  ${this.current === 1 ? 'Your turn' : 'AI thinking…'}`);

    // End Turn button state.
    const canEnd = humanTurn;
    this.endBtn.setFillStyle(canEnd ? 0x3d6cff : 0x3a3f57);
    this.endBtnText.setColor(canEnd ? '#ffffff' : '#8a90a6');
  }
}
