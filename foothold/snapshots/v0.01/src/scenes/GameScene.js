// GameScene: the whole prototype loop lives here for now. Once the loop is proven
// fun we'll extract reusable pieces (board, economy, AI) into /src/lib and the
// template. Kept in one file while the design is still moving.

// ---- Tunable design constants (mirror DESIGN.md; all ASSUMED, expect to balance) ----
const GRID = 8;                 // 8x8 board
const MAX_ROUNDS = 12;          // each side gets this many turns, then most tiles wins
const WIN_SHARE = 0.6;          // early win at >= 60% board control

const CLAIM_COST = 3;           // gold to claim a neutral adjacent tile
const CAPTURE_COST = 5;         // gold to capture an undefended enemy tile
const FORTIFY_COST = 4;         // stone to fortify one of your tiles
const NODE_INCOME = 2;          // per-turn yield of a matching resource node
const HOME_GOLD = 1;            // baseline gold/turn from your home tile
const AI_MAX_ACTIONS = 5;       // cap so the AI can't run away in a single turn

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
      1: { wood: 0, gold: 5, stone: 0 },
      2: { wood: 0, gold: 5, stone: 0 },
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

    // Home corners.
    this.tiles[0][0].owner = 1;
    this.tiles[0][0].home = true;
    this.tiles[GRID - 1][GRID - 1].owner = 2;
    this.tiles[GRID - 1][GRID - 1].home = true;

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

        // Small shield marker for fortified tiles.
        const fort = this.add.text(x + TILE / 2 - 14, y - TILE / 2 + 12, '🛡', {
          fontSize: '20px',
        }).setOrigin(0.5).setVisible(false);

        row.push({ rect, icon, fort });
      }
      this.views.push(row);
    }
  }

  buildHud() {
    const style = { fontFamily: 'system-ui, sans-serif', fontSize: '30px', color: '#e7e9f0' };
    this.turnText = this.add.text(360, 40, '', { ...style, fontSize: '34px', fontStyle: 'bold' }).setOrigin(0.5, 0);
    this.youText = this.add.text(20, 110, '', { ...style, color: '#8fb0ff' }).setOrigin(0, 0);
    this.aiText = this.add.text(700, 110, '', { ...style, color: '#ff9aa5' }).setOrigin(1, 0);
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

    this.hintText = this.add.text(360, y + 70,
      'Tap glowing tiles to claim/capture. Tap your tile to fortify (4 stone).',
      { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#7c8398' }
    ).setOrigin(0.5);
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
    let specials = 0;
    this.forEachTile((t) => {
      if (t.owner !== p) return;
      if (t.home) inc.gold += HOME_GOLD;
      if (t.resource === 'wood') inc.wood += NODE_INCOME;
      else if (t.resource === 'gold') inc.gold += NODE_INCOME;
      else if (t.resource === 'stone') inc.stone += NODE_INCOME;
      else if (t.resource === 'special') specials += 1;
    });
    // Each owned special adds a multiplier step (1 special = x2, 2 = x3, ...).
    const mult = 1 + specials;
    inc.wood *= mult; inc.gold *= mult; inc.stone *= mult;
    return inc;
  }

  // ---------------------------------------------------------------- moves
  onTileTap(r, c) {
    if (this.inputLocked || this.gameOver || this.current !== 1) return;
    const t = this.tiles[r][c];
    const res = this.resources[1];

    if (t.owner === 0 && this.isAdjacentTo(r, c, 1) && res.gold >= CLAIM_COST) {
      this.applyMove(1, { type: 'claim', r, c });
    } else if (t.owner === 2 && !t.fortified && this.isAdjacentTo(r, c, 1) && res.gold >= CAPTURE_COST) {
      this.applyMove(1, { type: 'capture', r, c });
    } else if (t.owner === 1 && !t.fortified && res.stone >= FORTIFY_COST) {
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
    } else if (move.type === 'capture') {
      this.resources[p].gold -= CAPTURE_COST;
      t.owner = p;
      t.fortified = false; // captured tiles arrive un-fortified
    } else if (move.type === 'fortify') {
      this.resources[p].stone -= FORTIFY_COST;
      t.fortified = true;
    }
  }

  // ---------------------------------------------------------------- AI (greedy)
  aiPickMove() {
    const me = 2, foe = 1;
    const gold = this.resources[2].gold;
    const stone = this.resources[2].stone;

    const claims = [];   // neutral tiles adjacent to AI
    const captures = []; // undefended enemy tiles adjacent to AI
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const t = this.tiles[r][c];
        if (!this.isAdjacentTo(r, c, me)) continue;
        if (t.owner === 0) claims.push({ r, c, t });
        else if (t.owner === foe && !t.fortified) captures.push({ r, c, t });
      }
    }

    const nodeRank = (t) => (t.resource === 'special' ? 3 : t.resource ? 2 : 1);
    const byNode = (a, b) => nodeRank(b.t) - nodeRank(a.t);
    claims.sort(byNode);
    captures.sort(byNode);

    // Priority: capture enemy node > claim node > capture anything > claim anything.
    if (gold >= CAPTURE_COST) {
      const cap = captures.find((x) => x.t.resource);
      if (cap) return { type: 'capture', r: cap.r, c: cap.c };
    }
    if (gold >= CLAIM_COST) {
      const cl = claims.find((x) => x.t.resource);
      if (cl) return { type: 'claim', r: cl.r, c: cl.c };
    }
    if (gold >= CAPTURE_COST && captures.length) {
      return { type: 'capture', r: captures[0].r, c: captures[0].c };
    }
    if (gold >= CLAIM_COST && claims.length) {
      return { type: 'claim', r: claims[0].r, c: claims[0].c };
    }
    // Otherwise fortify a frontline node (own node bordering the enemy).
    if (stone >= FORTIFY_COST) {
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const t = this.tiles[r][c];
          if (t.owner === me && !t.fortified && t.resource && this.isAdjacentTo(r, c, foe)) {
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
    const total = GRID * GRID;

    let done = false;
    if (you === 0 || ai === 0) done = true;                         // elimination
    else if (you / total >= WIN_SHARE || ai / total >= WIN_SHARE) done = true; // domination
    else if (this.round > MAX_ROUNDS) done = true;                  // time up

    if (!done) return false;

    this.gameOver = true;
    this.inputLocked = true;
    let msg;
    if (you > ai) msg = 'You win!';
    else if (ai > you) msg = 'AI wins';
    else msg = 'Draw';
    this.resultText.setText(`${msg}\n${you} vs ${ai}`);
    this.overlay.setVisible(true);
    this.refresh();
    return true;
  }

  refresh() {
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

      // Highlight actionable tiles for the human.
      let stroke = null;
      if (humanTurn) {
        if (t.owner === 0 && myGold >= CLAIM_COST && this.isAdjacentTo(r, c, 1)) stroke = 0xffe066;
        else if (t.owner === 2 && !t.fortified && myGold >= CAPTURE_COST && this.isAdjacentTo(r, c, 1)) stroke = 0xff7043;
        else if (t.owner === 1 && !t.fortified && myStone >= FORTIFY_COST) stroke = 0x5ad1c8;
      }
      if (stroke !== null) v.rect.setStrokeStyle(4, stroke);
      else v.rect.setStrokeStyle(0);
    });

    // HUD.
    const r1 = this.resources[1], r2 = this.resources[2];
    this.youText.setText(`YOU\nW ${r1.wood}  G ${r1.gold}  S ${r1.stone}`);
    this.aiText.setText(`AI\nW ${r2.wood}  G ${r2.gold}  S ${r2.stone}`);
    this.countText.setText(`Tiles  You ${this.countTiles(1)}  •  AI ${this.countTiles(2)}`);
    if (this.gameOver) this.turnText.setText('Game Over');
    else this.turnText.setText(`Round ${Math.min(this.round, MAX_ROUNDS)}/${MAX_ROUNDS}  —  ${this.current === 1 ? 'Your turn' : 'AI thinking…'}`);

    // End Turn button state.
    const canEnd = humanTurn;
    this.endBtn.setFillStyle(canEnd ? 0x3d6cff : 0x3a3f57);
    this.endBtnText.setColor(canEnd ? '#ffffff' : '#8a90a6');
  }
}
