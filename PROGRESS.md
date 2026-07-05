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
- **Date:** 2026-07-04
- **Target:** Reconcile the July 3 work (6x9 board, river, Kenney icons, tooltips) — backfill the log and snapshot it as v0.03.
- **Status:** done (v0.03 snapshot saved self-contained; gallery + log updated). Benzur confirmed the July 3 build was working.

## Next Session
*(Canonical resume queue — the single source of truth for "ready to continue?". Set at
session close via the Session End Ritual; restated verbatim and worked from item 1 on
resume. A newer plan replaces this whole section. See global CLAUDE.md → Session handoff.)*
- (set at session close)

## Daily Log
*(Append one entry per work day. Three lines max.)*

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
- Blocked: Can't push to GitHub yet — `gh` not installed and no remote exists (needs Benzur: GitHub Desktop publish or install gh).
- Tomorrow (next session): (set at session close)

## Balance / Tuning To-Do (v1 — must solve before ship)
- **Late-game snowball (raised 2026-07-04):** by ~turn 6+, a player with early gold/wood
  nodes can chain-claim ~10 tiles in a single turn, which feels hasty vs the slow opening.
  Likely causes: income compounds too fast (flat +10/node with no upkeep) and/or chained
  actions per turn are unbounded for the human. Candidate fixes to weigh later: per-turn
  action cap, rising claim cost as you hold more tiles, diminishing/again node income, or
  a soft economy ceiling. Decide by playtest AFTER the juice pass (juice must not mask it).

## Scope Backlog (v1.1 ideas — NOT for v1)
*(Claude: when Benzur suggests an out-of-scope feature, it goes here.)*
- Game 1 — real-time variant (tiles fill red/blue as they capture gradually); playtest vs turn-based.
- Game 1 — terrain obstacles: ~~rivers (cross at bridges)~~ [PULLED INTO v1 2026-07-03] and mountains (walk around).
- Game 1 — watchtower/far-reach tile: sanctioned exception to adjacent-only, reaches one square further.

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
