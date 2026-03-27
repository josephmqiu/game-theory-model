# Phase 3: Performance Fixes + Doc Cleanup + Pin Nitro

## Context

The T3 migration eng review (2026-03-26) found performance issues (sync I/O, unbounded memory growth) and stale documentation. This phase bundles the quick wins.

## Changes

### 1. Add prompt pack caching with mtime invalidation

**File:** `server/services/prompt-pack-registry.ts`

**What to do:**
`resolvePromptPack` reads template files from disk synchronously on EVERY call with no caching. A 10-phase analysis calls this 10+ times, each reading manifest JSON + all template .md files via `readFileSync`.

Add an in-memory cache:
- Cache key: `${root}:${packName}:${mode}`
- Cache value: resolved pack + file mtimes at cache time
- On cache hit: `statSync` each file to check mtime. If any file changed, invalidate and re-read.
- This eliminates ~90% of disk reads while still picking up user edits to `~/.gta/` prompt files.

The cache should be module-level (same lifecycle as the registry). Add a `clearPromptPackCache()` for tests.

### 2. Add receipt map eviction to command bus

**File:** `server/services/command-bus.ts`

**What to do:**
The `createInMemoryReceiptStore` uses two Maps (`receiptsByCommandId`, `receiptsByReceiptId`) that grow indefinitely — every completed command receipt stays in memory permanently.

Add an eviction policy:
- After a receipt reaches terminal state (completed, failed, conflicted, deduplicated), start a TTL timer.
- After 5 minutes, delete the receipt from both maps.
- Alternative: LRU with max 1000 entries.
- Either approach is fine for a desktop app.

### 3. Clean up diagnostics map on connection close

**File:** `server/services/workspace/workspace-runtime-transport.ts`

**What to do:**
`diagnosticsByConnectionId` entries are never removed when connections close. `closeWorkspaceRuntimeConnection` deletes from `peerStates` but not from `diagnosticsByConnectionId`.

In the close handler (or wherever `peerStates.delete(peer.id)` is called), also delete from `diagnosticsByConnectionId`. The connection is gone — its diagnostics are no longer useful.

### 4. Retire CURRENT-STATE.md

**File to delete:** `docs/CURRENT-STATE.md`

**File to modify:** `CLAUDE.md`

**What to do:**
- Delete `docs/CURRENT-STATE.md` — the doc says it will be "retired once the codebase matches the contract." After 18 phases, the codebase matches the contract. The doc still references "persistent SSE" and "run-status-store" which no longer exist.
- In `CLAUDE.md`, find and remove the reference to CURRENT-STATE.md under "Key References":
  ```
  - Current state: `docs/CURRENT-STATE.md` (transitional grounding memo)
  ```
  Delete this line.

### 5. Pin Nitro to stable release

**File:** `package.json`

**What to do:**
- Find the `nitro-nightly` (or similar) dependency. The codex outside voice flagged depending on `nitro-nightly@latest` as contradicting stabilization goals.
- Check the current version: `bun pm ls | grep nitro`
- Find the latest stable nitro release (check npm registry).
- Pin to that specific version instead of `latest` or nightly.
- Run `bun install` to update bun.lock.
- Run `bun run build` to verify compatibility.

**If no stable release is available** (nitro may only publish nightlies for Bun support), pin to the specific nightly version that's currently working instead of `@latest`. Document why in a code comment.

## Acceptance Criteria

- `bun run typecheck` passes
- `bun run test` passes
- `bun run build` passes
- Prompt pack registry has caching (verify with a simple timing test or log)
- Receipt map does not grow indefinitely (verify eviction in command-bus.test.ts)
- Diagnostics map cleaned on close (verify in runtime.get.test.ts)
- `docs/CURRENT-STATE.md` deleted
- CLAUDE.md no longer references CURRENT-STATE.md
- Nitro dependency pinned to specific version

## What NOT to change

- Do not modify adapter code (that's Phase 1)
- Do not modify test infrastructure (that's Phase 2)
- Do not touch entity-graph-service (that's Phase 4)
- Do not add new features
