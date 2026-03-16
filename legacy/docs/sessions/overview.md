# Implementation Sessions — Overview

## Vision

An AI-powered analytical platform where the AI conducts a full 10-phase game theory analysis per the playbook methodology. The user watches, steers via conversation, and gets results — ideally without leaving the Overview command center.

**Source of truth hierarchy:**
1. Design principles in CLAUDE.md — highest authority
2. Playbook (`docs/game-theory-analytical-methodology.md`) — defines AI behavior and analytical phases
3. UX journey map (`docs/ux-journey-map.md`) — defines screens, navigation, interaction patterns
4. Session specs (this directory) — define implementation contracts

## Milestones

| # | Milestone | Proof | Sessions |
|---|---|---|---|
| M1 | Core Data + File Format | Create a model with all entity types, save to `.gta.json`, reload, get the same thing back | 3 |
| M2 | Command/Event + Integrity | Edit and delete with undo, cascade warnings, stale markers, and revalidation events | 3 |
| M3 | App Shell + Navigation | Open the app, see the Overview command center, navigate via sidebar, inspector works on all screens | 7 |
| M4 | Solvers + Readiness | Run Nash on a 2×2 game, see readiness warnings and sensitivity analysis | 3 |
| M5 | AI Pipeline: Phases 1–4 | App serves MCP tools, AI grounds the situation, identifies players, builds baseline model, maps history | 4 |
| M6 | AI Pipeline: Phases 5–7 | Revalidation fires, AI formalizes games with all sub-sections, extracts and rates assumptions | 3 |
| M7 | AI Pipeline: Phases 8–10 + Play-Out | AI eliminates outcomes, generates scenarios with thesis, passes meta-check; play turn-by-turn | 4 |
| M8 | Export + Benchmarks | Export a bundle, replay it, pass the 10-phase benchmark suite | 2 |

**Total: 29 sessions**

Future milestones (from expert review, not yet specced):
- M9: Advanced Game Theory — coalition refinements, evolutionary dynamics, mechanism design
- M10: Research Quality — source reliability, cross-validation, evidence confidence scoring

## Session Map

### M1: Core Data + File Format (IMPLEMENTED — needs revision)

These sessions are implemented. Revision adds new entity types to align with the playbook.

- `m1-core-data/1.1-types-and-schemas.md` — All types compile, all schemas validate
- `m1-core-data/1.2-file-roundtrip.md` — .gta.json round-trips correctly
- `m1-core-data/1.3-schema-migration.md` — Schema migration handles new entity types

**Revision scope for M1:**
- Session 1.1: Add ~12 new entity types / extensions (escalation ladder, trust assessment, eliminated outcome, signal classification, repeated-game patterns, revalidation events, dynamic inconsistency risks, cross-game constraint table, central thesis, plus extensions to Player, Assumption, Scenario)
- Session 1.2: Add new entity arrays to AnalysisFile
- Session 1.3: Add migration from current schema version to new version with additional entities

### M2: Command/Event + Integrity (IMPLEMENTED — needs revision)

These sessions are implemented. Revision adds commands and cascade rules for new entity types.

- `m2-command-integrity/2.1-command-spine.md` — Commands mutate state with undo/redo
- `m2-command-integrity/2.2-cascade-integrity.md` — Deletes cascade correctly
- `m2-command-integrity/2.3-stale-persistence.md` — Stale + audit trail + revalidation log persist

**Revision scope for M2:**
- Session 2.1: Add `add_X`, `update_X`, `delete_X` commands for each new entity type; add `trigger_revalidation` command
- Session 2.2: Add REFERENCE_SCHEMA entries and cascade rules for new entity types
- Session 2.3: Add revalidation event persistence to SQLite audit trail

### M3: App Shell + Navigation (IMPLEMENTED — needs major revision)

These sessions are implemented but built for the wrong UI architecture (view-switcher instead of sidebar navigation, no Overview command center, no inspector pattern).

- `m3-app-shell/3.1-tauri-scaffold.md` — App launches with sidebar navigation and Overview as default
- `m3-app-shell/3.2-graph-view.md` — Game Map renders with inspector panel *(filename is graph-view; to be renamed to game-map during implementation)*
- `m3-app-shell/3.3-evidence-notebook.md` — Evidence is browsable with inspector integration
- `m3-app-shell/3.4-matrix-tree-views.md` — Matrix and tree views with live editing + inspector
- `m3-app-shell/3.5-timeline-lens-diff.md` — All 10 phase detail screens with inspector *(filename is timeline-lens-diff; to be renamed to phase-detail-views during implementation)*
- `m3-app-shell/3.6-manual-modeling.md` — Users can build a complete model by hand
- `m3-app-shell/3.7-overview-command-center.md` — Overview conversation UI, phase progress, key findings *(NEW)*

