# T3 Migration Phases

This folder contains self-contained prompts for future Codex sessions that move
the Game Theory Analyzer from its current singleton analysis shape toward the
target architecture in
[`docs/architecture/architecture-maturity-plan.md`](/Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md).

Use one file per Codex session. Each prompt assumes the session starts with no
prior context. The prompts are ordered and dependency-aware. Do not skip ahead
unless the dependency is already complete in the repo.

Observability is intentionally integrated into the relevant runtime sessions
instead of being treated as a separate track. Provider, command, persistence,
transport, run-journal, recovery, and UX phases should each improve the logs,
diagnostics, and auditability for the slice they introduce.

Naming rule:

- `YYYY-MM-DD-<nn>-<domain-slice>.md`

Session order:

1. `sessions/2026-03-25-01-canonical-runtime-contract.md`
2. `sessions/2026-03-25-02-provider-adapter-isolation.md`
3. `sessions/2026-03-25-03-command-bus-and-receipts.md`
4. `sessions/2026-03-25-04-workspace-envelope-and-sqlite-foundation.md`
5. `sessions/2026-03-25-05-event-store-and-projections.md`
6. `sessions/2026-03-25-06-server-thread-service-and-chat-contract.md`
7. `sessions/2026-03-25-07-renderer-thread-projection.md`
8. `sessions/2026-03-25-08-websocket-runtime-transport.md`
9. `sessions/2026-03-25-09-run-journal-and-phase-turn-records.md`
10. `sessions/2026-03-25-10-provider-session-resume-and-recovery.md`
11. `sessions/2026-03-25-11-prompt-pack-registry.md`
12. `sessions/2026-03-25-12-threaded-phase-turn-execution.md`
13. `sessions/2026-03-25-13-guided-analysis-interaction.md`

Use [`session-template.md`](/Users/joe/Developer/game-theory-model/docs/t3-migration-phases/session-template.md)
if a later follow-up needs to split one of these sessions further.
