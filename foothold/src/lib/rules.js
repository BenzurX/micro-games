// Pure Foothold game rules: board gen, economy, moves, greedy AI, win check. No Phaser
// dependency, so this same module drives both GameScene (via thin wrappers there, TODO)
// and the headless AI-vs-AI balance harness (scripts/balance-harness.mjs).
// Mirrors src/scenes/GameScene.js exactly as of the 2026-07-09 reconciliation (income
// tiebreaker included) - keep the two in sync until GameScene is refactored to import this.

export const GRID_W = 6;
export const GRID_H = 9;
export const MAX_ROUNDS = 12;

export const RIVER_BAND = [3, 5];

export const CLAIM_COST = 5;
export const BUILD_COST = 5;
export const SIEGE_COST = CLAIM_COST * 2;
export const SIEGE_NODE_WOOD = BUILD_COST;
export const HOME_SIEGE_COST = 50;
export const UPGRADE_COST = 5;

export const NODE_INCOME = 5;
export const SPECIAL_INCOME = 3;
export const RESOURCE_CAP = 80;
export const BASE_INCOME = 2;
export const START = { wood: 10, gold: 10, stone: 5 };

export const AI_MAX_ACTIONS = 5;

// ---- RNG / array helpers (Phaser-free replacements for Phaser.Math.* / Phaser.Utils.Array.*) ----
function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------- board gen
function halfOf(state, r, c) {
  if (state.tiles[r][c].river || state.tiles[r][c].bridge) return 0;
  return r < state.riverRow[c] ? 2 : 1;
}

function hasAdjacentNode(state, r, c) {
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= GRID_H || nc < 0 || nc >= GRID_W) continue;
    if (state.tiles[nr][nc].resource) return true;
  }
  return false;
}

function openForNode(state, r, c) {
  const t = state.tiles[r][c];
  return !t.home && !t.river && !t.bridge && !t.resource;
}

function generateRiver(state) {
  const [lo, hi] = RIVER_BAND;
  state.riverRow = new Array(GRID_W);
  const start = randInt(lo, hi);
  let end = randInt(lo, hi);
  while (end === start) end = randInt(lo, hi);
  state.riverRow[0] = start;
  for (let c = 1; c < GRID_W; c++) {
    const prev = state.riverRow[c - 1];
    let row = clamp(prev + randInt(-1, 1), lo, hi);
    const stepsLeft = (GRID_W - 1) - c;
    if (Math.abs(end - row) > stepsLeft) row = prev + Math.sign(end - prev);
    state.riverRow[c] = row;
  }

  for (let c = 0; c < GRID_W; c++) state.tiles[state.riverRow[c]][c].river = true;
  const b1 = randInt(0, Math.floor(GRID_W / 2) - 1);
  const b2 = randInt(Math.ceil(GRID_W / 2), GRID_W - 1);
  for (const c of [b1, b2]) {
    const t = state.tiles[state.riverRow[c]][c];
    t.river = false;
    t.bridge = true;
  }
}

function placeIn(state, side, type, count) {
  const gather = () => {
    const cells = [];
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        if (halfOf(state, r, c) === side && openForNode(state, r, c)) cells.push({ r, c });
      }
    }
    return shuffle(cells);
  };
  let placed = 0;
  for (const { r, c } of gather()) {
    if (placed >= count) break;
    if (hasAdjacentNode(state, r, c)) continue;
    state.tiles[r][c].resource = type;
    placed += 1;
  }
  for (const { r, c } of gather()) {
    if (placed >= count) break;
    state.tiles[r][c].resource = type;
    placed += 1;
  }
}

function ensureTypeNearHome(state, home, side, type, maxDist) {
  const dist = (r, c) => Math.abs(r - home.r) + Math.abs(c - home.c);
  const own = [];
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      if (state.tiles[r][c].resource === type && halfOf(state, r, c) === side) {
        if (dist(r, c) <= maxDist) return;
        own.push({ r, c, d: dist(r, c) });
      }
    }
  }
  if (!own.length) return;

  const near = [];
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      if (halfOf(state, r, c) === side && openForNode(state, r, c) && dist(r, c) <= maxDist) {
        near.push({ r, c });
      }
    }
  }
  if (!near.length) return;
  shuffle(near);
  const target = near.find((n) => !hasAdjacentNode(state, n.r, n.c)) || near[0];
  own.sort((a, b) => b.d - a.d);
  const src = own[0];
  state.tiles[src.r][src.c].resource = null;
  state.tiles[target.r][target.c].resource = type;
}

