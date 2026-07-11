# DESIGN.md - Foothold (Game 1)

> Status: **living design doc.** This describes the game AS CURRENTLY BUILT (synced to the
> code 2026-07-09). The core pillars below are settled; every number is tunable by playtest
> and this doc gets re-synced when playtesting changes the rules. It records where the
> design IS, not where it started - the initial concept deliberately evolved through testing.

## Core pillars (settled - reopen only with Benzur)
1. **Pacing: turn-based.** Chosen for mobile. A real-time variant may be prototyped and
   A/B tested later, but the shipping v1 is turn-based. (Real-time idea in backlog.)
2. **Procedural board is core, not optional.** Randomly placed nodes are the source of
   replayability; a fixed board is explicitly rejected.
3. **Adjacent-only claiming/capture.** Reaching non-adjacent tiles is only allowed via a
   specific future mechanic (e.g. a watchtower tile), never as a default. (In backlog.)
4. **v1 is single-skirmish only.** Procedural board each game; no between-round upgrade
   draft / gauntlet / meta-progression in v1 (those live in the backlog).
5. **No tile is ever permanently uncapturable** - defensive pricing may raise capture
   costs, but nothing blocks a takeover outright (avoids unbreakable-wall stalemates).

## Pitch
A fast, roguelike take on 4X territory control. Race an AI opponent to claim the most
valuable tiles on a small grid before the round ends. Empire snowball feel (claim node
-> income rises -> claim more), compressed into a 2-4 minute round. No unit micro.

## Core loop (one round)
1. You spawn **bottom-right**, AI spawns **top-left**, separated by a **river**.
2. On your turn, spend resources on as many affordable actions as you want, then End Turn.
3. Owned **resource nodes** raise your per-turn income (gold / wood / stone).
4. The AI takes its turn (capped actions so it can't run away).
5. Game ends when a home base is captured (instant win) or after 12 rounds each
   (most tiles wins; income breaks a tile tie).

## Actions and the resource split (structure settled; numbers tunable)
Four actions, four highlight colors; each resource has exactly one job.
- **Expand (Claim) - gold border - costs GOLD.** Buy an *empty* neutral tile adjacent to you.
- **Build - green border - costs WOOD.** Buy a neutral tile that *has a resource node*
  (you develop it). Distinct from Expand so the two read differently on the board.
- **Upgrade - purple border - costs STONE.** Improve one of your *own* resource nodes to
  **double its per-turn output**. Once per node. **Only resource nodes can be upgraded -
  never your home tile.** (Replaced the earlier "Fortify" defensive-border idea during
  playtesting: an economic use for stone proved more interesting than a defensive one.)
- **Siege - red/orange border - costs GOLD (+ WOOD for nodes).** Take a tile the enemy
  owns. A captured node arrives "damaged": its upgrade is stripped, and the extra wood
  cost represents re-developing it. The enemy **home base** costs a deliberately steep
  flat price (no wood).
- **Special (star) node -> generalist.** Additive small income of all three resources
  (never a multiplier - multipliers rejected as too snowbally). It is a resource tile,
  so it is acquired via Build and can be Upgraded.

## Rules - current baseline (numbers as coded in GameScene.js; tune by playtest)
- **Grid:** 6 wide x 9 tall, portrait-first (changed from the initial 8x8 for mobile
  aspect). Home tiles in opposite corners: player bottom-right, AI top-left.
- **River (core mechanic):** a meandering left-to-right river in the middle band of rows
  (one water tile per column, rows 3-5) fully separates the two halves. Water is
  impassable and unclaimable; **2 bridges** (one per board half, spaced apart) are the
  only crossings and ARE claimable. Promoted from the backlog: it gives the map shape
  and a contested midline instead of a bland open field.
- **Resources:** gold, wood, stone. **Start:** 10 gold / 10 wood / 5 stone each.
- **Base income (home tile):** +2 of each per turn, so a bad board can't hard-lock you.
- **Node income:** +5 of its type per turn; **doubled to +10 when upgraded**.
  **Special (star): +3 of each** per turn (also doubles when upgraded).
- **Resource cap:** each stockpile is hard-capped at **80**; income past it is lost
  (no hoarding a huge war chest).
- **Costs:** Expand **5 gold** - Build **5 wood** - Upgrade **5 stone** -
  Siege **10 gold** (2x an expand), **+5 wood** if the target is a resource node -
  Siege the enemy **home base: 50 gold** flat.
- **Board gen (balanced economy, asymmetric positions):** per half: 2 wood, 2 gold,
  2 stone, and 1 special placed one row off the river (contested). Nodes prefer
  non-adjacent cells (anti-clump). Guarantee: each side has at least one wood AND one
  gold node within 4 tiles of its home (the farthest same-type node is relocated inward
  if not, keeping the per-half node count intact).
- **Win:** capture the enemy base (instant), or most tiles after **12 rounds** each.
  On a tile tie at time-up, higher total per-turn income wins; if that also ties, draw.
- **AI:** greedy, max **5 actions/turn**. Priority: siege an enemy node > build a
  neutral node > siege anything > expand > upgrade a safe (non-frontline) node.

## Controls (mobile-first)
- Resource counter cards with per-turn income at the top (gold / wood / stone), plus a
  settings gear (sound, CRT filter, how-to-play). Counters pulse green on income, amber
  on spend, and turn orange when capped.
- Tap a highlighted tile to act; the border color reads the action: **gold = Expand**,
  **green = Build**, **purple = Upgrade**, **red/orange = Siege**. A color-key legend
  maps each color -> action -> cost, and a hover/tap tooltip shows the gain and cost.
- HUD: a tug-of-war tile-control bar (you vs enemy) and a sun-to-moon strip of 12 round
  pips. Big End Turn button (ghost while moves remain, solid when spent) + New Game.
- Layout is responsive: portrait phones stack HUD / board / legend; wide screens put the
  board left and an info rail right.

## Monetization (per settled model - free + one unlock)
- Free = full core game. Unlock candidates (NOT built yet): extra board sizes, more
  special-node types, harder AI / endless gauntlet. Design free tier to feel complete.

## v1.1 backlog (captured, not committed)
- **Real-time variant:** tiles capture gradually - prototype and playtest vs turn-based.
- **More terrain:** mountains (walk around); the river + bridges shipped in v1, further
  terrain needs care so procedural generation stays fair/solvable.
- **Watchtower / far-reach tile:** claim or capture one square further, only when
  extending from that tile. The sanctioned exception to adjacent-only. TBD cost/limits.
- **Defensive mechanic (ex-Fortify):** if playtesting shows defense is missed, revisit
  a stone-based defense as a SECOND stone sink alongside Upgrade, never a hard block.
- Between-round upgrade draft, escalating AI gauntlet, meta-progression.
