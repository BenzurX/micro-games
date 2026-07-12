# Changelog - Foothold

Flat decimal versions (v0.01, v0.02, …). Each entry matches a frozen playable snapshot
under `snapshots/`. Newest first.

## v0.14 - 2026-07-11 - Mobile tap-to-preview fix
- **Mobile tooltip**: the action tooltip was wired to `pointerover`/`pointerout`, a hover state
  that doesn't exist on touch, so tapping a tile committed the move instantly with no preview -
  new players had no way to see a move's cost/gain before it happened. Fixed with tap-to-select/
  tap-again-to-confirm: the first tap on a tile shows its tooltip only; a second tap on that same
  tile commits it. On desktop this is invisible, since hover already selects the tile before the
  click lands, so a single click still commits in one motion, same as before. A board-wide tap
  (river, margins, HUD) clears the selection so a stale preview can't linger.

## v0.13 - 2026-07-11 - Desktop tile-control bar corner fix
- **Tile-control bar**: the tug-of-war corner radius was clamped to a hard 0/7px switch keyed off
  a 14px sliver threshold, so the narrower desktop rail crossed into the flat branch far more
  often than mobile's full-width bar. Radius now scales to the segment width so corners stay
  round at any size, matching mobile.

## v0.12 - 2026-07-11 - Total Victory, first-mover balance fix, PWA
- **Total Victory**: capturing the enemy base while owning every non-river tile and having every
  held node upgraded now triggers a distinct win state - "Complete Foothold! / Round N" copy, a
  gold sunburst (pulsing glow + 10 rotating rays sized to reach the screen edges), a camera
  flash/shake, and a unique "Grand Finale" fanfare. Staged 10 fanfare and 3 flare candidates in
  `stage/total-victory.html` before picking.
- **PWA**: `manifest.webmanifest` + `sw.js` service worker (cache-first, network-first on
  navigation) so the web build installs to a home screen and plays offline. Icons are a
  temporary placeholder (upscaled `watchtower.png`) pending the real custom app icon task.
- **AI-vs-AI balance harness**: pure rules (board gen, economy, moves, greedy AI, win check)
  extracted into `src/lib/rules.js` (no Phaser dependency), driven by a headless simulator
  (`scripts/balance-harness.mjs`). First run (5000 games) found a 66.8%/33.1% first-mover
  win-rate imbalance.
- **First-mover balance fix**: player 2 (always moves second each round) now starts with a
  resource bump (`P2_START_BONUS`, wood +14/gold +14/stone +7) to offset the tempo
  disadvantage, instead of changing turn order (alternating first-mover would read as the
  enemy getting two turns in a row at the round boundary). Invisible in the UI, since the
  AI's stockpile is never shown to the player. Re-ran the harness at 20,000 games: 50.7%/49.3%.
- **Time-up tiebreaker** (carried over from 2026-07-09): a tile tie at round 12 is now broken by
  total per-turn income (all three resources summed); only a full economic tie is a true draw.
  The result screen says which side's income decided it.
- **DESIGN.md re-synced to the game as built** (6x9 grid, river + bridges as core, Upgrade
  replacing Fortify, current costs/incomes/cap) and reframed as a living doc - numbers are
  tuned by playtest, not a pre-build contract. Fortify moved to the backlog as a possible
  future second stone sink.
- Swept stale code comments in GameScene.js (old "3x if walled" siege note, emoji/gear
  placeholder notes for HUD elements that are now real).

## v0.11 - 2026-07-08 - Bigger mobile board, HUD spacing balance
- **The board fills the phone**: portrait now grows the tiles to the largest square that fits both
  the canvas width (20px side margins) and the HUD-to-legend region - from the classic 82px up to
  ~113px on a tall phone - instead of floating a fixed-size board in dead space. Per-tile art
  (node icons, the home keep, upgrade badges, income labels) scales in step via a tileK factor;
  the river, bridges and tile rects already derive from the tile size. Wide/desktop stays at 82.
- **HUD spacing balance (mobile)**: tightened the resource-cards-to-tile-bar gap (40 -> 20px),
  added 12px between the tile bar and the day/night strip, and trimmed the HUD block's bottom pad
  so the space above the board matches the space below it (before the legend).

## v0.10 - 2026-07-08 - Round timeline and tile-control bar
- **Sun-to-moon round timeline** (staged idea C): the "Round X/12" text is now a strip of 12 pips
  that fill on a dawn-to-night gradient (warm orange -> gold -> pale noon -> dusk pink -> night blue),
  the round in play ringed white, with a drawn sun on the left and crescent moon on the right
  (no new image assets; both icons are Phaser Graphics).
- **Tile-control tug-of-war bar** (staged idea A): the "Tiles You 12 - Enemy 9" text is now a bar
  sized to every claimable tile - blue (you) grows from the left, red (enemy) from the right, the
  dark middle is land still up for grabs - with colored "You N" / "Enemy N" counts above. Sits
  ABOVE the day/night strip.
