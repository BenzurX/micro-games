# PROGRESS.md — Micro Games Pipeline

> Claude: read this at the start of every session. State today's target, flag unfinished work, warn on scope drift. Keep entries short; this file is a logbook, not a journal.

## Mission
Ship small, polished, honestly-monetized micro games. Revenue funds future projects. Shipping beats perfecting.

## Current Phase
Fable trial week (ends July 7). Objective: 1 fully shipped game, 1 second game built from the template, and design docs for games 3–10 so lesser models can execute them.

## Weekly Targets
- [x] Game 1: playable core loop (browser prototype, 2026-07-02)
- [ ] Game 1: full polish pass (quality bar checklist in CLAUDE.md)
- [ ] Game 1: live on itch.io
- [ ] Reusable template repo extracted from Game 1
- [ ] Game 2: built from template, core loop playable
- [ ] DESIGN.md drafted for games 3–10
- [ ] Apple + Google developer accounts registered and verified

## Today's Target
*(One line. Set it each morning before opening Claude Code.)*
- **Date:** 2026-07-14
- **Target:** Ship-lock declared after the 2-week audit (see Decision Log). Work only the items required to get Foothold live on itch.io; no new scope until it's shipped.

## SHIP-LOCK (2026-07-14)
Two-week audit found itch.io had been deprioritized every session since 2026-07-02 in favor of
conscious-but-cumulative scope expansions (PWA, balance harness, beta feedback + Trello backend).
Benzur chose: freeze all new scope, ship to itch.io this week. Any out-of-scope ask during
ship-lock goes straight to the v1.1 backlog, no exceptions, until item 4 below is done.

## Next Session
*(Canonical resume queue - the single source of truth for "ready to continue?". As of
2026-07-14, discrete task/feature/bug items live on the Foothold Trello board (board_id
6a5561e77bb31280a2ad8750, lists "Todo" and "Backlog") - this list is a snapshot of that
board's ship-lock chain at session close, restated verbatim on resume. A newer plan or
Trello state replaces this whole section. See global CLAUDE.md - Session handoff. Cached
board/list/label IDs for this and every other project's Trello board live in
`C:\Users\Ben\Claude\Trello.md` - check it before any Trello MCP call instead of running
`get_lists`/`get_board_labels` fresh.)*

1. **Ship Foothold to itch.io.** This is the ship-lock target - do not let anything else jump ahead of it.

Non-blocking (also on the Trello Todo list, not part of the ship-lock chain): Dev Mode tide-button relabel; Connect itch.io to Beta Feedback form (blocked until item 1 ships, needs the live origin); Polish ideas.

Template extraction is deliberately deferred until after the itch.io ship (Trello Todo card, not listed above).

Done (cleared from this queue 2026-07-16): ux-reviewer agent run on the v0.23 build - flagged a "siege enemy Special node does nothing" blocker that turned out to be a browser-automation click-targeting false positive (Ben confirmed sieging specials works fine manually; code review of `GameScene.js` siege logic found no special-casing bug). Also surfaced the gap that a stale cached build could sit silently with no signal to the player - fixed as v0.24's "Update available" toast (per-tab baseline version detection, top-pill design staged in `stage/update-toast.html` then implemented, delegated to Codex and reviewed).

Done (cleared from this queue 2026-07-16): AI vs AI balance testing - River level - re-ran `scripts/balance-harness.mjs` at 20,000 games: 51.3%/48.7% (P1/P2), 0.1% draws, consistent with prior tuning. No skew found.

Done (cleared from this queue 2026-07-16): AI vs AI balance testing - Shoreline level (Twin Shoals) - ported the tide/shoal generator logic into the Phaser-free `src/lib/rules.js` (delegated the mechanical port to Codex, reviewed and applied), ran 20,000 games: 47.6%/51.4% (P1/P2), 1.0% draws. Win-condition shape differs from River (14.6% base-capture vs 46.4%) but split itself is healthy - logged as a design note, not a bug.