**Revision scope for M3:**
- Session 3.1: Replace view-switcher with sidebar nav (Overview, Timeline, Scenarios, Play-outs / Models / Phases / Settings). Overview is default view. Inspector panel pattern on all screens.
- Session 3.2: Rename Graph View → Game Map. Add inspector panel. Remove old view tabs.
- Session 3.3: Add inspector integration for evidence entities.
- Session 3.4: Add inspector panel. Matrix/tree views serve Phase 6 formalization detail.
- Session 3.5: Complete rewrite — 10 phase detail screens (one per playbook phase) with inspector. Replace old Timeline/Player Lens/Diff with new phase-aligned screens. Timeline and Scenarios become top-level nav items built here.
- Session 3.6: Mostly keep — manual modeling forms still needed. Add forms for new entity types.
- Session 3.7: NEW — Overview command center with conversation area, chat input, phase progress bar, key findings dashboard. This is the primary user workspace.

### M4: Solvers + Readiness (NOT YET IMPLEMENTED)

Solvers are infrastructure used by Phase 6 (Full Formalization). Unchanged in purpose, repositioned as tooling.

- `m4-computation/4.1-solver-readiness.md` — Solver readiness gates work
- `m4-computation/4.2-nash-dominance.md` — Nash + dominance + expected utility
- `m4-computation/4.3-backward-sensitivity.md` — Backward induction + sensitivity

**Revision scope for M4:** Minor — add readiness checks for new formalization sub-types (bargaining, signaling). Update UI integration to target Phase 6 detail screen and inspector rather than standalone "computation view."

### M5: AI Pipeline — Phases 1–4 (NOT YET IMPLEMENTED — complete rewrite)

Maps to playbook phases: Situational Grounding → Player Identification → Baseline Strategic Model → Historical Repeated Game. Each phase produces structured proposals reviewed via diff review in the Overview conversation.

- `m5-ai-pipeline-1-4/5.1-mcp-server.md` — App as MCP server *(replaces old provider-layer architecture)*
- `m5-ai-pipeline-1-4/5.2-phase-1-grounding.md` — AI researches situation, produces evidence across 7 categories *(replaces: orchestrator-research)*
- `m5-ai-pipeline-1-4/5.3-phase-2-players.md` — AI identifies players with types, objectives, information asymmetries *(replaces: evidence-normalization)*
- `m5-ai-pipeline-1-4/5.4-phase-3-4-baseline-history.md` — AI builds baseline model, maps historical interactions, assesses trust *(NEW)*

**Key changes from old M5:**
- Old Phase 0 (Intake) and Phase 1 (Validate) become pre-pipeline classification steps within 5.2, not numbered phases
- Old Phase 2 (Research) → Phase 1 Grounding, expanded with 7 evidence categories from playbook
- Old Phase 3 (Evidence normalization) merged into Phase 1 output processing
- NEW: Phase 2 (Player Identification) with player types, objective functions, information asymmetries
- NEW: Phase 3 (Baseline Model) with canonical game matching, strategy tables, escalation ladders
- NEW: Phase 4 (Historical Repeated Game) with repeated-game patterns, trust assessment, dynamic inconsistency

### M6: AI Pipeline — Phases 5–7 (NOT YET IMPLEMENTED — complete rewrite)

Maps to playbook phases: Recursive Revalidation → Full Formalization → Assumption Extraction. The revalidation mechanism is persistent (can fire from any phase) but Phase 5 is when it's most commonly triggered.

- `m6-ai-pipeline-5-7/6.1-phase-5-revalidation.md` — Revalidation mechanism with 11 trigger conditions, phase re-run orchestration *(replaces: game-identification)*
- `m6-ai-pipeline-5-7/6.2-phase-6-formalization.md` — Full formalization with all 9 sub-sections (6a–6i) using M4 solvers *(replaces: expansion-adversarial)*
- `m6-ai-pipeline-5-7/6.3-phase-7-assumptions.md` — Assumption extraction, sensitivity rating, correlated clusters, game-theoretic vs empirical classification *(replaces: prompt-workbench)*

**Key changes from old M6:**
- Old Phase 4 (Game identification) + Phase 5 (Formalization) → covered by Phases 3 (baseline) and 6 (full formalization)
- Old Phase 6 (Expansion) → absorbed into Phase 6 sub-sections (6a–6i cover everything expansion did)
- Old Phase 7 (Adversarial) → moved to Phase 10 meta-check (M7)
- NEW: Revalidation as persistent mechanism, not just "Phase 5 checkpoint"
- NEW: Phase 6 expanded from 2 sub-sections to 9 (payoff discipline, equilibrium selection, bargaining, communication, option value, behavioral overlays, cross-game effects)
- NEW: Phase 7 assumption extraction as separate phase (was scattered across old phases)
- Prompt workbench becomes a cross-cutting concern documented in 6.1 (prompt versioning still needed but not a pipeline phase)

### M7: AI Pipeline — Phases 8–10 + Play-Out (NOT YET IMPLEMENTED — major rewrite)

Maps to playbook phases: Elimination → Scenario Generation → Meta-check. Plus the play-out engine (a feature, not a pipeline phase).

