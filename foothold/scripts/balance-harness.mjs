// AI-vs-AI balance harness: runs the greedy AI against itself thousands of times using the
// pure rules in src/lib/rules.js (no Phaser), and reports win rates, game length, and win-
// condition frequency. Run before any balance pass so tuning is based on data, not feel.
//
// Usage: node scripts/balance-harness.mjs [gameCount]   (default 5000)

import {
  createGame, addIncome, applyMove, aiPickMove, checkWin, advanceTide, AI_MAX_ACTIONS, MAX_ROUNDS,
} from '../src/lib/rules.js';

function simulateGame(level) {
  const state = createGame(level);
  let outcome = null;

  while (!outcome) {
    // Player 1 turn. AI_MAX_ACTIONS is GameScene's cap on the AI opponent specifically ("cap
    // so the AI can't run away in a single turn" - see GameScene.js), never a limit a real
    // human player faces: a human keeps acting until they're out of legal/affordable moves or
    // chooses to End Turn. Capping player 1 at 5 here as well understated their true ceiling
    // and skewed win-rate results toward player 2. Loop is still bounded (every move type
    // costs resources and applyMove never grants any), so it terminates once nothing's
    // affordable - no separate safety cap needed.
    addIncome(state, 1);
    for (;;) {
      const move = aiPickMove(state, 1);
      if (!move) break;
      applyMove(state, 1, move);
      outcome = checkWin(state);
      if (outcome) break;
    }
    if (outcome) break;

    // Player 2 (AI) turn.
    addIncome(state, 2);
    for (let i = 0; i < AI_MAX_ACTIONS; i++) {
      const move = aiPickMove(state, 2);
      if (!move) break;
      applyMove(state, 2, move);
      outcome = checkWin(state);
      if (outcome) break;
    }
    if (outcome) break;

    state.round += 1;
    if (level === 'ocean') advanceTide(state);
    outcome = checkWin(state);
  }

  return outcome;
}

function runLevel(level, label, N) {
  const wins = { you: 0, ai: 0, draw: 0 };
  const reasons = {};
  let roundSum = 0;

  for (let i = 0; i < N; i++) {
    const o = simulateGame(level);
    wins[o.result] += 1;
    reasons[o.reason] = (reasons[o.reason] || 0) + 1;
    roundSum += o.winRound;
  }

  const pct = (n) => `${((n / N) * 100).toFixed(1)}%`;
  console.log(`${label} - ${N} games\n`);
  console.log('Win rate:');
  console.log(`  Player 1 (home bottom-right): ${wins.you} (${pct(wins.you)})`);
  console.log(`  Player 2 (home top-left):     ${wins.ai} (${pct(wins.ai)})`);
  console.log(`  Draws:                        ${wins.draw} (${pct(wins.draw)})`);
  console.log(`\nAverage game length: ${(roundSum / N).toFixed(2)} rounds (of ${MAX_ROUNDS})`);
  console.log('\nWin condition frequency:');
  for (const [reason, count] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason.padEnd(16)} ${count} (${pct(count)})`);
  }
}

function main() {
  const N = Number(process.argv[2]) || 5000;
  console.log('Foothold AI-vs-AI balance harness\n');
  runLevel('river', 'River', N);
  console.log('\n----------------------------------------\n');
  runLevel('ocean', 'Ocean - Twin Shoals', N);
}

main();
