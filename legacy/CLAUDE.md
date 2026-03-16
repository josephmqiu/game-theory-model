# Game Theory Analysis Platform

## What this is

A local-first desktop app for AI-powered game theory analysis. The user describes a strategic situation. The AI conducts a full 10-phase analysis per the playbook methodology (`docs/game-theory-analytical-methodology.md`). The user watches, steers via conversation, and gets results — ideally without leaving the Overview command center.

The product must be excellent at three things: **analyzing** (the AI runs a rigorous 10-phase methodology producing structured entities), **steering** (the user can direct, redirect, and challenge the AI at any point via conversation), and **presenting results** (scenarios, central thesis, eliminations displayed clearly with full traceability). If a design decision must choose, optimize for those three jobs.

The app must work without AI (manual mode), but AI-driven analysis is the primary flow.

## Design principles (non-negotiable)

These override everything — session specs, sample code, and implementation convenience. If a session contract conflicts with a principle, the principle wins and you should flag the conflict.

1. **Visible uncertainty** — Assumptions are first-class objects. Bare numbers are bugs. Every estimate has rationale, confidence, and dependencies.
2. **Human-in-the-loop** — AI proposes structured diffs. Only the user merges into the canonical model. The app must be fully functional without any MCP client connected.
3. **Structure over prose** — The structured model is the asset, not AI-generated text.
4. **Multiple formalizations** — The same strategic game can be viewed as normal-form, extensive-form, repeated, Bayesian, or coalition. Never force one representation.
5. **Local-first** — No cloud server required. Plain files. The app serves as an MCP server that AI clients (Claude Desktop, ChatGPT) connect to locally. User controls data and prompts.
6. **Inspect before promote** — Cross-game effects and play results are derived until explicitly accepted into the canonical model.

## Architecture (mental model)

Three data layers with strict boundaries:

| Layer | What lives here | Rule |
|---|---|---|
| **L1 — Canonical** | Games, players, evidence, assumptions, formalizations | Only modified via command/event spine. Persists to `.gta.json`. |
| **L2 — View state** | Graph positions, zoom, panel layout, selection | In-memory only. Never saved to the canonical file. |
| **L3 — Derived** | Solver results, readiness, play sessions, AI summaries | SQLite + in-memory. Never overwrites L1. |

Key invariant: **L3 never overwrites L1.** Derived results are provisional until the user explicitly promotes them via a command.

All L1 mutations flow through typed commands:
```
User/AI action → Command → Dispatch (validate → reduce → integrity check → commit)
  → ModelEvent (patches + inverse_patches) → Store update → View re-render
```

## How to work with session specs

Implementation is organized into milestones and sessions. Each session has a spec in `docs/sessions/`. Read `docs/sessions/overview.md` for the full map and dependency graph.

**Before starting a session:**
1. Read this CLAUDE.md.
2. Read your session spec.
3. Check "depends on" — verify those modules exist. If they don't, check if they're stubs or if you need to build them.

**Priority hierarchy when things conflict:**
1. **Design principles** (above) — highest authority
2. **Session contracts** (types, function signatures, external behavior) — must match exactly
3. **Session behavior rules** — follow unless they violate a principle
4. **Session guidance / sample code** — advisory, not binding. Sample code may have naming or structural issues; use your judgment.

**Contracts are a starting point, not gospel.** Session contracts define the integration surface between sessions. Match them by default, but if your design materially improves on a contract (better types, cleaner API, stronger invariants), deviate and document why. Think the problem through — don't force-fit a worse solution just because the spec said so. Note deviations in the spec and commit message.

**If you find a spec issue during implementation:** Fix it in the spec file, note it in the commit message, and continue. Don't implement something you know is wrong just because the spec says so.

## What to watch for

**The app must work without AI.** Session 3.6 builds manual modeling. M5-M7 build the 10-phase AI pipeline (exposed as MCP tools), and the Overview command center (3.7) is the primary workspace. If you're building AI features, make sure the non-AI path still works. The app is an MCP server — AI clients connect to it — but all features must also work with no client connected.

**Canonical vs derived boundary.** The most common spec mistake is putting derived data on L1 entities. If a field is computed (like solver readiness), it should be a cache that's excluded from `.gta.json` serialization, not a canonical field.

**Bare numbers are bugs.** Any numeric estimate in the strategic model must use `EstimateValue` with confidence, rationale, and source references. If you see a plain `number` where a strategic estimate belongs, that's a bug.

**All canonical writes go through the command spine.** Never mutate the Zustand store directly for L1 data. Always dispatch a `Command`. This is what makes undo/redo, audit trail, and dry-run previews work.

**Immutable patterns.** Always create new objects, never mutate. The command spine relies on this for JSON Patch generation and undo.

## Reference

- `docs/sessions/overview.md` — milestone map, dependency graph, session list
- `docs/sessions/REVIEW-FINDINGS.md` — known spec issues and remaining medium-severity items
- `docs/superpowers/specs/2026-03-14-infrastructure-systems-design.md` — full architecture spec (~3000 lines)
