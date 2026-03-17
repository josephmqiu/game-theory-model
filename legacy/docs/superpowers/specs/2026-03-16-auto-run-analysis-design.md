# Auto-Run Full Analysis

## Problem

Clicking "Start analysis" only initializes the pipeline. The user must then manually click "Run next phase" for each of 10 phases, and accept each proposal between phases. There is no way to run the full pipeline end-to-end automatically.

## Approach

Auto-accept proposals in the orchestrator loop (Approach B). Keep proposal infrastructure intact; add a `runFullAnalysis` method that loops all phases and auto-accepts proposals after each.

## Changes

### 1. `shared/game-theory/types/analysis-pipeline.ts` — PipelineOrchestrator interface

Add:

```ts
runFullAnalysis(description: string): Promise<AnalysisState>
```

### 2. `shared/game-theory/pipeline/host.ts` — PipelineHost interface

Add:

```ts
acceptAllPendingProposals(phase: number): number
```

Returns the count of proposals accepted. The host implementation dispatches each pending proposal's commands through the command spine.

### 3. `src/services/pipeline-host.ts` — PipelineHost implementation

Implement `acceptAllPendingProposals(phase)`:

- Read all proposal groups for the given phase from conversation store
- For each pending proposal, call `acceptConversationProposal` with current canonical state and dispatch function
- Return the count of successfully accepted proposals

### 4. `shared/game-theory/pipeline/orchestrator.ts` — runFullAnalysis

Implement:

```
startAnalysis(description, { manual: false })
for phase 1..10:
  runPhase(phase)
  host.acceptAllPendingProposals(phase)
```

If a phase fails, stop and return the current analysis state. Emit a conversation message on failure.

### 5. `shared/game-theory/types/command-bus.ts` — AppCommandPayloadMap

Add:

```ts
run_full_analysis: {
  description: string;
}
```

### 6. `src/services/app-command-runner.ts` — command handler

Add `run_full_analysis` case that calls `pipelineController.runFullAnalysis(payload.description)`.

### 7. `src/routes/editor/index.tsx` — Overview UI

When `manualMode` is false, the "Start analysis" button calls `run_full_analysis` instead of `start_analysis`. When `manualMode` is true, keeps current `start_analysis` behavior.

## What stays unchanged

- All phase functions (they still produce proposals)
- Proposal types, conversation store, ProposalReview component
- Command spine, dispatch, canonical store
- Manual mode workflow
