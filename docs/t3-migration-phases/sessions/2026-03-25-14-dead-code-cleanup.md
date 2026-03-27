# 2026-03-25-14 Dead Code Cleanup

```text
You are working in /Users/joe/Developer/game-theory-model.

Subagent instruction:
- Use subagents aggressively to conserve main-session context.
- Delegate repo exploration, architecture comparison, and other bounded
  read-heavy tasks whenever they can run in parallel.
- Keep the main session focused on synthesis, integration, decisions, and the
  critical-path implementation work.
- Do not delegate a task if the very next step is blocked on its result and it
  is faster to do locally.

Broader vision:
- Phases 1-13 of the T3 migration are complete. The new systems (command bus,
  event store, prompt-pack registry, workspace-runtime WebSocket, thread service)
  are wired end-to-end and working.
- This session removes orphaned files that the migration left behind. These files
  have zero imports and are confirmed dead by a full codebase audit.
- Follow AGENTS.md strictly: prefer deletion over duplication, repo should get
  simpler as it gets more capable.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md

Problem:
- The 13-phase T3 migration introduced new systems that supersede several old
  files. A full audit confirmed these files have zero imports anywhere in the
  codebase (no source files, no test files, no barrel exports reference them).
- Remove all orphaned files and verify the build still passes.

Files to delete (all confirmed 0 imports):
1. server/agents/phase-prompts.ts — old hardcoded phase prompt constants,
   superseded by prompt-pack-registry.ts and on-disk prompt templates
2. src/services/ai/thread-client.ts — old thread HTTP client, superseded by
   workspace-runtime-client.ts (WebSocket)
3. src/components/panels/diagnostic-error-card.tsx — unused error card component
4. src/components/panels/image-fill-popover.tsx — unused image fill UI
5. src/components/shared/font-picker.tsx — unused font picker
6. src/components/shared/icon-picker-dialog.tsx — unused icon picker
7. src/components/shared/variable-picker.tsx — unused variable picker
8. src/uikit/kit-utils.ts — unused UI kit utilities
9. src/uikit/kits/shadcn-kit-meta.ts — unused shadcn kit metadata
10. src/uikit/kits/shadcn-kit.ts — unused shadcn kit

Acceptance criteria:
- All 10 files are deleted.
- `bun run typecheck` passes.
- `bun run test` passes.
- `bun run build` passes.
- No new import errors or missing-module errors.
- If any file turns out to still be imported (the audit missed something),
  do not delete it. Instead note it in the handoff as a false positive.

Scope:
- Deleting confirmed-dead files only.
- Fixing any stale references (comments, type-only imports) that point to
  deleted files, if they exist.
- Removing empty directories left behind after deletion.

Constraints and best practices:
- Before deleting each file, run a quick grep to confirm zero imports. If a
  file turns out to have imports, skip it and document the finding.
- Do not refactor, rename, or "improve" any surviving code.
- Do not touch any file that is not on the deletion list unless it has a broken
  import pointing to a deleted file.
- Do not add new files.

Verification:
- Run `bun run typecheck`.
- Run `bun run test`.
- Run `bun run build`.

Out of scope:
- SSE transport migration.
- Prompt registry expansion.
- Entity-graph-service refactoring.
- Any feature work.

Handoff:
- List every file deleted.
- Note any false positives (files that turned out to still be imported).
- Note any empty directories removed.
- State exactly which checks were run and their results.
```
