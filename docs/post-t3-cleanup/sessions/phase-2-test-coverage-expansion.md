# Phase 2: Test Coverage Expansion

## Context

The T3 migration eng review (2026-03-26) found 21 test gaps across the new infrastructure. The overall coverage is 42/63 paths (67%). This phase addresses the 5 most critical gaps identified in the review. The test plan artifact is at `~/.gstack/projects/josephmqiu-game-theory-model/joe-main-eng-review-test-plan-20260326-140000.md`.

## Changes

### 1. Entity graph SQLite write-through integration tests (CRITICAL)

**File to create:** `server/services/__tests__/entity-graph-service.integration.test.ts`

**What to test:**
The existing `entity-graph-service.test.ts` only tests in-memory operations — it never binds a real SQLite database. Every mutation in entity-graph-service.ts calls through to SQLite via the repository, but no test verifies the write-through works.

Write integration tests that:
- Create a real SQLite database (use `:memory:` or temp file)
- Run the workspace schema migrations
- Bind entity-graph-service to the database via `_bindWorkspaceDatabaseForInit`
- Test round-trip fidelity:
  - `createEntity` → verify entity exists in SQLite via repository
  - `updateEntity` → verify updated fields persist
  - `removeEntity` → verify entity removed from SQLite + cascade relationship deletion
  - `newAnalysis` → verify `replaceAnalysis` clears and rebuilds
  - `loadAnalysis` → verify hydration from SQLite matches original
- Test startup hydration: create entities, reset in-memory state, call `hydrateFromWorkspace`, verify state matches

**Pattern to follow:** Look at `server/services/workspace/__tests__/domain-event-store.test.ts` for the pattern of creating real SQLite databases in tests. Use the same `createTestDatabase()` helper from `server/__test-utils__/fixtures.ts`.

### 2. Thread service full CRUD tests

**File to modify:** `server/services/workspace/__tests__/thread-service.test.ts`

**What to test:**
Currently only `ensureThread` + `recordMessage` are tested. Add tests for:

- `createThread(workspaceId, title)` — creates named thread with correct event emission
- `renameThread(workspaceId, threadId, newTitle)` — emits `thread.renamed` event, verify projection updates
- `deleteThread(workspaceId, threadId)` — emits `thread.deleted` event, verify thread removed from listings
- `deleteThread` on primary thread — verify business rule: should throw or reject (primary threads cannot be deleted)
- `listMessagesByThreadId` — verify returns messages in correct order
- Event emission: verify each operation emits the correct domain event type with correct metadata

### 3. Complete all 15 domain event type projections

**File to modify:** `server/services/workspace/__tests__/domain-event-store.test.ts`

**What to test:**
10 of 15 event types have projection tests. Add tests for the missing 5:

- `run.cancelled` — append event, verify run status set to "cancelled" in runs projection, verify phase turn status updated
- `question.created` — append event, verify question appears in pending_questions table with correct fields
- `question.resolved` — append event, verify question status updated to "resolved" with selected options/custom text
- `thread.renamed` — append event, verify thread title updated in threads projection
- `thread.deleted` — append event, verify thread marked as deleted and removed from `listThreadsByWorkspaceId` results

**Pattern to follow:** Each test should: create prerequisite state (workspace, thread, run if needed), append the target event, read the projection, assert the state change. Follow the exact patterns in the existing `describe("projections")` block.

### 4. Thread store question resolution tests (renderer)

**File to modify:** `src/stores/__tests__/thread-store.test.ts`

**What to test:**
The entire human-in-the-loop path for AskUserQuestion (Phase 18) has zero test coverage in the renderer store.

- `setPendingQuestions` — verify pending questions are stored and accessible
- `resolveQuestion` — verify it calls `sendRequest("question.resolve", ...)` with correct payload (questionId, selectedOptions, customText)
- `selectThread` — verify it updates `activeThreadId` and triggers rebind
- `clearPendingQuestions` — verify questions are cleared when switching threads
- Question card rendering trigger — verify `pendingQuestions` from thread-detail push is applied to store state

**Mock pattern:** The store's WebSocket requests go through `workspaceRuntimeClient.sendRequest`. Mock this the same way existing tests mock it (see the `createThread` test for the pattern).

### 5. Codex adapter error notification tests

**File to modify:** `server/services/ai/__tests__/codex-adapter.test.ts`

**What to test:**
The test file defines an `emitErrorNotification` helper (line ~123) but never calls it. The error notification path in `streamChat` is entirely untested.

- Error notification during `streamChat` — emit a Codex error notification mid-stream, verify it surfaces as a ChatEvent error to the caller
- Error notification for wrong thread — emit error notification with a different threadId, verify it's ignored
- `willRetry: true` error notification — verify the adapter handles retry-flagged errors differently from terminal errors

**Pattern:** Use the existing `emitNotification` helper pattern. The error notification format is a JSON-RPC notification with method `error` or similar — check the codex-adapter source for the exact notification method name and payload shape.

## Acceptance Criteria

- `bun run test` passes with all new tests
- `bun run typecheck` passes
- Entity graph integration tests demonstrate full SQLite round-trip
- Thread service tests cover all 4 CRUD operations + primary thread guard
- All 15 domain event types have projection tests
- Thread store question resolution path is tested
- Codex error notification path is tested

## What NOT to change

- Do not modify source files — this phase is tests only
- Do not add new features or refactor existing code
- Do not change existing passing tests
- If a test reveals a bug in the source code, write the test to document the current behavior and add a `// BUG:` comment explaining what should happen. The fix belongs in a separate commit.
