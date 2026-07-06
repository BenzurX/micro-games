# Changelog — Foothold

Flat decimal versions (v0.01, v0.02, …). Each entry matches a frozen playable snapshot
under `snapshots/`. Newest first.

## v0.05 — 2026-07-06 — Upgrade economy, CRT filter & mobile-first layout
- Fortify replaced by **Upgrade**: spend stone to double a resource node's per-turn output
  instead of walling it. Captured nodes arrive un-upgraded (siege strips the ×2, re-develop with stone).
- New CRT post-processing filter (`src/lib/CrtPipeline.js`), first pass: a subtle barrel curve,
  scanlines, an aperture-grille phosphor tint, soft bloom and a gentle vignette. WebGL-only, with a
  Canvas fallback that runs unfiltered; every knob lives in the `CRT` config object.
- Mobile-first responsive layout: the design width stays locked at 720 but the height now matches
  the device's aspect ratio, so tall phones fill top-to-bottom instead of showing letterbox bars.
- Layout split into three anchored zones — HUD (resources + gear) pinned top, action legend +
  End Turn pinned bottom, board vertically centered in the space between.
- Fixed a double-centering bug (CSS flex + Phaser CENTER_BOTH) that pushed the canvas toward the lower-right.
- Known issue (WIP): CRT edge/corner darkening still reads too black on some screens — being tuned.

## v0.04 — 2026-07-04 — Game-feel & juice pass
- Added a procedural Web Audio sound engine (`src/lib/sfx.js`) — no audio files, fully
  synthesized: distinct sounds on claim, build, fortify, siege, end-turn, win and lose.
- Every sound picks from 5 slight pitch variants per play so rapid repeats don't fatigue the ear.
- Fortify now plays a metallic anvil "tang" (inharmonic, detuned-beating partials).
- Capturing the enemy home plays its own heavier, pitched-down sound (distinct from a siege).
- Colored particle bursts on every tile that flips (fixed a double-offset positioning bug).
- Camera shake: subtle on siege, larger on a base capture; tiles pop in with an overshoot.
- AI now plays its moves one at a time (~280ms apart) so each animates and sounds distinctly.
- Animated game-over overlay (fade + text pop); win banner reads "You Win on Round N!".
- Balance: fortify strengthened to ×3 enemy capture cost; legend/tooltip copy updated.

## v0.03 — 2026-07-03 — Portrait board, river & real icons
- Board reshaped to 6 wide × 9 tall (portrait) for one-handed mobile play.
- Added a meandering river (impassable/unclaimable, one water tile per column) splitting the
  two halves, with exactly two bridges as the only crossings.
- Balanced node economy per half (2 wood / 2 gold / 2 stone), asymmetric positions, plus two
  contested specials by the water.
- Replaced placeholder squares with tinted Kenney "Board Game Icons" (CC0); added hover tooltips.

## v0.02 — 2026-07-02 — Four-action model
- Four actions (Claim / Build / Fortify / Siege) with a gold/wood/stone split.
- Player moved to bottom-right; reworked HUD (income deltas + color-key legend).
- Win by capturing the enemy base or holding the most tiles at round 12.

## v0.01 — 2026-07-02 — First playable prototype
- 8×8 turn-based territory control vs a greedy AI; procedural resource nodes.
- Adjacent-only claiming, capture of undefended tiles, fortify to defend.
- Phaser 3, ES modules, vendored locally — self-contained and offline-playable.
