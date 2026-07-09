# Changelog — Foothold

Flat decimal versions (v0.01, v0.02, …). Each entry matches a frozen playable snapshot
under `snapshots/`. Newest first.

## v0.08 - 2026-07-08 - Display serif, arcane river, watchtower keep
- **Grenze display serif** (Omnibus-Type, OFL): a medieval serif now sets the game title, tagline,
  modal headings (How to Play, Settings, confirm dialog), the win/lose result, and every button.
  Body text (HUD counters, income, tile labels, descriptions) stays system-ui so it reads cleanly
  under the CRT filter. Weights 400 + 700 are vendored locally as woff2 under `assets/fonts/`, and
  `main.js` waits for `document.fonts.load` before booting so the first render never falls back
  (`style.css` `@font-face`, `src/main.js`).
- **"Arcane flow" river**: the water was rebuilt from solid ripples into a dark channel with a soft
  cyan glow and two bright dashed streaks that drift downstream every frame (a moving dash offset on
  a static spline, redrawn in `GameScene.drawRiverFlow`).
- **Watchtower keep**: the home-base tile now uses the watchtower shape (was the plain house icon)
  and renders larger (66px) so each side's keep reads clearly.
- Bumped the How to Play resource rows (taller rows, larger icons + text) and fixed the tall card so
  it stays vertically centered on wide/desktop instead of clipping.
- Removed a stray em dash from the round/turn status line.

## v0.07 - 2026-07-06 - Wide/desktop layout, a DLSS gag, and a game-feel pass
- **Responsive-up layout**: landscape tablets and desktop now boot a wide canvas (height locked to
  900, width matched to the aspect) with a board-left / info-rail-right composition; portrait phones
  are unchanged. The mode is picked once at load (`src/main.js`, `GameScene.computeLayout`).
- **"DLSS + Frame Gen" toggle** (Settings > Display): a purely cosmetic gag. Turning it on adds
  rainbow sparkles, an aurora curtain of rainbow "god ray" light shafts behind the board, a
  holographic shimmering label, and a triumphant fanfare. It does nothing to the actual rendering,
  and now persists across the title screen and a new game (`src/lib/ui.js`, new `dlss` sound).
- **Maxed-resource indicator**: a resource counter turns orange once it hits the cap, distinct from
  the amber flash shown when you spend/lose resources.
- **Opener balance**: each side is now guaranteed a wood AND a gold node within 4 tiles of its home
  base, replacing the looser "any node within 2 tiles" rule, so no one starts economically starved.
- Swapped the **End Turn** and **New Game** button positions.
- **CRT filter**: added a subtle phosphor flicker (75% the strength of the staged Classic CRT
  reference). The How to Play popup now scales to fit the shorter wide layout.

## v0.06 - 2026-07-06 - Title screen, settings & How to Play, plus a polish pass
- New **title / splash screen** (`src/scenes/TitleScene.js`): watchtower hero art on a soft gold
  halo that lights up (radial glow) and grows on hover, a colored four-verb tagline, and a
  breathing Start button. BootScene now hands off to the title, not straight into the match.
- Medieval herald's fanfare plays on the splash (first load or returning from a game) and replays
  whenever you tap the tower; new procedural `title` sound in `sfx.js`.
- Shared UI overlays extracted to `src/lib/ui.js`: a **How to Play** tutorial (resource + action
  reference) and a **Settings** panel (sound/volume/CRT, About), both reachable from the title gear.
- Persistent settings store (`src/lib/settings.js`): sound, volume and CRT toggle saved to
  localStorage and re-applied on load; single `VERSION` source of truth shown in the UI.
- Renamed the Claim action to **Expand** everywhere (legend, tooltips, tutorial copy).
- Modals no longer close when you click the card itself - only the bottom button, the X, or a
  click outside the card dismisses them (invisible click-block over the card).
- HUD polish: resource names in ALL CAPS, larger amount + income type, and the income "+N" raised
  off the bottom edge. Fixed a bug where a spend's downward number-bounce stayed down a line.
- Title and in-game settings gear now render identically (same rounded card, glyph and hit zone).

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
