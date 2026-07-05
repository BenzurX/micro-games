# DESIGN.md — Foothold (Game 1)

> Status: **core pillars confirmed by Benzur 2026-07-02.** Title locked: **Foothold**
> (chosen after name-collision research; clean namespace, thematically apt for territory
> control). Remaining numeric values (costs, income, board counts) are still tunable.

## Confirmed Decisions (locked — do not reopen without Benzur)
1. **Pacing: turn-based.** Chosen for mobile. A real-time variant may be prototyped and
   A/B tested later, but the shipping v1 is turn-based. (Real-time idea in backlog.)
2. **Procedural board is core, not optional.** Randomly placed nodes are the source of
   replayability; a fixed board is explicitly rejected.
3. **Adjacent-only claiming/capture.** Reaching non-adjacent tiles is only allowed via a
   specific future mechanic (e.g. a watchtower tile), never as a default. (In backlog.)

## Pitch
A fast, roguelike take on 4X territory control. Race an AI opponent to claim the most
valuable tiles on a small grid before the round ends. Empire snowball feel (claim node
→ income rises → claim more), compressed into a 2-4 minute round. No unit micro.

## Core loop (one round)
1. You spawn **bottom-right**, AI spawns **top-left** of a small grid.
2. On your turn, spend **gold** to **Claim** empty neutral tiles, or **wood** to **Build**
   neutral resource tiles, adjacent to your territory.
3. Owned **resource nodes** raise your per-turn income (gold / wood / stone).
4. Spend **gold** to **Siege** enemy tiles; spend **stone** to **Fortify** your resource nodes.
5. End your turn; the AI does the same.
6. Round ends at the turn limit (or early domination) → most tiles owned wins.

## Actions & the resource split (structure — LOCKED 2026-07-02, revised same day)
Four actions, four highlight colors; each resource has exactly one job.
- **Claim — gold border — costs GOLD.** Buy an *empty* neutral tile adjacent to you.
- **Build — green border — costs WOOD.** Buy a neutral tile that *has a resource node* on it
  (you develop it). Distinct from Claim so the two reads differently on the board.
- **Fortify — purple border — costs STONE.** Reinforce one of your *own* resource nodes; adds a
  permanent border that holds until the tile is sieged. **Only resource nodes can be fortified —
  never your home/start tile.**
- **Siege — red/orange border — costs GOLD.** Take a tile the enemy owns. Costs the *same as
  Claiming an empty tile*; a tile the enemy has **fortified costs 2×**, and the siege removes the
  fortification as it takes the tile.
- **Special (★) node → generalist.** Additive small income of all three resources (never a
  multiplier — multipliers rejected as too snowbally). It is a resource tile, so it is acquired
  via **Build** and can be **Fortified**.
- **No tile is ever permanently uncapturable** — fortification only raises the siege price, it
  never blocks the takeover (avoids unbreakable-wall stalemates).

## Rules — current baseline (structure locked above; NUMBERS tunable by playtest)
- **Grid:** 8x8 square tiles; opposite corners are home tiles. (May move to a taller mobile
  ratio like 6x9 later — see backlog.)
- **Orientation:** player home **bottom-right**, AI home **top-left**.
- **Pacing:** turn-based. You take as many affordable actions as you want, then End Turn.
- **Resources:** gold, wood, stone. **Start / income numbers below are PLACEHOLDERS** pending a
  balance pass (Mockup 1's 20/10/16 with +7/+4/+2 income are illustrative, not final).
- **Base income (home tile):** +2 of each/turn, so a bad procedural board can't hard-lock you.
- **Resource node income:** +10 of its own type/turn. **Special (★):** +5 of each/turn.
- **Claim** an empty neutral tile: **5 gold**.
- **Build** a neutral resource tile: **5 wood** (may end up pricier than Claim — resource tiles
  are worth more; tune in playtest).
- **Siege** an enemy tile: **5 gold** (same as Claim); a **fortified** enemy tile: **10 gold** (2×).
- **Fortify** one of your resource nodes: **5 stone**.
- **Board gen:** nodes scattered randomly (procedural) — ~6 wood, 6 gold, 6 stone, 2 special.
- **Win:** capture the enemy base tile (instant win), or hold the most tiles after 12 rounds
  each. Home/base tiles can't be fortified, so a base falls to a normal-cost Siege.
- **AI:** greedy — builds/claims nodes, sieges enemy tiles, fortifies frontline nodes; capped
  actions per turn so it can't run away.

## Controls (mobile-first)
- Resource counters with per-turn income sit at the top (gold / wood / stone), plus a settings gear.
- Tap a highlighted tile to take its action, read from the border color: **gold = Claim**,
  **green = Build**, **purple = Fortify** (your node), **red/orange = Siege**. An on-screen
  color-key legend maps each color → action → cost.
- Big End Turn button. HUD also shows round # and tile counts (you vs AI).
- Material icons (gold / wood / stone) are shared between the HUD counters and the board nodes.

## Monetization (per settled model — free + one unlock)
- Free = full core game. Unlock candidates (NOT built yet): extra board sizes, more
  special-node types, harder AI / endless gauntlet. Design free tier to feel complete.

## Open questions (for Benzur)
- None outstanding. (Title resolved: Foothold.)

## Confirmed (continued)
4. **v1 is single-skirmish only.** Procedural board each game; no between-round upgrade
   draft / gauntlet / meta-progression in v1 (those live in the backlog).

## v1.1 backlog (NOT for prototype — captured, not committed)
- **Real-time variant:** tiles capture gradually — an enemy tile "fills red" as it's
  taken while your targeted tiles "fill blue". Prototype and playtest vs turn-based to
  see which is more fun. Turn-based ships first regardless.
- **Terrain obstacles:** rivers (crossable only at bridges) and mountains (walk around).
  Blocks/shapes paths. Needs careful design so procedural generation stays fair/solvable.
- **Watchtower / far-reach tile:** a special tile that lets you claim or capture one square
  further, but only when extending from that tile. The sanctioned exception to
  adjacent-only. TBD on cost and limits.
- Between-round upgrade draft, escalating AI gauntlet, meta-progression.
- Sound, particles, screen shake (game-feel pass comes after the loop is fun).
