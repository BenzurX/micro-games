# CLAUDE.md - Micro Games Pipeline

## Project Overview

Solo developer (Benzur) building a series of small, polished micro games for mobile (iOS/Android via Capacitor), web (itch.io), and eventually Steam. Goal: modest recurring revenue to fund future projects. Ship date discipline matters more than feature richness.

- Developer profile: Senior UI/UX designer, 12+ years visual design, ~1 week of Claude Code experience, comfortable with HTML/CSS, learning game dev.
- Design tools in use: Figma (mood boards, color themes), Aseprite (pixel art, asset rework).
- Monetization model: free game + single one-time "premium unlock" IAP ($0.99–$1.99). Never coin packs, never interstitial ads.

## Pre-Push Gate (do this before every `git push`, per game)

Before pushing any game's repo, complete these first (skip nothing):

1. Update that game's `CHANGELOG.md` - a new dated entry under the version being shipped.
2. Update that game's `README.md` if behavior, layout, or run steps changed.
3. Bump the version marker: add/refresh the matching frozen snapshot under `snapshots/`
   (and its `snapshots/index.html` card). If the game has a service worker (Foothold does,
   `sw.js`), also bump its `CACHE_VERSION` string - a stale one leaves players stuck on an
   old cached build even after you ship a fix.
4. Confirm `assets/CREDITS.md` covers every third-party asset in the build.
5. Remove any "em dashes" (—) and use regular dashes (-) instead.

Only after all five: commit, then push.

## Tech Stack

- **Engine:** Phaser 3 (JavaScript)
- **Mobile wrapper:** Capacitor (iOS + Android)
- **Desktop wrapper (Steam, later):** Electron or Tauri - decide per game, do not build now
- **Editor:** VS Code
- **Version control:** Git + GitHub. Commit at every working milestone with clear messages.
- **Web builds:** itch.io first for every game (zero-cost market test before store fees)

## Session Start Ritual (do this every session, unasked)

1. Read `PROGRESS.md` in the project root.
2. State today's target in one line.
3. If yesterday's target is marked incomplete, say so plainly and ask whether to finish it or consciously re-plan. Do not silently move on.
4. If there is no target set for today, help set one before writing any code.

## Scope Guardrails (important)

- Each game has a `DESIGN.md`. Treat it as the contract.
- If Benzur requests a feature not in `DESIGN.md`, pause and say: "That's outside the design doc. Add it to the v1.1 backlog in PROGRESS.md, or consciously expand scope?" Then respect his decision without re-litigating it.
- Default to the smallest implementation that feels good. Polish (game feel, juice) beats features.
- One game in active development at a time. If asked to start a second game before the first is shipped or explicitly parked, flag it once.

## Quality Bar ("not AI slop" checklist)

Before calling any game done, verify:

- [ ] Custom app icon, title screen, and UI (Benzur's own design, not stock)
- [ ] Cohesive palette applied across all assets (even reworked free packs)
- [ ] Game feel pass: screen shake, particles, sound on every meaningful action, satisfying transitions
- [ ] Free tier is genuinely fun and complete-feeling; the unlock accelerates, never cripples
- [ ] 60fps on mid-range mobile; test on a real device before shipping
- [ ] No placeholder text, debug output, or default Phaser branding anywhere

## Post-Ship Housekeeping (after each game ships)

- [ ] Run the agent audit (`.claude/agents/AUDIT.md`) and save the report to `.claude/agents/audits/game-<N>-audit.md`. Trigger phrase: "run the agent audit".

## Coding Conventions

- Plain modern JavaScript (ES modules). No TypeScript unless a game specifically needs it.
- One scene per file. Shared utilities in `/src/lib`.
- Keep the reusable template repo clean: anything generic (save system, audio manager, IAP wrapper, settings) belongs in the template, not copy-pasted between games.
- Comment the _why_, not the _what_. Benzur will read this code to learn.
- Explain new concepts briefly when introducing them (he is learning game dev, not an expert yet).

## Model Handoff Notes (for Opus/Sonnet/Haiku after July 7)

This project was planned with a more capable model. When working here:

- Do not redesign architecture or re-decide settled questions. Decisions live in `PROGRESS.md` under Decision Log and in each game's `DESIGN.md`.
- If a design doc is ambiguous, ask Benzur rather than improvising.
- Follow the Session Start Ritual and Scope Guardrails above exactly. They exist to protect the schedule.

## Repo Structure (per game)

```
game-name/
  CLAUDE.md          <- copy of this file (or symlink)
  DESIGN.md          <- game design doc: pitch, core loop, controls, content list, unlock contents
  PROGRESS.md        <- goals, daily log, decision log (project-level lives in the pipeline root)
  /src               <- Phaser code
  /assets            <- graphics, audio (track sources + licenses in assets/CREDITS.md)
  /capacitor         <- mobile wrapper config
  /snapshots         <- frozen playable copies of past milestones + index.html gallery
```

## Version Snapshots (norm for every micro game)

Goal: preserve a walkable history of the game so that a year from now we can open any
past milestone and actually play it, and see how far the game came from its first draft.

- Each game has a `/snapshots` folder. Inside it, one subfolder per saved version named
  `vX.YY` (e.g. `v0.01`, `v0.02`), matching the flat decimal version scheme.
- Every snapshot is a **fully self-contained, playable copy** (its own HTML/CSS/JS plus
  a vendored copy of Phaser under `vendor/` - never a CDN link, never a symlink). It must
  run standalone even if the live game is later rewritten.
- `snapshots/index.html` is a timeline gallery: newest at top marked CURRENT, one card
  per version with date, a short bullet list of what changed, and an Open link to that
  version's `index.html`. Update it every time a snapshot is added.
- **When to snapshot:** the first playable draft (v0.01), and every major milestone after
  (significant new mechanic, a polish pass, a store/itch build). Not every tiny tweak.
- Snapshots are frozen. Never edit a snapshot after it's saved; make the next one instead.

## Asset Licensing Rule

Every third-party asset gets a line in `assets/CREDITS.md`: name, author, source URL, license. No exceptions. Verify the license permits commercial use before importing.
