# Agent Audit Process

Run this at the **end of every game**, before marking it shipped in `PROGRESS.md`.
The goal: decide, from real evidence, whether each sub-agent earned its keep and how
to improve it for the next game. Agents should get sharper over 10 games, not drift.

Trigger phrase to start it: **"run the agent audit"** (Claude: follow the steps below).

---

## When to run
- After a game is polished and its ship tasks are done, as the final housekeeping step.
- Optionally a lighter mid-project run if an agent clearly misbehaved.

## Step 1 — Gather evidence (Claude does this)
For the game just finished, collect:
- Which agents were actually invoked, and roughly how often. (Check this session's
  history, git log, and the game's `PROGRESS.md` daily log.)
- What each was asked to do and whether the result was used as-is, edited heavily, or
  thrown away.
- Any moment an agent gave a wrong answer, needed re-prompting, stalled, or was
  overkill for a trivial task.
- Recurring work that had NO agent and probably should have.

If evidence is thin (agent barely used), say so honestly rather than inventing a grade.

## Step 2 — Score each agent
For every agent in `.claude/agents/`, judge these dimensions:

| Dimension | Question |
|-----------|----------|
| **Used?** | Invoked this game? How many times? Or unused? |
| **Goal met?** | effective / partial / failed / not-used |
| **Instructions** | Any ambiguity, wrong assumption, or missing rule that caused friction? |
| **Model fit** | Over-powered (doing trivial work on an expensive model → downgrade) or under-powered (stalling, wrong root causes → upgrade)? |
| **Effort posture** | Too demanding / too shallow for the actual work? |
| **Handoffs** | Any collaboration friction (e.g. mobile-builder ↔ monetization boundary)? |

Then a **recommendation** per agent, one of:
`keep as-is` · `tweak wording` · `change model` · `change effort` · `merge with X` ·
`retire` · (roster-level) `add new agent: <name/purpose>`

## Step 3 — Roster-level questions
- Is any agent redundant or never used across two games running? Candidate to retire.
- Did a recurring pain point appear with no agent to own it? Candidate to add.
- Any two agents whose scopes keep overlapping? Candidate to merge or re-draw the line.

## Step 4 — Record and apply
1. Fill in the template below and save it as
   `.claude/agents/audits/game-<N>-audit.md`.
2. Present the recommendations to Benzur. Apply only the ones he approves.
3. If a **model or effort level** is changed, also add a one-line entry to the
   Decision Log in the root `PROGRESS.md` so the change is traceable and lesser models
   don't silently reopen it.
4. Note in the audit file which recommendations were applied vs. deferred.

Keep it honest: an agent that wasn't needed this game isn't a failure, and "keep as-is"
is a valid and common outcome. Don't churn agents for the sake of it.

---

## Template (copy into `audits/game-<N>-audit.md`)

```markdown
# Agent Audit — Game <N>: <title>
Date: <YYYY-MM-DD>

## Summary
<2-3 sentences: overall how the roster performed this game.>

## Per-agent review

### mobile-builder
- Used: <yes N times / no>
- Goal met: <effective / partial / failed / not-used>
- Instructions: <friction or "clean">
- Model fit (opus): <right / downgrade to X / upgrade>
- Effort (high): <right / adjust>
- Recommendation: <keep / tweak / change model / change effort / merge / retire>

### monetization
- Used:
- Goal met:
- Instructions:
- Model fit (sonnet):
- Effort (high):
- Recommendation:

### game-researcher
- Used:
- Goal met:
- Instructions:
- Model fit (sonnet):
- Effort (medium):
- Recommendation:

### ux-reviewer
- Used:
- Goal met:
- Instructions:
- Model fit (sonnet):
- Effort (high):
- Recommendation:

### license-auditor
- Used:
- Goal met:
- Instructions:
- Model fit (haiku):
- Effort (low):
- Recommendation:

## Roster-level
- Redundant / unused agents:
- Missing agent (recurring pain with no owner):
- Overlapping scopes to redraw:

## Actions
- Applied this cycle:
- Deferred / rejected:
- Decision Log entries added to PROGRESS.md:
```