- Removed the "Round X of 12 - Your turn" caption entirely (the pips carry the round count), and
  added padding between the HUD block and the board.
- Layout budgets adjusted in both modes (portrait HUD block ends at 254px; wide rail legend moved
  to roundY+122); verified the board still fits the tightest 720x1280 portrait canvas.

## v0.09 - 2026-07-08 - Mobile legibility pass, top-anchored frame, copy cleanup
- **Mobile text legibility**: the portrait canvas (locked to 720px) is fit down to roughly half size
  on a phone, so 15-18px fonts were landing near 8-10 CSS px. Bumped the legend (labels 18->22, desc
  15->17, taller rows) and tightened its copy to a single action verb per row; the How to Play card is
  now built slightly narrower and uniformly scaled up so everything grows together with no reflow; and
  Settings labels/sections/about text are bumped per element (the card stays unscaled so the volume
  slider's drag math is unaffected). Wide/desktop is untouched (`src/scenes/GameScene.js`, `src/lib/ui.js`).
- **Frame anchored to the top on mobile**: portrait now boots with `CENTER_HORIZONTALLY` instead of
  `CENTER_BOTH`, so any vertical letterbox slack falls to the bottom, keeping a mobile browser's address
  bar over dead space instead of over the bottom-anchored End Turn button (`src/main.js`).
- Larger **New Game** button text (24 -> 29px).
- How to Play copy cleanup: Special now reads "Provides all resource types", Build drops "each turn",
  and Siege reads "Nodes cost wood" (`src/lib/ui.js`).
- Staged (not yet wired in) design explorations for a sun-to-moon **round timeline** and a **your-tiles
  vs enemy-tiles** indicator: 4 variations each under `stage/round-progress.html` and `stage/tile-score.html`.

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

## v0.05 - 2026-07-06 - Upgrade economy, CRT filter & mobile-first layout
- Fortify replaced by **Upgrade**: spend stone to double a resource node's per-turn output
  instead of walling it. Captured nodes arrive un-upgraded (siege strips the ×2, re-develop with stone).
- New CRT post-processing filter (`src/lib/CrtPipeline.js`), first pass: a subtle barrel curve,
  scanlines, an aperture-grille phosphor tint, soft bloom and a gentle vignette. WebGL-only, with a
  Canvas fallback that runs unfiltered; every knob lives in the `CRT` config object.
- Mobile-first responsive layout: the design width stays locked at 720 but the height now matches
  the device's aspect ratio, so tall phones fill top-to-bottom instead of showing letterbox bars.
- Layout split into three anchored zones - HUD (resources + gear) pinned top, action legend +
  End Turn pinned bottom, board vertically centered in the space between.
- Fixed a double-centering bug (CSS flex + Phaser CENTER_BOTH) that pushed the canvas toward the lower-right.
- Known issue (WIP): CRT edge/corner darkening still reads too black on some screens - being tuned.

## v0.04 - 2026-07-04 - Game-feel & juice pass
- Added a procedural Web Audio sound engine (`src/lib/sfx.js`) - no audio files, fully
  synthesized: distinct sounds on claim, build, fortify, siege, end-turn, win and lose.
- Every sound picks from 5 slight pitch variants per play so rapid repeats don't fatigue the ear.
- Fortify now plays a metallic anvil "tang" (inharmonic, detuned-beating partials).
- Capturing the enemy home plays its own heavier, pitched-down sound (distinct from a siege).
- Colored particle bursts on every tile that flips (fixed a double-offset positioning bug).
- Camera shake: subtle on siege, larger on a base capture; tiles pop in with an overshoot.
- AI now plays its moves one at a time (~280ms apart) so each animates and sounds distinctly.
- Animated game-over overlay (fade + text pop); win banner reads "You Win on Round N!".
- Balance: fortify strengthened to ×3 enemy capture cost; legend/tooltip copy updated.

## v0.03 - 2026-07-03 - Portrait board, river & real icons
- Board reshaped to 6 wide × 9 tall (portrait) for one-handed mobile play.
- Added a meandering river (impassable/unclaimable, one water tile per column) splitting the
  two halves, with exactly two bridges as the only crossings.
- Balanced node economy per half (2 wood / 2 gold / 2 stone), asymmetric positions, plus two
  contested specials by the water.
- Replaced placeholder squares with tinted Kenney "Board Game Icons" (CC0); added hover tooltips.

## v0.02 - 2026-07-02 - Four-action model
- Four actions (Claim / Build / Fortify / Siege) with a gold/wood/stone split.
- Player moved to bottom-right; reworked HUD (income deltas + color-key legend).
- Win by capturing the enemy base or holding the most tiles at round 12.

## v0.01 - 2026-07-02 - First playable prototype
- 8×8 turn-based territory control vs a greedy AI; procedural resource nodes.
- Adjacent-only claiming, capture of undefended tiles, fortify to defend.
- Phaser 3, ES modules, vendored locally - self-contained and offline-playable.