function placeSpecialNearRiver(state, side) {
  const cands = [];
  for (let c = 0; c < GRID_W; c++) {
    const r = side === 2 ? state.riverRow[c] - 1 : state.riverRow[c] + 1;
    if (r < 0 || r >= GRID_H) continue;
    const t = state.tiles[r][c];
    if (t.home || t.river || t.bridge || t.resource) continue;
    cands.push({ r, c });
  }
  shuffle(cands);
  for (const { r, c } of cands) {
    if (hasAdjacentNode(state, r, c)) continue;
    state.tiles[r][c].resource = 'special';
    return;
  }
  if (cands.length) state.tiles[cands[0].r][cands[0].c].resource = 'special';
}

function placeNodes(state) {
  placeSpecialNearRiver(state, 2);
  placeSpecialNearRiver(state, 1);

  for (const side of [1, 2]) {
    placeIn(state, side, 'wood', 2);
    placeIn(state, side, 'gold', 2);
    placeIn(state, side, 'stone', 2);
  }

  for (const [home, side] of [[state.homePlayer, 1], [state.homeAI, 2]]) {
    ensureTypeNearHome(state, home, side, 'wood', 4);
    ensureTypeNearHome(state, home, side, 'gold', 4);
  }
}

// Build a fresh game state: board, river, nodes, starting resources. Mirrors setupState().
export function createGame() {
  const state = {
    round: 1,
    gameOver: false,
    resources: { 1: { ...START }, 2: { ...START } },
    tiles: [],
  };
  for (let r = 0; r < GRID_H; r++) {
    const row = [];
    for (let c = 0; c < GRID_W; c++) {
      row.push({ owner: 0, resource: null, upgraded: false, home: false, river: false, bridge: false });
    }
    state.tiles.push(row);
  }
  state.homePlayer = { r: GRID_H - 1, c: GRID_W - 1 };
  state.homeAI = { r: 0, c: 0 };
  state.tiles[state.homePlayer.r][state.homePlayer.c].owner = 1;
  state.tiles[state.homePlayer.r][state.homePlayer.c].home = true;
  state.tiles[state.homeAI.r][state.homeAI.c].owner = 2;
  state.tiles[state.homeAI.r][state.homeAI.c].home = true;

  generateRiver(state);
  placeNodes(state);
  return state;
}

// ---------------------------------------------------------------- economy / moves
export function forEachTile(state, fn) {
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) fn(state.tiles[r][c], r, c);
  }
}

export function computeIncome(state, p) {
  const inc = { wood: 0, gold: 0, stone: 0 };
  forEachTile(state, (t) => {
    if (t.owner !== p) return;
    if (t.home) { inc.wood += BASE_INCOME; inc.gold += BASE_INCOME; inc.stone += BASE_INCOME; }
    const m = t.upgraded ? 2 : 1;
    if (t.resource === 'wood') inc.wood += NODE_INCOME * m;
    else if (t.resource === 'gold') inc.gold += NODE_INCOME * m;
    else if (t.resource === 'stone') inc.stone += NODE_INCOME * m;
    else if (t.resource === 'special') {
      inc.wood += SPECIAL_INCOME * m; inc.gold += SPECIAL_INCOME * m; inc.stone += SPECIAL_INCOME * m;
    }
  });
  return inc;
}

export function addIncome(state, p) {
  const inc = computeIncome(state, p);
  for (const res of ['wood', 'gold', 'stone']) {
    state.resources[p][res] = Math.min(RESOURCE_CAP, state.resources[p][res] + inc[res]);
  }
}

export function siegeCost(t) {
  if (t.home) return HOME_SIEGE_COST;
  return SIEGE_COST;
}

export function siegeWoodCost(t) {
  return (t.resource && !t.home) ? SIEGE_NODE_WOOD : 0;
}

export function isAdjacentTo(state, r, c, p) {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= GRID_H || nc < 0 || nc >= GRID_W) continue;
    if (state.tiles[nr][nc].owner === p) return true;
  }
  return false;
}

export function countTiles(state, p) {
  let n = 0;
  forEachTile(state, (t) => { if (t.owner === p) n += 1; });
  return n;
}

export function applyMove(state, p, move) {
  const t = state.tiles[move.r][move.c];
  if (move.type === 'claim') {
    state.resources[p].gold -= CLAIM_COST;
    t.owner = p;
  } else if (move.type === 'build') {
    state.resources[p].wood -= BUILD_COST;
    t.owner = p;
  } else if (move.type === 'siege') {
    state.resources[p].gold -= siegeCost(t);
    state.resources[p].wood -= siegeWoodCost(t);
    move.wasUpgraded = t.upgraded;
    t.owner = p;
    t.upgraded = false;
  } else if (move.type === 'upgrade') {
    state.resources[p].stone -= UPGRADE_COST;
    t.upgraded = true;
  }
}

