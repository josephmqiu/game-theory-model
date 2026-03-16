# AGENTS.md

This file only captures repo-wide rules that matter across all sessions.

## Product Priority

Optimize for the app's three core jobs:

1. Modeling strategic situations clearly
2. Visualizing them through synchronized analyst views
3. Playing out branching futures with provenance

If a tradeoff is unclear, prefer those over provider breadth, prompt tooling, or cosmetic polish.

## Authority Order

1. `CLAUDE.md` design principles and architectural invariants
2. Session contracts (types, signatures, externally visible behavior)
3. Session behavior rules
4. Session guidance and sample code

If a session spec conflicts with the design principles, do not implement the contradiction blindly. Fix or flag the spec issue first.

## Non-Negotiables

- The app must remain usable without any AI provider configured.
- Respect the three-layer boundary:
  - `L1` canonical truth in `.gta.json`
  - `L2` view state
  - `L3` derived/runtime data
- `L3` data must never silently become canonical.
- All canonical (`L1`) mutations go through the command/event spine.
- Bare strategic numbers are bugs; use structured estimate types with rationale, confidence, and provenance.
- AI outputs stay proposed or derived until explicitly reviewed and promoted.
- Prefer deterministic, inspectable behavior over opaque automation.

## Working Rule

Keep implementations session-scoped. Do not pull future milestones forward unless the user asks.
