# Post-T3 Migration Cleanup

Work items from the engineering review of the 18-phase T3 migration (2026-03-26).

## Phases

| Phase | Name | Scope | Est. CC Time |
|-------|------|-------|--------------|
| 1 | Code quality cleanup | 8 DRY/type/error fixes across adapters and types | ~20min |
| 2 | Test coverage expansion | Entity graph integration, thread CRUD, event projections, question resolution, codex errors | ~25min |
| 3 | Performance + doc cleanup | Prompt cache, receipt eviction, diagnostics cleanup, retire CURRENT-STATE.md, pin Nitro stable | ~15min |
| 4 | Persistence consolidation | Single source of truth for entity state — graph tables canonical, workspace_json + .gta derive | ~30min |

## Sequencing

Phases 1-3 are independent and can run in any order.
Phase 4 depends on Phase 1 (entity-graph-service changes overlap).

## How to use

Each session file in `sessions/` contains a complete prompt. Start a new Claude Code session and paste the prompt. Each prompt includes:
- Exact files to modify
- What to change in each file
- Acceptance criteria
- What NOT to change

## Origin

These findings come from `/plan-eng-review` run on 2026-03-26. The full review is in the conversation history. TODOS.md has the complete list of accepted decisions.