Done (cleared from this queue 2026-07-16): Beach Cutoff bug fix - fixed the ocean-level generator boxing a shoreline/resource tile in on all sides with stacked ocean bumps; added `sealUnreachablePockets()` flood-fill in both `GameScene.js` and `rules.js`. Verified across 5000 generated boards (0 trapped tiles) and a 20,000-game balance re-run with no regression.

Done (cleared from this queue 2026-07-16): 60fps device test - shoreline level was dropping to ~20fps on a real mid-range phone (river held 55-60fps). Root cause: ~40-50 per-tile GeometryMasks on ocean/shoal water FX (swell shimmer, ripple, foam), each forcing its own WebGL stencil pass. Fixed in v0.23 by consolidating to 2 shared masks driven by Containers. Re-tested on device: shoreline now stays above 50fps. Trello card moved to Done.

Done (cleared from this queue 2026-07-16): Custom app icon - Benzur provided `app-icon.png` (watchtower on the game's dark navy); resized into `assets/icons/pwa-192.png`/`pwa-512.png` (replacing the temporary upscaled-watchtower placeholder), also covering the favicon/apple-touch-icon; `sw.js` `CACHE_VERSION` bumped to v0.22. Trello card moved to Done.

Done (cleared from this queue 2026-07-11): AI-vs-AI balance harness (`src/lib/rules.js` + `scripts/balance-harness.mjs`); first-mover imbalance fix (`P2_START_BONUS`, 66.8/33.1 -> 50.7/49.3 at 20k games).

Done (cleared from this queue 2026-07-06): responsive update (wide/desktop layout shipped v0.07) and New Game button next to End Turn.

## Daily Log
*(Append one entry per work day. Three lines max.)*

### 2026-07-11
- Done: Reconciled the uncommitted 2026-07-09 income-tiebreaker/DESIGN.md-sync work (committed). Built the AI-vs-AI balance harness: extracted pure rules into `src/lib/rules.js` (Phaser-free) and a headless simulator (`scripts/balance-harness.mjs`).
- Done: Ran the harness (5000 games) - found a 66.8% (player 1) vs 33.1% (player 2) win rate, i.e. a strong first-mover advantage. Not something casual playtesting had surfaced. Logged as the new top Next Session item.
- Done: Built PWA support - `manifest.webmanifest` + `sw.js` service worker (cache-first, offline + installable), verified in-browser. Icons are a placeholder (upscaled `watchtower.png`) pending the custom app icon task. Added the `CACHE_VERSION` bump step to the pre-push gate in the root CLAUDE.md.
- Done: Fixed the first-mover imbalance. Ruled out alternating who moves first (would read as the enemy getting two turns in a row at the round boundary); compensated player 2 with a starting-resource bump instead (`P2_START_BONUS`, wood +14/gold +14/stone +7, tuned against the harness, mirrored in `rules.js` and `GameScene.js`). Invisible in the UI - the AI's stockpile is never shown to the player. Re-ran at 20,000 games: 50.7%/49.3%.
- Done: Built the Total Victory win state (base captured + every non-river tile owned + every held node upgraded): "Complete Foothold! / Round N" copy, a gold sunburst (pulsing glow + rotating rays, sized off the canvas diagonal), camera flash/shake, and a unique "Grand Finale" fanfare. Staged 10 fanfare + 3 flare candidates in `stage/total-victory.html`; Benzur picked Sunburst + Grand Finale. Tuned glow brightness down twice after playtest.
- Blocked: None.

### 2026-07-02
- Done: Stood up 5 sub-agents + agent-audit + snapshot norm. Built playable browser prototype (8x8 turn-based territory control) = Foothold, saved as snapshot v0.01. Confirmed all core design pillars. Named the game **Foothold** (name-collision research). Renamed folder game-1 → foothold.
- Done (session 2): Reworked to the four-action model (Claim/Build/Fortify/Siege) with gold/wood/stone split, player moved bottom-right, new HUD (income deltas + color-key legend), filled purple fortify shields, win = capture enemy base or most tiles at round 12. Chose UI direction B (staged mockup vs Benzur's Mockup 1). Added global session open/close handoff rituals. Verified in-browser (Benzur tested). Saved snapshot **v0.02**.
- Blocked: None.
- Tomorrow (next session): (set at session close)

### 2026-07-03
- Done: Reshaped board to 6 wide x 9 tall (portrait). Added the river (meander through rows 3-5, one water tile/column, impassable/unclaimable) with exactly 2 bridges as the only crossings. New balanced-per-half node placement (2 wood/2 gold/2 stone each side, asymmetric positions, 2 specials by the water). Swapped placeholder squares for tinted Kenney "Board Game Icons" (CC0) + added hover tooltips. Logged 4 decisions in the root Decision Log. (Backfilled 2026-07-04 — work was done but never logged/snapshotted that day.)
- Blocked: None.
- Tomorrow: Snapshot the above, then next polish item.

### 2026-07-04
- Done: Reconciled the un-snapshotted July 3 work into snapshot **v0.03** (self-contained, vendored Phaser + Kenney icons). Updated the snapshots gallery and backfilled the 2026-07-03 log. Benzur confirmed the July 3 build was working.
- Done (juice pass): Balance tweaks (win banner "You Win on Round N!", fortify → x3, legend copy). Full game-feel pass — new procedural Web Audio SFX engine (`src/lib/sfx.js`, no audio files) with sound on every action, 5 pitch variants per sound, metallic anvil "tang" for fortify (old bell kept as `glassClang` backup), heavier pitched-down base-capture sound, particle bursts (fixed double-offset bug), camera shake, tile pops, stepped AI turns, animated game-over. Saved snapshot **v0.04**; added CHANGELOG.md + README.md; added a Pre-Push Gate to the pipeline CLAUDE.md. Initialized the foothold git repo + first commit. Logged the late-game snowball as a v1 balance to-do.
- Done (repo): Benzur created the GitHub remote; locked in a **single monorepo** at the pipeline root (BenzurX/micro-games, branch `main`). Committed and pushed the whole pipeline (template + all games as sibling folders); working tree clean, in sync with origin. HTTPS auth via Git Credential Manager; `gh` still not installed.
- Blocked: None.
- Tomorrow (next session): Late-game snowball balance fix (item 1 of Next Session queue).

### 2026-07-05
- Done (economy rework — the snowball fix): tried a soft resource ceiling, reverted it, then pivoted the design — **Fortify → Upgrade** (costs stone, DOUBLES a node's output; card_lift icon), base node income halved 10→5, **Siege = 2x a claim (10 gold) + 5 wood to re-develop a captured node**, capturing a node **strips its upgrade** (revives stone as a late-game sink + kills the steal-bait), **hard 100 cap** on every resource, special node → **+3 all** (doubles when upgraded). Added on-tile per-node income labels, made the post-claim tooltip seamless (re-show under cursor).
- Done (polish): "AI" → "Enemy" in all displayed text. New procedural SFX — magical acquire/upgrade sound for the ★ node (5 variants; upgrade pitched up), and a heavier/longer **destructive** node-capture sound (pitched down further when the node was upgraded); sieging a special uses the destructive sound, not the magical one.
- Blocked: None. **Caveat: all of the above is live-only — uncommitted, undocumented (DESIGN.md/Decision Log still describe Fortify), and ahead of snapshot v0.04.** Reconcile next session (see Next Session item 1).
- Tomorrow (next session): Lock in the Upgrade-economy rework — confirming playtest, then docs + snapshot v0.05.

### 2026-07-06
- Done: Locked in the economy rework as **v0.05** (playtest confirmed; DESIGN.md/Decision Log/CHANGELOG/README updated, snapshot saved, pushed). Then built **v0.06**: TitleScene splash (watchtower hero + glow, fanfare, breathing Start), shared overlays in `src/lib/ui.js` (How to Play + Settings), persisted settings store (`src/lib/settings.js`: sound/volume/CRT, single VERSION source), Claim→Expand rename, modal click-through fix, HUD restyle. Snapshot v0.06 + full pre-push gate, pushed to origin/main.
- Blocked: None. Responsive update assessed (3 tiers, see memory `foothold-responsive-plan`) but deferred - usage budget too low to start the refactor safely.
- Tomorrow (next session): Responsive update Tier 1 (item 1 of Next Session queue).

### 2026-07-09
- Done: Responsive update landed as v0.07-v0.11 (wide/desktop layout, DLSS gag, mobile legibility pass, display serif, round timeline/tile-control bar, bigger mobile board), each pushed with its own changelog/snapshot per the pre-push gate.
- Done: Time-up tiebreaker - a tile tie at round 12 is now broken by total per-turn income across all three resources; only a full economic tie is a true draw. DESIGN.md re-synced to the game as built (6x9 grid, river/bridges, Upgrade economy) and reframed as a living doc; Fortify moved to backlog. Swept stale code comments in GameScene.js. README updated to mention the tiebreaker.
- Blocked: None. Caveat: this reconciliation work was done live but never logged or committed that day - reconciled and committed 2026-07-11.
- Tomorrow (next session): AI-vs-AI balance harness (item 1 of Next Session queue).

### 2026-07-13
- Done: Foothold v0.20 shipped (home flag + node-glint idle animations, back-nav icon, level select readability), plus a post-release stone icon artwork refinement (no version bump).
- Done: beta feedback mechanism authorized as a scope expansion (Benzur is starting a friend beta of v0.20) - in-game Bug/Feature form + Cloudflare Worker + Trello card creation. Shipped as Foothold v0.21. Logged in the Decision Log above and DESIGN.md. Debugged a 401/502 chain to a mis-set Trello secret, fixed GitHub Pages CORS (`ALLOWED_ORIGINS`), confirmed working from Benzur's phone, then dropped the redundant `[Bug]`/`[Feature]` text prefix from Trello card titles since the labels already carry that.
- Blocked: None.

### 2026-07-16
- Done: AI-vs-AI balance testing, River level - re-ran `scripts/balance-harness.mjs` at 20,000 games: 51.3%/48.7% (P1/P2), 0.1% draws. Consistent with the 2026-07-11 tuning result (50.7/49.3); no new skew.
- Done: AI-vs-AI balance testing, Ocean/Twin Shoals level - the harness couldn't simulate this level at all before today (only GameScene.js had the tide/shoal logic, never ported to the Phaser-free `src/lib/rules.js`). Delegated the port to Codex (mechanical mirror of `generateShoals`/`placeNodesOcean`/`advanceTide`/`isSubmerged` into `rules.js`, plus tide-advance wiring in the harness matching `endAITurn`'s ordering); reviewed the diff, applied it, ran 20,000 games: 47.6%/51.4% (P1/P2), 1.0% draws, avg 11.78/12 rounds. Win-condition shape differs notably from River - only 14.6% base-capture (vs River's 46.4%) with 82.6% going to timeup-tiles - reads as the tide clock making home sieges harder to land; win-rate split itself is healthy. Logged as a design note on the Trello card, not a bug.
- Blocked: 60fps device test still needs Ben on a real mid-range phone - moved back to Todo (was briefly In Progress by mistake before any work started on it).
- Done: Trello workflow gained a **Review** list between In Progress and Done (Foothold board + the other three task-pipeline boards: Board Game Tracker, Micro Games Hub, Pan Y Amor, Side Projects Hub), with a "Needs Review" label and a "Sign-off" checklist gate so Ben has a distinct, deliberate approval action instead of just eyeballing a chat summary. Saved as a feedback memory (`trello-review-workflow.md`).
- Done: Dev Mode tide-phase buttons - `src/lib/tileEditor.js`'s phase row now shows Low/Rising/High (was 4 raw-index buttons "0"-"3"); Low jumps to the first of the two "low" tide indices since both read identically in play.
- Done: Beach Cutoff bug - fixed the ocean-level generator boxing a shoreline/resource tile in on all sides with stacked ocean bumps (Ben caught it via a Dev Mode map export: row 7 col 1 stone, fully ocean-ringed, permanently unreachable since claiming requires 4-directional adjacency to owned territory and ocean is never claimable). Added `sealUnreachablePockets()` - flood-fills from both homes right after ocean tagging and converts any unreached non-ocean tile to ocean before nodes are placed. Fixed in `GameScene.js` (the real generator) and mirrored into `src/lib/rules.js`. Verified with a standalone reachability check across 5000 generated boards (0 trapped tiles/resources) and a 20,000-game balance re-run (48.1%/50.8%, 1.1% draws - in line with the prior 47.6%/51.4%, 1.0% baseline, no regression).
- Done: Custom app icon (quality-bar requirement) - Ben provided `app-icon.png`; resized into `assets/icons/pwa-192.png`/`pwa-512.png`, replacing the placeholder and also covering the favicon/apple-touch-icon. `sw.js` `CACHE_VERSION` bumped to v0.22. Trello card moved to Done, PROGRESS.md Next Session queue cleared of item 1.
- Fixed: Dev-mode FPS counter (added to the Dev Mode panel, `src/lib/tileEditor.js`) crashed on "New Game" - `attachTileEditor` re-runs every `create()` since GameScene is a reused instance, so its `update`/`shutdown` listeners were stacking across restarts and a stale listener called `setText()` on an already-destroyed Text object. Fixed by unhooking each session's own listeners on `shutdown`. Also fixed `balance-harness.mjs`: Player 1's simulated turn was capped at `AI_MAX_ACTIONS` (5), a limit that's actually specific to the in-game AI opponent - a real human keeps acting until out of legal/affordable moves. Uncapped Player 1's loop; re-ran and results held close to balanced (River 49.8/50.2, Ocean 49.4/49.8).
- Done: Shoreline level FPS fix (Foothold v0.23) - Ben's device test found the shoreline level dropping to ~20fps (river stayed 55-60fps). Root cause: every ocean/shoal tile carried its own masked swell/ripple/foam sprites, ~40-50 individually masked draw calls a frame, each forcing its own WebGL stencil pass on top of the already-heavier shoreline scene - mobile GPUs pay for that far more than desktop. Fixed by consolidating to 2 shared masks driven by Containers (`oceanSwellContainer`/`shoalContainer` in `GameScene.js`); `updateOceanSwellMasks()` now redraws the shared masks' backing Graphics in place instead of destroying/recreating a GeometryMask per tile. Re-tested on device: shoreline stays above 50fps. 60fps device test Trello card moved to Done.
- Done: Ran the ux-reviewer agent (+ Codex sub-agent) on v0.23; triaged its findings - the "siege enemy Special node does nothing" report was a false positive (browser-automation click-targeting issue, confirmed by manual playtest and a code review of `GameScene.js`'s siege logic). The reviewer's separate observation of a stale-cached-build risk led to shipping Foothold v0.24: a dismissable "Update available" toast (top-pill design, staged 4 options in `stage/update-toast.html` first) using per-tab baseline version detection to dodge a service-worker update-timing race condition. Full pre-push gate completed and pushed. Ship-lock queue now collapsed to a single remaining item: ship to itch.io.

### 2026-07-14
- Done: Trello made the task tracker of record - moved all Todo.md unchecked items + ship-lock items into cards on the Foothold Trello board (Todo/Backlog lists, Feature/Bug/Polish labels); `foothold/Todo.md` frozen as a historical decision/rationale log. Added two new Polish cards (AI vs AI balance testing for the River and Shoreline/Twin Shoals levels) as ship-lock prerequisites.
- Blocked: None.

## Scope Backlog (v1.1 ideas — NOT for v1)
*(Claude: when Benzur suggests an out-of-scope feature, it goes here.)*
- Game 1 — real-time variant (tiles fill red/blue as they capture gradually); playtest vs turn-based.
- Game 1 — terrain obstacles: ~~rivers (cross at bridges)~~ [PULLED INTO v1 2026-07-03] and mountains (walk around).

## Decision Log
*(Settled questions. Later models: do not reopen these.)*
- Engine: Phaser 3 + Capacitor. Godot rejected (new-tool learning cost during trial week).
- Monetization: free + one-time premium unlock IAP ($0.99–$1.99). No ads, no currency tiers.
- Launch order: itch.io first (free market test), then mobile stores, Steam only for the single best performer ($100/game fee).
- Donations: itch.io web version only. Not in mobile builds (Apple IAP rules).
- Art: start with free packs, replace highest-visibility assets first (icon, main character, UI) in Aseprite.
- Budget ceiling: $1,000 total. Spent so far: $0.
- Game 1 pacing: turn-based for shipping v1 (mobile-first). Real-time is a later A/B test, not v1.
- Game 1: procedural board is core (random node placement drives replayability); fixed board rejected.
- Game 1: claiming/capture is adjacent-only; non-adjacent reach only via a future special mechanic.
- Game 1: v1 is single-skirmish only (procedural board); upgrade draft / gauntlet / meta deferred to backlog.
- Game 1 title: **Foothold** (locked 2026-07-02 after name-collision research; Tessera + Nodewar rejected for discoverability/SEO).
- Game 1 board: **6 wide x 9 tall** (portrait), locked 2026-07-03 (was 8x8).
- Game 1: sieging the **enemy home costs 50 gold** (deliberately steep so it isn't a cheap rush).
- Game 1: **river pulled into v1** (2026-07-03, from v1.1 backlog). Rules: horizontal meander through the middle band (rows 3-5), one water tile per column, enters/exits at different rows (asymmetric); exactly 2 bridges (claimable + passable), one per half; water is impassable/unclaimable; no nodes on river or bridges.
- Game 1 node placement: same economy each side of the river (2 wood / 2 gold / 2 stone per half = balanced), positions rolled independently per half (asymmetric); 2 specials just off the water (contested, 1 per side); no two nodes orthogonally adjacent (balance wins over this in a rare thin half); each home guaranteed a node within 2 tiles for an opening move.
- Game 1 art: using Kenney "Board Game Icons" (CC0), tinted per resource — d2=gold, lumber=wood, brick/log=stone (grey), award=special, house=home, watchtower=fortify. No exact gold/stone icon in the pack (stand-ins).
- Repo structure: **single monorepo** at the pipeline root (GitHub: BenzurX/micro-games, branch `main`). Shared template + every game live as sibling folders. Repo-per-game rejected 2026-07-04 — the shared-template rule makes separate repos require submodules/copy (friction for a solo beginner), and the solo/private/premium model doesn't need per-game isolation. A breakout game can be split out later via git subtree/filter-repo with history intact.
- Game 1: **beta feedback mechanism authorized as a scope expansion** (2026-07-13, not deferred to backlog) - an in-game Bug/Feature form (Settings panel) posting to a Cloudflare Worker that creates a Trello card for triage. Needed now because Benzur is starting a friend beta test of v0.20. See DESIGN.md's "Beta feedback mechanism" section for the spec.
- **Ship-lock declared 2026-07-14** after a 2-week audit found itch.io deprioritized every session since 2026-07-02 despite being a Weekly Target. All new scope frozen (straight to v1.1 backlog) until Foothold is live on itch.io. See `SHIP-LOCK` section above.
- **Trello is the task tracker of record, effective 2026-07-14.** `foothold/Todo.md` is frozen - its `[x]` entries stay as a historical decision/rationale log (staged alternatives, tuning numbers), but no new `[ ]` items get added there. New tasks/features/bugs go straight to Trello (board_id 6a5561e77bb31280a2ad8750) as one card each, labeled Feature/Bug/Polish.

## Store/Admin Checklist
- [ ] macOS updated to latest supported version (2018 MBP → Sonoma)
- [ ] Xcode installed and opens
- [ ] Apple Developer account ($99/yr) — registered / approved
- [ ] Google Play account ($25) — registered / approved
- [ ] Note: Google requires a 14-day closed test with 12 testers before public release — recruit testers early
- [ ] itch.io account created
- [x] GitHub repo created — single monorepo BenzurX/micro-games (template + all games as folders)

## Weekly Review (paste this file into Claude chat once a week)
Ask for: honest assessment of pace vs. targets, one thing to cut, next week's targets. Keep it to one conversation.
