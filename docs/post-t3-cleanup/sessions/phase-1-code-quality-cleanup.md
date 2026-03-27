# Phase 1: Code Quality Cleanup

## Context

The T3 migration (18 phases) introduced provider adapters, event sourcing, and a WebSocket transport. An eng review found 8 code quality issues: duplicated adapter utilities, `as any` casts at SDK boundaries, silent error swallowing, loose event input types, fragile codex error flow, and dead code. All issues were reviewed and accepted — this phase implements the fixes.

## Changes

### 1. Extract shared adapter utilities

**Files to create:**
- `server/services/ai/adapter-session-utils.ts`

**Files to modify:**
- `server/services/ai/claude-adapter.ts`
- `server/services/ai/codex-adapter.ts`

**What to do:**
- Extract `buildRecoveryOutcome()` from both `buildClaudeRecoveryOutcome` (claude-adapter.ts:140-151) and `buildCodexRecoveryOutcome` (codex-adapter.ts:125-136) — they are identical.
- Extract `getBindingService()` from both `getClaudeBindingService` (claude-adapter.ts:79) and `getCodexBindingService` (codex-adapter.ts:112) — they are identical wrappers.
- Extract `recordResumeDiag()` from both `recordClaudeResumeDiag` (claude-adapter.ts:155-175) and `recordCodexResumeDiag` (codex-adapter.ts:169-189) — they differ only in the `provider` field literal. Parameterize it.
- Both adapters import from the new shared module. Delete the duplicated functions.

### 2. Remove pass-through wrapper

**File:** `server/services/ai/codex-adapter.ts`

**What to do:**
- Remove `installAnalysisToolSurface` (codex-adapter.ts:507-517) — it does nothing except call `installToolSurface` with the same arguments.
- Replace all call sites with direct `installToolSurface` calls.

### 3. Extract shared conversation history builder

**Files to modify:**
- `server/services/ai/claude-adapter.ts`
- `server/services/ai/codex-adapter.ts`
- `server/services/ai/adapter-session-utils.ts` (add to same file)

**What to do:**
- Extract the identical history injection pattern from claude-adapter.ts:676-681 and codex-adapter.ts:1648-1653:
  ```
  const history = input.messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
  effectiveSystemPrompt = `${input.systemPrompt}\n\n## Conversation History\n\n${history}`;
  ```
- Create `buildHistoryInjectedPrompt(systemPrompt: string, messages: Array<{role: string, content: string}>): string` in the shared utils.

### 4. Add typed SDK result narrowing for Claude adapter

**Files to create:**
- `server/services/ai/claude-sdk-types.ts`

**Files to modify:**
- `server/services/ai/claude-adapter.ts`

**What to do:**
- Create a typed interface for the loose SDK result shape:
  ```typescript
  interface SdkResultMessage {
    subtype?: string;
    is_error?: boolean;
    errors?: string[];
    result?: string;
    structured_output?: unknown;
  }
  interface SdkContentBlock {
    type: string;
    text?: string;
    name?: string;
    input?: unknown;
    content?: Array<{ type: string; text?: string }>;
  }
  ```
- Create a `narrowSdkResult(message: unknown): SdkResultMessage` helper that validates the shape and returns typed result.
- Replace all 15+ `as any` casts in claude-adapter.ts:750-797 and 1052-1090 with calls to the narrowing function.
- Deduplicate the two parsing blocks (chat profile and analysis profile) if they share the same logic.

### 5. Add warning logs to silent catch blocks

**Files to modify:**
- `server/services/ai/codex-adapter.ts` (~line 453-458) — notification handler catch
- `server/services/workspace/workspace-runtime-query.ts` (~line 60) — empty catch
- `server/services/workspace/thread-service.ts` (~line 113) — silent JSON.parse fallback

**What to do:**
- Add `console.warn('[codex-adapter] notification handler error:', err)` (or equivalent server logging) to each silent catch block.
- Keep the catch — errors should NOT propagate. Just log them.

### 6. Discriminated union for DomainEventInput

**File:** `server/services/workspace/domain-event-types.ts`

**What to do:**
- Replace the single `DomainEventInput` interface (all fields optional) with two discriminated variants:
  ```typescript
  interface DomainEventInputWithContext {
    kind: 'explicit';
    workspaceId: string;
    threadId: string;
    // ... other fields
  }
  interface DomainEventInputWithRunContext {
    kind: 'run';
    runId: string;
    // ... other fields, workspaceId/threadId resolved from run
  }
  type DomainEventInput = DomainEventInputWithContext | DomainEventInputWithRunContext;
  ```
- Update `appendEvents` in domain-event-store.ts to discriminate on `kind`.
- Update all callers to use the appropriate variant. Most callers pass explicit context; run-lifecycle callers use the run variant.

### 7. Restructure codex adapter error flow

**File:** `server/services/ai/codex-adapter.ts`

**What to do:**
- Simplify the `runAnalysisPhase` function (codex-adapter.ts:1258-1617) to match the Claude adapter's pattern of natural error propagation instead of 4 nullable local variables + try/finally accumulation.
- Let errors propagate through normal throw/catch rather than accumulating into `primaryError`/`restoreError`.

### 8. Fix recovery service type narrowing

**File:** `server/services/workspace/runtime-recovery-service.ts`

**What to do:**
- At runtime-recovery-service.ts:199-232, replace the 5 `as any` casts with proper type narrowing.
- Extract `const phase = input.run.activePhase ?? undefined` at the top of the function and use it in the event payloads.

### 9. Remove dead entity_snapshot code

**Files to modify:**
- `src/services/ai/ai-service.ts` — delete lines 214-221 (entity_snapshot handler)
- `src/services/ai/analysis-client.ts` — delete lines 443-446 (handleChatEntitySnapshot export)

**What to do:**
- Remove the `entity_snapshot` handler from ai-service.ts — the server never emits this event.
- Remove the `handleChatEntitySnapshot` function from analysis-client.ts.
- Check for and remove any imports of `handleChatEntitySnapshot`.

## Acceptance Criteria

- `bun run typecheck` passes
- `bun run test` passes
- `bun run build` passes
- Zero `as any` casts remain in the modified adapter/recovery files (new SDK types file is the exception if SDK types are genuinely unnarrowable)
- No duplicated functions remain between claude-adapter.ts and codex-adapter.ts
- All silent catch blocks have at minimum a warning log

## What NOT to change

- Do not modify test files to make them pass — fix the source code instead
- Do not add new features
- Do not change the public API contracts
- Do not modify prompt files or analysis logic
- Do not touch the entity-graph-service (that's Phase 4)