- `m7-ai-pipeline-8-10/7.1-phase-8-9-elimination-scenarios.md` — AI eliminates outcomes with phase citations, generates scenarios with thesis *(replaces: composition-engine)*
- `m7-ai-pipeline-8-10/7.2-phase-10-metacheck.md` — AI runs 10 meta-check questions + 6 final test questions, adversarial challenge *(replaces: cascade-scenarios)*
- `m7-ai-pipeline-8-10/7.3-play-engine.md` — Headless play-out engine *(keep — repositioned as feature)*
- `m7-ai-pipeline-8-10/7.4-play-view.md` — Play view with AI turns and shocks *(keep — repositioned)*

**Key changes from old M7:**
- OLD composition engine (7.1) → becomes shared infrastructure used by Phase 6 cross-game effects and Phase 9 scenarios. Spec moves to a shared module, not a pipeline phase.
- OLD cascade scenarios (7.2) → replaced by Phase 8 (Elimination) + Phase 9 (Scenarios) with playbook-aligned content
- NEW: Phase 8 (Elimination) — explicit elimination of implausible outcomes with phase-citation reasoning
- NEW: Phase 10 (Meta-check) — 10 critical questions + 6 final test questions + adversarial challenge (moved from old Phase 7)
- NEW: Central thesis generation as falsifiable claim with invalidation conditions
- Play engine (7.3) and play view (7.4) kept but repositioned — play-out is a feature users access after analysis, not a pipeline phase

### M8: Export + Benchmarks (NOT YET IMPLEMENTED — needs revision)

- `m8-export-benchmarks/8.1-bundles-views.md` — Bundles round-trip correctly
- `m8-export-benchmarks/8.2-benchmarks-polish.md` — Benchmarks pass and examples load

**Revision scope for M8:**
- Session 8.1: Add new entity types to bundle format. Mostly mechanical.
- Session 8.2: Update benchmarks to test 10-phase pipeline. Add benchmark categories for phases that were missing (baseline model, history, elimination). Update preloaded examples to demonstrate full 10-phase flow.

## Cross-Cutting Concerns

These patterns span multiple milestones and are documented inline in the relevant sessions:

| Concern | Primary spec | Used by |
|---|---|---|
| **Diff review / proposal pattern** | 5.2 (first use, defines EvidenceProposal / EntityPreview / DiffReviewState) | All AI pipeline sessions (M5–M7) |
| **Inspector pattern** | 3.1 (defined), 3.7 (Overview) | All M3 sessions, all phase detail views |
| **Conversation / steering pattern** | 3.7 (Overview UI), 5.2 (AI integration) | All AI pipeline sessions via Overview |
| **Revalidation mechanism** | 6.1 (engine), 3.7 (progress bar UI) | Any AI phase can trigger it |
| **Prompt versioning** | 6.1 (integrated) | All AI pipeline phases |
| **Composition engine** | old m7-crossgame-playout/7.1-composition-engine.md (contracts preserved — EffectPatch, Resolver, PatchScope, etc.) | 6.2 Phase 6i, 7.1 Phase 9 scenarios, 7.3 play-out |

## Dependency Graph

```
M1 ──→ M2 ──→ M3 ──→ M4 ──────────────────┐
                │                            │
                ├──→ M5 (Phases 1-4) ──→ M6 (Phases 5-7) ──→ M7 (Phases 8-10)
                │                                              │
                │         ┌────────────────────────────────────┘
                │         ↓
                ├──→ M7.3/7.4 (Play-out, needs M4 + 5.1)
                │
                └──→ M8 (needs everything)
```

**Parallelism opportunities:**
- M4 and M5.1 (MCP server) can start in parallel after M3
- M7.3 (play engine) can start after M4 — needs solvers but not AI pipeline
- M5.2–5.4 are sequential (phases build on each other)
- M6 sessions are sequential
- M7.1–7.2 are sequential, but M7.3/7.4 run in parallel with M5/M6

## What Changed and Why

This overview was rewritten as part of Step 2 (spec revision) to align with the corrected vision:

1. **AI pipeline phases now map 1:1 to the playbook's 10 phases** — old pipeline had 12 numbered phases (0–11) that didn't match the methodology
2. **3 missing phases added** — Baseline Model (P3), Historical Repeated Game (P4), Elimination (P8)
3. **~12 new entity types** — escalation ladder, trust assessment, eliminated outcome, signal classification, repeated-game patterns, revalidation events, etc.
4. **UI architecture changed** — view-switcher → sidebar navigation, Overview as command center with conversation UI, inspector on all screens
5. **Revalidation repositioned** — from "Phase 5 checkpoint" to persistent mechanism with 11 trigger conditions that can fire from any phase
6. **Play-out repositioned** — from pipeline phase to feature (users explore after analysis)
7. **Adversarial challenge repositioned** — from standalone Phase 7 to part of Phase 10 meta-check
8. **M3 expanded** — new session 3.7 for Overview command center, session 3.5 rewritten for phase detail views
9. **M5/M6/M7 completely rewritten** — new directory names, new session files, new contracts