// The tile a human could legally act on (see GameScene.actionFor). Kept here so the harness
// can also drive "player 1" with the same rules a smarter future AI might reuse; the greedy
// AI below (aiPickMove) is what actually plays both sides in the balance harness.
export function actionFor(state, r, c, me) {
  const t = state.tiles[r][c];
  if (t.river) return null;
  const res = state.resources[me];
  const adj = isAdjacentTo(state, r, c, me);
  if (t.owner === 0 && adj && !t.resource && res.gold >= CLAIM_COST) return { type: 'claim', r, c };
  if (t.owner === 0 && adj && t.resource && res.wood >= BUILD_COST) return { type: 'build', r, c };
  const foe = me === 1 ? 2 : 1;
  if (t.owner === foe && adj && res.gold >= siegeCost(t) && res.wood >= siegeWoodCost(t)) return { type: 'siege', r, c };
  if (t.owner === me && t.resource && !t.home && !t.upgraded && res.stone >= UPGRADE_COST) return { type: 'upgrade', r, c };
  return null;
}

// ---------------------------------------------------------------- AI (greedy)
// Generalized from GameScene.aiPickMove to play either side (me = 1 or 2), so the harness can
// run the same AI against itself. Logic/priority order is unchanged: siege enemy node > build
// own node > siege anything > claim empty > upgrade a safe node.
export function aiPickMove(state, me) {
  const foe = me === 1 ? 2 : 1;
  const wood = state.resources[me].wood;
  const gold = state.resources[me].gold;
  const stone = state.resources[me].stone;

  const empties = [];
  const builds = [];
  const sieges = [];
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      const t = state.tiles[r][c];
      if (t.river) continue;
      if (!isAdjacentTo(state, r, c, me)) continue;
      if (t.owner === 0 && t.resource) builds.push({ r, c, t });
      else if (t.owner === 0) empties.push({ r, c, t });
      else if (t.owner === foe) sieges.push({ r, c, t });
    }
  }

  const nodeRank = (t) => (t.resource === 'special' ? 3 : t.resource ? 2 : 1);
  const byNode = (a, b) => nodeRank(b.t) - nodeRank(a.t);
  builds.sort(byNode);
  sieges.sort(byNode);
  const canSiege = (t) => gold >= siegeCost(t) && wood >= siegeWoodCost(t);

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

  if (stone >= UPGRADE_COST) {
    const own = [];
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        const t = state.tiles[r][c];
        if (t.owner === me && t.resource && !t.home && !t.upgraded) own.push({ r, c });
      }
    }
    const safe = own.find((n) => !isAdjacentTo(state, n.r, n.c, foe));
    const pick = safe || own[0];
    if (pick) return { type: 'upgrade', r: pick.r, c: pick.c };
  }
  return null;
}

// ---------------------------------------------------------------- win check
// Mirrors GameScene.checkWin (including the 2026-07-09 income tiebreaker), minus all the
// Phaser rendering side effects. Returns null if the game isn't over yet, else a result object.
export function checkWin(state) {
  if (state.gameOver) return null;
  const you = countTiles(state, 1);
  const ai = countTiles(state, 2);

  const aiBaseOwner = state.tiles[0][0].owner;
  const yourBaseOwner = state.tiles[GRID_H - 1][GRID_W - 1].owner;
  const winRound = Math.min(state.round, MAX_ROUNDS);

  let result = null, reason = null;
  if (aiBaseOwner === 1) { result = 'you'; reason = 'base-capture'; }
  else if (yourBaseOwner === 2) { result = 'ai'; reason = 'base-capture'; }
  else if (state.round > MAX_ROUNDS) {
    if (you > ai) { result = 'you'; reason = 'timeup-tiles'; }
    else if (ai > you) { result = 'ai'; reason = 'timeup-tiles'; }
    else {
      const yi = computeIncome(state, 1), ei = computeIncome(state, 2);
      const ySum = yi.wood + yi.gold + yi.stone;
      const eSum = ei.wood + ei.gold + ei.stone;
      if (ySum > eSum) { result = 'you'; reason = 'timeup-income'; }
      else if (eSum > ySum) { result = 'ai'; reason = 'timeup-income'; }
      else { result = 'draw'; reason = 'timeup-draw'; }
    }
  }

  if (!result) return null;
  state.gameOver = true;
  return { result, reason, winRound, tilesYou: you, tilesAi: ai };
}
