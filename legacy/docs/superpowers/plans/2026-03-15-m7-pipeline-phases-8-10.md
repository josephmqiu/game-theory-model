# M7 Pipeline Phases 8-10 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement phases 8 (Elimination), 9 (Scenario Generation), and 10 (Meta-check) of the AI analysis pipeline — completing the 10-phase playbook methodology.

**Architecture:** Each phase follows the established runner pattern: a function that reads canonical store + prior phase results, applies heuristic logic, and returns a typed result with `ModelProposal[]`. All canonical entity types, schemas, and commands already exist. The orchestrator and MCP tools have stubs that get replaced with real implementations.

**Tech Stack:** TypeScript, Vitest, React, Zustand, Zod

**Scope:** Sessions 7.1 (Phase 8+9) and 7.2 (Phase 10) only. Sessions 7.3/7.4 (play-out engine/view) are a separate feature and need their own plan — their specs reference old contracts not available in the current session docs.

---

## Existing Infrastructure (What's Already Built)

Before implementing, understand what exists:

- **Canonical types**: `EliminatedOutcome`, `Scenario`, `CentralThesis`, `TailRisk` — all defined in `src/types/schemas.ts` with Zod schemas, and in `src/types/evidence.ts` as inferred types. Collections exist in `CanonicalStore`.
- **Commands**: Auto-generated from entity types (`add_eliminated_outcome`, `add_scenario`, `add_central_thesis`, `add_tail_risk`, etc.) via `src/engine/commands.ts`.
- **ModelProposal types**: `'elimination'`, `'scenario'`, `'thesis'` already in the union in `src/types/analysis-pipeline.ts`.
- **ForecastEstimate**: Defined in `src/types/estimates.ts`, schema at `src/types/schemas.ts:93`. Has `mode`, `value`, `min`, `max`, `conditions`, `confidence`, `rationale`, `source_claims`, `assumptions`.
- **Helpers**: `buildModelProposal`, `createEntityId`, `createEntityPreview`, `createEstimate`, `asEntityRef`, `listEntityRefs` in `src/pipeline/helpers.ts`.
- **Orchestrator stub**: `src/pipeline/orchestrator.ts:707-715` — else branch returning "not implemented" error.
- **MCP tool stubs**: `src/mcp/tools/phases.ts:348-363` — stubs for phases 8, 9, 10.
- **Phase runner pattern**: See `src/pipeline/phase-7-assumptions.ts` for reference. Function takes context object (canonical, baseRevision, phaseExecution, phaseResults), returns typed result with proposals.
- **Test fixtures**: `src/pipeline/phases.test.ts` has `createPhase6CanonicalStore()`, `createPhase7CanonicalStore()`, etc.

---

## Chunk 1: Phase result types for phases 8-10

Add all new pipeline result types to `analysis-pipeline.ts`. These are the PROPOSED types (pipeline outputs), distinct from the canonical types that already exist.

### Task 1.1: Add Phase 8-10 result types

**Files:**
- Modify: `src/types/analysis-pipeline.ts`

- [ ] **Step 1: Read `src/types/analysis-pipeline.ts` to find the insertion point**

Find `AssumptionExtractionResult` (the last phase result type, near line 664). New types go after it, before `RevalidationCheck`.

- [ ] **Step 2: Add Phase 8 types**

```typescript
// ── Phase 8: Elimination ──

export interface ProposedEliminatedOutcome {
  temp_id: string
  outcome_description: string
  elimination_reasoning: string
  citing_phases: { phase: number; finding: string }[]
  evidence_refs: EntityRef[]
  surprise_factor: 'high' | 'medium' | 'low'
  related_scenarios: EntityRef[]
}

export interface EliminationResult {
  phase: 8
  status: PhaseResult
  eliminated_outcomes: ProposedEliminatedOutcome[]
  proposals: ModelProposal[]
}
```

- [ ] **Step 3: Add Phase 9 types**

Also add at the top of the file, alongside the existing `EstimateValue` import:
```typescript
import type { ForecastEstimate } from './estimates'
```

```typescript
// ── Phase 9: Scenario Generation ──

export type ForecastBasis = 'equilibrium' | 'discretionary' | 'mixed'

export interface ScenarioCausalStep {
  phase: string
  event: string
  leads_to: string
}

export interface ScenarioAssumptionRef {
  assumption_ref: EntityRef
  sensitivity: 'critical' | 'high' | 'medium' | 'low'
}

export interface ProposedScenarioFull {
  temp_id: string
  name: string
  narrative: {
    summary: string
    causal_chain: ScenarioCausalStep[]
    full_text: string
  }
  probability: ForecastEstimate
  key_assumptions: ScenarioAssumptionRef[]
  invalidation_conditions: string[]
  model_basis: EntityRef[]
  cross_game_interactions: EntityRef[]
  forecast_basis: ForecastBasis
  forecast_basis_explanation: string
}

export interface ProposedTailRisk {
  temp_id: string
  event_description: string
  probability: ForecastEstimate
  trigger: string
  why_unlikely: string
  consequences: string
  drift_toward: boolean
  drift_evidence: string | null
}

export interface ProposedCentralThesis {
  statement: string
  falsification_condition: string
  evidence_refs: EntityRef[]
  assumption_refs: EntityRef[]
  scenario_refs: string[] // temp_ids during proposal; converted to EntityRef[] in command payload
  forecast_basis: ForecastBasis
}

export interface ScenarioProbabilityCheck {
  sum: number
  missing_probability: number
  warning: string | null
}

export interface ScenarioGenerationResult {
  phase: 9
  status: PhaseResult
  proposed_scenarios: ProposedScenarioFull[]
  tail_risks: ProposedTailRisk[]
  central_thesis: ProposedCentralThesis
  probability_check: ScenarioProbabilityCheck
  proposals: ModelProposal[]
}
```

- [ ] **Step 4: Add Phase 10 types**

```typescript
// ── Phase 10: Meta-Check ──

export interface MetaCheckAnswer {
  question_number: number
  question: string
  answer: string
  concern_level: 'none' | 'minor' | 'significant' | 'critical'
  revision_triggered: import('../types/evidence').RevalidationTrigger | null
  evidence_refs: EntityRef[]
}

export interface FinalTestAnswer {
  question_number: number
  question: string
  answer: string
  completeness: 'fully_answered' | 'partially_answered' | 'cannot_answer'
  gap_description: string | null
}

export type ChallengeCategory =
  | 'framing_choice'
  | 'omitted_actor'
  | 'omitted_strategy'
  | 'omitted_latent_driver'
  | 'overconfident_payoff'
  | 'naive_independence'
  | 'unjustified_equilibrium'
  | 'linear_scenario'
  | 'missing_cross_game_effect'
  | 'evidence_quality'
  | 'structural_bias'

export interface AdversarialChallenge {
  id: string
  category: ChallengeCategory
  target: EntityRef | null
  severity: 'critical' | 'high' | 'medium' | 'low'
  challenge: string
  evidence_against: EntityRef[]
  suggested_revision: string
  affected_conclusions: EntityRef[]
  response_status: 'unaddressed' | 'accepted' | 'rejected' | 'deferred'
  analyst_response: string | null
}

export interface AdversarialResult {
  challenges: AdversarialChallenge[]
  overall_assessment: 'robust' | 'defensible' | 'vulnerable' | 'flawed'
}

export interface MetaCheckResult {
  phase: 10
  status: PhaseResult
  meta_check_answers: MetaCheckAnswer[]
  final_test_answers: FinalTestAnswer[]
  adversarial_result: AdversarialResult
  revisions_triggered: import('../types/evidence').RevalidationTrigger[]
  analysis_complete: boolean
}
```

- [ ] **Step 5: Add PhaseRunInput types and update the union**

Find `Phase7RunInput` and `PhaseRunInput` (near line 748-750). Add:

```typescript
export interface Phase8RunInput {}
export interface Phase9RunInput {}
export interface Phase10RunInput {}

export type PhaseRunInput = Phase1RunInput | Phase2RunInput | Phase6RunInput | Phase7RunInput | Phase8RunInput | Phase9RunInput | Phase10RunInput
```

- [ ] **Step 6: Verify compilation**

Run: `npx tsc --noEmit`
Expected: Clean build.

- [ ] **Step 7: Commit**

```
feat: add Phase 8-10 pipeline result types

EliminationResult, ScenarioGenerationResult, MetaCheckResult with all
supporting interfaces for the 3 remaining pipeline phases.
```

---

## Chunk 2: Phase 8 elimination runner

Phase 8 examines the stabilized model and eliminates implausible outcomes with explicit phase citations.

### Task 2.1: Write Phase 8 tests

**Files:**
- Create: `src/pipeline/phase-8-elimination.test.ts`
- Reference: `src/pipeline/phases.test.ts` for fixture patterns

- [ ] **Step 1: Read existing test fixtures**

Read `src/pipeline/phases.test.ts` to understand `createPhase6CanonicalStore()` and `createPhase7CanonicalStore()` — these create canonical stores with games, players, formalizations, and assumptions that Phase 8 will read.

Also read `src/pipeline/phase-7-assumptions.ts` (first 30 lines for function signature) and `src/types/analysis-pipeline.ts` for context types.

- [ ] **Step 2: Write Phase 8 test file**

Create `src/pipeline/phase-8-elimination.test.ts` with these test cases:

1. **"produces eliminations citing specific phase findings when dominated strategies exist"** — Create a canonical store with a game, 2 formalizations with equilibria, and Phase 6 + Phase 7 results. Run phase 8. Expect: eliminated_outcomes.length > 0, each has citing_phases with phase numbers, each has surprise_factor, proposals contain add_eliminated_outcome commands.

2. **"returns empty eliminations when no dominated or contradicted outcomes exist"** — Use a minimal canonical store with no dominated strategies and no contradicted assumptions. Expect: eliminated_outcomes.length === 0, status.status === 'complete'.

3. **"assigns surprise_factor based on whether outcome appears plausible to non-experts"** — Ensure at least one elimination has surprise_factor set to 'high', 'medium', or 'low'.

Use the `createPhase7CanonicalStore()` fixture from phases.test.ts as the base, and add the Phase 6 result by running `runPhase6Formalization()` in the test setup. The Phase 8 runner context should include `phaseResults` with phases 6 and 7.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/pipeline/phase-8-elimination.test.ts`
Expected: FAIL — module not found.

### Task 2.2: Implement Phase 8 runner

**Files:**
- Create: `src/pipeline/phase-8-elimination.ts`

- [ ] **Step 1: Implement the runner**

Create `src/pipeline/phase-8-elimination.ts`. Follow the established pattern:

```typescript
import type { CanonicalStore } from '../types'
import type {
  EliminationResult,
  FormalizationResult,
  AssumptionExtractionResult,
  ModelProposal,
  PhaseExecution,
  PhaseResult,
  ProposedEliminatedOutcome,
} from '../types/analysis-pipeline'
import type { EntityRef } from '../types/canonical'
import {
  buildModelProposal,
  createEntityId,
  createEntityPreview,
  asEntityRef,
} from './helpers'

interface Phase8RunnerContext {
  canonical: CanonicalStore
  baseRevision: number
  phaseExecution: PhaseExecution
  phaseResults: Record<number, unknown>
}

export function runPhase8Elimination(context: Phase8RunnerContext): EliminationResult {
  // ... implementation
}
```

**Heuristic logic:**

1. Read Phase 6 result (`context.phaseResults[6] as FormalizationResult`) for equilibrium analysis and formalization summaries.
2. Read Phase 7 result (`context.phaseResults[7] as AssumptionExtractionResult`) for assumption sensitivity.
3. Walk each game's formalizations from canonical store. For each formalization:
   - Check if any strategies are dominated (from Phase 6c equilibria summaries).
   - Check if any critical assumptions are contradicted (Phase 7 + canonical assumptions with contradicted_by).
   - For outcomes that depend entirely on dominated strategies or contradicted assumptions, create a `ProposedEliminatedOutcome`.
4. Each elimination must cite the specific phase: e.g., `{ phase: 6, finding: 'Strategy X is strictly dominated in normal-form analysis' }`.
5. Set surprise_factor: 'high' if the outcome involves >2 players or multiple games (complex → surprising to eliminate), 'medium' for single-game outcomes, 'low' for trivially dominated.
6. Build `add_eliminated_outcome` command proposals using `buildModelProposal`.
7. Return `EliminationResult`.

If no Phase 6 or 7 results exist, return a partial result with empty eliminations and a warning.

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/pipeline/phase-8-elimination.test.ts`
Expected: All pass.

- [ ] **Step 3: Commit**

```
feat: implement Phase 8 elimination runner

Heuristic-mode elimination engine that walks formalizations and
assumptions to eliminate implausible outcomes with phase citations.
```

---

## Chunk 3: Phase 9 scenario generation runner

Phase 9 builds scenarios, generates the central thesis, identifies tail risks, and checks probability consistency.

### Task 3.1: Write Phase 9 tests

**Files:**
- Create: `src/pipeline/phase-9-scenarios.test.ts`

- [ ] **Step 1: Write Phase 9 test file**

Test cases:

1. **"generates scenarios from equilibrium paths with narrative and probability"** — Run with a canonical store that has games, formalizations, Phase 6 equilibria, and Phase 7 assumptions. Expect: proposed_scenarios.length > 0, each has narrative.summary, probability, key_assumptions, invalidation_conditions, forecast_basis.

2. **"produces a central thesis with falsification condition"** — Expect: central_thesis.statement is non-empty, central_thesis.falsification_condition is non-empty, central_thesis.scenario_refs reference proposed scenario temp_ids.

3. **"identifies tail risks from critical assumptions"** — Expect: tail_risks.length > 0 when Phase 7 has critical assumptions with low confidence. Each tail_risk has trigger, why_unlikely, consequences, drift_toward boolean.

4. **"checks probability sum and warns when not ~100%"** — Expect: probability_check.sum is a number, probability_check.warning is null when sum ≈ 100%, non-null when off.

5. **"produces add_scenario, add_tail_risk, add_central_thesis proposals"** — Expect proposals array contains commands with these kinds.

6. **"labels forecast_basis as equilibrium, discretionary, or mixed"** — Expect at least one scenario has forecast_basis set.

Build test context using `createPhase7CanonicalStore()` + Phase 6/7/8 results from running the prior phase runners in test setup.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pipeline/phase-9-scenarios.test.ts`

### Task 3.2: Implement Phase 9 runner

**Files:**
- Create: `src/pipeline/phase-9-scenarios.ts`

- [ ] **Step 1: Implement the runner**

```typescript
export function runPhase9Scenarios(context: Phase9RunnerContext): ScenarioGenerationResult
```

**Heuristic logic:**

1. Read Phase 6 result for formalizations, equilibria, cross-game effects.
2. Read Phase 7 result for assumptions with sensitivity and clusters.
3. Read Phase 8 result for eliminated outcomes (to constrain scenario space).
4. **Scenario generation**: For each game with a formalization that has equilibria:
   - Build a scenario around the equilibrium path.
   - Scenario name derived from game name + equilibrium description.
   - Narrative: summary from game description, causal chain from phase progression, full text assembled.
   - Probability: create a `ForecastEstimate` using the equilibrium's confidence. Use `mode: 'point'`.
   - Key assumptions: link to Phase 7 assumptions that the formalization depends on.
   - Invalidation conditions: derive from critical assumptions' what_if_wrong.
   - Model basis: EntityRef to the game and formalization.
   - Cross-game interactions: from Phase 6i results if available.
   - Forecast basis: 'equilibrium' if based on solver output, 'discretionary' if based on heuristic, 'mixed' if both.
5. **Central thesis**: Synthesize from the highest-probability scenario. Statement is the prediction, falsification_condition from the scenario's invalidation_conditions.
6. **Tail risks**: For each critical assumption with confidence < 0.5, create a tail risk. Drift_toward = true if any contradicted_by evidence exists.
7. **Probability check**: Sum all scenario probabilities. Warn if not within 90-110% range.
8. Build proposals: `add_scenario`, `add_tail_risk`, `add_central_thesis` commands.

**Mapping ProposedScenarioFull → canonical Scenario command payload:**

The canonical `Scenario` schema has different field shapes than the proposed type. When building `add_scenario` commands:
- `key_assumptions`: canonical expects `string[]` (just IDs). Extract `assumption_ref.id` from each `ScenarioAssumptionRef`. The sensitivity metadata is only in the phase result, not persisted to canonical — this is intentional (sensitivity is a Phase 7 computation, not a scenario property).
- `invalidators`: maps from `invalidation_conditions` (string[]).
- `estimated_probability`: maps directly from `probability` (both are ForecastEstimate).
- `narrative`: canonical expects a single string. Use `narrative.full_text`.
- `formalization_id`: pick the primary formalization from `model_basis` refs.
- `path`: derive from `narrative.causal_chain` event names.

**Mapping ProposedCentralThesis → canonical CentralThesis command payload:**
- `scenario_refs`: canonical expects `EntityRef[]`, but during proposal the scenarios don't have canonical IDs yet (they're temp_ids). Use `asEntityRef('scenario', temp_id)` to create provisional refs. When the user accepts proposals, the command spine will resolve the IDs.

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/pipeline/phase-9-scenarios.test.ts`
Expected: All pass.

- [ ] **Step 3: Commit**

```
feat: implement Phase 9 scenario generation runner

Builds scenarios from equilibrium paths, generates falsifiable central
thesis, identifies tail risks from critical assumptions, and validates
probability consistency.
```

---

## Chunk 4: Phase 10 meta-check runner

Phase 10 answers 10 meta-check questions, 6 final test questions, runs adversarial challenge, and determines if analysis is complete.

### Task 4.1: Write Phase 10 tests

**Files:**
- Create: `src/pipeline/phase-10-metacheck.test.ts`

- [ ] **Step 1: Write Phase 10 test file**

Test cases:

1. **"answers all 10 meta-check questions with concern levels"** — Expect: meta_check_answers.length === 10, each has question_number (1-10), question, answer, concern_level.

2. **"answers all 6 final test questions with completeness"** — Expect: final_test_answers.length === 6, each has question_number (1-6), question, answer, completeness.

3. **"marks analysis_complete false when any final test answer is cannot_answer"** — Set up context where a question can't be answered (e.g., no games → Q1 can't identify smallest game). Expect: analysis_complete === false.

4. **"runs adversarial challenge with severity ratings"** — Expect: adversarial_result.challenges.length > 0, each has category from ChallengeCategory union, severity, challenge text. overall_assessment is one of 'robust' | 'defensible' | 'vulnerable' | 'flawed'.

5. **"triggers revalidation when meta-check finds significant concerns"** — Expect: if any meta_check_answer has concern_level 'significant' or 'critical', revisions_triggered is non-empty.

6. **"marks analysis_complete true when all tests pass"** — Full canonical store with all phases complete. Expect: analysis_complete === true.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pipeline/phase-10-metacheck.test.ts`

### Task 4.2: Implement Phase 10 runner

**Files:**
- Create: `src/pipeline/phase-10-metacheck.ts`

- [ ] **Step 1: Implement the runner**

```typescript
export function runPhase10MetaCheck(context: Phase10RunnerContext): MetaCheckResult
```

**Structure:**

The runner has three main sections:

**A. Meta-check (10 questions):**

```typescript
const META_CHECK_QUESTIONS: string[] = [
  'Which player have I spent the least time analyzing?',
  'Which game am I most confident about?',
  'What is the strongest counterargument to my central thesis?',
  'What information would most change my predictions?',
  'Which claim is most dependent on discretionary judgment rather than formal structure?',
  'Have I treated a public statement as more informative than it deserves?',
  'Have I treated a stated red line as lexicographic without evidence?',
  'Did I add complexity because the event is complex, or because I was reluctant to simplify?',
  'Could a smaller model explain 80% of the behavior just as well?',
  'Which adjacent analytical tool did I use, and did I label it correctly?',
]
```

For each question, analyze the canonical model:
- Q1: Find player with fewest references across games/formalizations.
- Q2: Find game/formalization with highest average confidence estimate.
- Q3: Look at central thesis from Phase 9, find contradicting assumptions.
- Q4: Find critical assumptions with inference-only evidence.
- Q5: Count assumptions labeled 'discretionary' in forecast_basis.
- Q6: Check for signals classified as 'cheap_talk' with high informativeness.
- Q7: Check for assumptions about red lines without direct evidence.
- Q8: Compare model complexity (game count, formalization count) to player count.
- Q9: Check if removing lowest-confidence game changes scenario structure.
- Q10: Check Phase 6h behavioral overlays for correct labeling.

Set concern_level based on findings: 'none' if check passes, 'minor'/'significant'/'critical' based on severity.

**B. Final test (6 questions):**

```typescript
const FINAL_TEST_QUESTIONS: string[] = [
  'What is the smallest game that captures the core strategic tension?',
  'What did the repeated interaction history do to today\'s incentives and beliefs?',
  'Which strategies are actually feasible once institutional, domestic, and escalation constraints are added?',
  'What equilibrium or near-equilibrium behavior follows from that structure?',
  'Which parts of the final forecast come from the model, and which come from analyst judgment?',
  'What specific evidence would change the central prediction?',
]
```

For each: derive answer from canonical model. Set completeness based on whether the model has enough data to answer (e.g., Q2 needs Phase 4 history; Q4 needs Phase 6 equilibria).

**C. Adversarial challenge:**

Generate challenges from model gaps:
- `framing_choice`: If only 1 game type used, challenge the framing.
- `omitted_actor`: If <3 players, challenge for missing actors.
- `overconfident_payoff`: If any payoff estimate has confidence >0.9.
- `naive_independence`: If assumptions in same cluster treated independently in scenarios.
- `evidence_quality`: If critical assumptions have only 'inference' quality.
- Severity based on how much the challenge affects conclusions.
- overall_assessment: 'robust' if 0 critical/high, 'defensible' if ≤2, 'vulnerable' if ≤5, 'flawed' if >5.

**D. Completeness determination:**
- `analysis_complete = false` if any FinalTestAnswer.completeness === 'cannot_answer'
- `analysis_complete = false` if any MetaCheckAnswer.concern_level === 'critical' with revision_triggered
- Otherwise `analysis_complete = true`

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/pipeline/phase-10-metacheck.test.ts`
Expected: All pass.

- [ ] **Step 3: Commit**

```
feat: implement Phase 10 meta-check runner

Answers 10 meta-check questions, 6 final test questions, runs
adversarial challenge with 11 challenge categories, and determines
analysis completeness per playbook methodology.
```

---

## Chunk 5: Orchestrator, MCP tools, and revalidation integration

Wire phases 8-10 into the orchestrator, replace MCP tool stubs, and add revalidation trigger checks.

### Task 5.1: Add orchestrator cases for phases 8-10

**Files:**
- Modify: `src/pipeline/orchestrator.ts`

- [ ] **Step 1: Read the orchestrator**

Read `src/pipeline/orchestrator.ts` in full. Find the `runPhase` method and the else branch at line ~707.

- [ ] **Step 2: Add imports for new phase runners**

Add imports at the top:
```typescript
import { runPhase8Elimination } from './phase-8-elimination'
import { runPhase9Scenarios } from './phase-9-scenarios'
import { runPhase10MetaCheck } from './phase-10-metacheck'
```

Also import the result types:
```typescript
import type {
  EliminationResult,
  ScenarioGenerationResult,
  MetaCheckResult,
} from '../types/analysis-pipeline'
```

- [ ] **Step 3: Add phase 8 case**

Before the else branch, add:
```typescript
} else if (phase === 8) {
  const output = runPhase8Elimination({
    canonical,
    baseRevision,
    phaseExecution,
    phaseResults: getPipelineState().phase_results,
  })
  phaseOutput = output
  result = output.status
  proposals = output.proposals
  setPhaseResult(8, output)
}
```

- [ ] **Step 4: Add phase 9 case**

```typescript
} else if (phase === 9) {
  const output = runPhase9Scenarios({
    canonical,
    baseRevision,
    phaseExecution,
    phaseResults: getPipelineState().phase_results,
  })
  phaseOutput = output
  result = output.status
  proposals = output.proposals
  setPhaseResult(9, output)
}
```

- [ ] **Step 5: Add phase 10 case**

```typescript
} else if (phase === 10) {
  const output = runPhase10MetaCheck({
    canonical,
    baseRevision,
    phaseExecution,
    phaseResults: getPipelineState().phase_results,
  })
  phaseOutput = output
  result = output.status
  proposals = output.proposals
  setPhaseResult(10, output)
}
```

- [ ] **Step 6: Add Phase 9/10 conversation messages**

After the existing Phase 7 message block (line ~744-760), add blocks for phases 8, 9, and 10 that register proposal groups and emit conversation messages. Follow the Phase 7 pattern:

```typescript
} else if (phase === 8 && phaseOutput) {
  const phase8Output = phaseOutput as EliminationResult
  if (phase8Output.proposals.length > 0) {
    registerProposalGroup({
      phase,
      content: `Phase 8 complete. ${phase8Output.eliminated_outcomes.length} outcome(s) eliminated. Review ${phase8Output.proposals.length} proposal(s).`,
      proposals: phase8Output.proposals,
    })
    setPipelineProposalReview(getConversationState().proposal_review)
  } else {
    deps.emitConversationMessage({
      role: 'ai',
      content: `Phase 8 complete. No outcomes eliminated in this pass.`,
      message_type: 'result',
      phase,
    })
  }
} else if (phase === 9 && phaseOutput) {
  const phase9Output = phaseOutput as ScenarioGenerationResult
  if (phase9Output.proposals.length > 0) {
    registerProposalGroup({
      phase,
      content: `Phase 9 complete. Central thesis: "${phase9Output.central_thesis.statement}". ${phase9Output.proposed_scenarios.length} scenario(s), ${phase9Output.tail_risks.length} tail risk(s). Review ${phase9Output.proposals.length} proposal(s).`,
      proposals: phase9Output.proposals,
    })
    setPipelineProposalReview(getConversationState().proposal_review)
  } else {
    deps.emitConversationMessage({
      role: 'ai',
      content: `Phase 9 complete with no proposals.`,
      message_type: 'result',
      phase,
    })
  }
} else if (phase === 10 && phaseOutput) {
  const phase10Output = phaseOutput as MetaCheckResult
  deps.emitConversationMessage({
    role: 'ai',
    content: phase10Output.analysis_complete
      ? `Phase 10 complete. Analysis is complete. ${phase10Output.adversarial_result.overall_assessment} overall.`
      : `Phase 10 complete. Analysis is NOT yet complete — review final test gaps.`,
    message_type: 'result',
    phase,
  })
}
```

- [ ] **Step 7: Extend revalidation trigger range**

The `maybeCreateRevalidationEvent` call at line ~790 currently runs for `phase >= 2 && phase <= 7`. Extend to `phase <= 10`:

```typescript
if (phaseOutput && phase >= 2 && phase <= 10 && result.status !== 'failed') {
```

- [ ] **Step 8: Verify compilation**

Run: `npx tsc --noEmit`

### Task 5.2: Add revalidation trigger checks for phases 8-10

**Files:**
- Modify: `src/pipeline/revalidation-engine.ts`
- Modify: `src/pipeline/revalidation-engine.test.ts`

- [ ] **Step 1: Add Phase 10 trigger check**

Phase 10 meta-check can trigger revalidation when significant concerns are found. Add a `getPhase10Check` function:

```typescript
function getPhase10Check(result: MetaCheckResult): RevalidationCheck {
  const significantConcerns = result.meta_check_answers.filter(
    (answer) => answer.concern_level === 'significant' || answer.concern_level === 'critical',
  )
  if (significantConcerns.length === 0) {
    return createCheck([], [], [], 'none', 'Phase 10 meta-check found no significant concerns.')
  }

  const triggers = significantConcerns
    .map((answer) => answer.revision_triggered)
    .filter((trigger): trigger is RevalidationTrigger => trigger != null)

  if (triggers.length === 0) {
    return createCheck([], [], [], 'monitor', `Phase 10 meta-check flagged ${significantConcerns.length} concern(s) without specific revision triggers.`)
  }

  return createCheck(
    triggers,
    triggers.flatMap((t) => PHASE10_TRIGGER_TARGETS[t] ?? []),
    [],
    'revalidate',
    `Phase 10 meta-check triggered revalidation: ${significantConcerns.map((c) => `Q${c.question_number}`).join(', ')}.`,
  )
}
```

Add a trigger target mapping:
```typescript
const PHASE10_TRIGGER_TARGETS: Record<string, number[]> = {
  model_cannot_explain_fact: [3],
  objective_function_changed: [2, 3],
  new_game_identified: [3, 4],
  critical_empirical_assumption_invalidated: [7, 8, 9],
}
```

Wire into `checkTriggers`:
```typescript
if (phase === 10) {
  return getPhase10Check(phaseResult as MetaCheckResult)
}
```

Phases 8 and 9 don't typically trigger revalidation themselves (their outputs flow to Phase 10), so return the default 'none' check for them.

- [ ] **Step 2: Add test for Phase 10 revalidation**

```typescript
it('triggers revalidation from phase 10 when meta-check finds critical concerns', () => {
  const engine = createEngine()
  const result: MetaCheckResult = {
    phase: 10,
    status: { status: 'complete', phase: 10, execution_id: 'exec_10', retriable: true },
    meta_check_answers: [
      {
        question_number: 3,
        question: 'Strongest counterargument?',
        answer: 'The baseline model misses a key player.',
        concern_level: 'critical',
        revision_triggered: 'model_cannot_explain_fact',
        evidence_refs: [],
      },
      // ... 9 more with concern_level: 'none'
    ],
    final_test_answers: [],
    adversarial_result: { challenges: [], overall_assessment: 'defensible' },
    revisions_triggered: ['model_cannot_explain_fact'],
    analysis_complete: false,
  }

  const check = engine.checkTriggers(result, 10)
  expect(check.triggers_found).toContain('model_cannot_explain_fact')
  expect(check.recommendation).toBe('revalidate')
  expect(check.affected_phases).toContain(3)
})
```

- [ ] **Step 3: Run revalidation tests**

Run: `npx vitest run src/pipeline/revalidation-engine.test.ts`

### Task 5.3: Replace MCP tool stubs

**Files:**
- Modify: `src/mcp/tools/phases.ts`

- [ ] **Step 1: Read the MCP tools file**

Read `src/mcp/tools/phases.ts` in full.

- [ ] **Step 2: Add phase definitions for 8, 9, 10**

Add to the `phaseDefinitions` object (near line 14-58):
```typescript
8: {
  name: 'run_phase_8_elimination',
  phase_name: 'Elimination',
  description: 'Phase 8: Eliminate implausible outcomes with specific phase citations.',
  schema: z.object({}).strict(),
},
9: {
  name: 'run_phase_9_scenarios',
  phase_name: 'Scenario Generation',
  description: 'Phase 9: Generate scenarios, central thesis, and tail risks.',
  schema: z.object({}).strict(),
},
10: {
  name: 'run_phase_10_metacheck',
  phase_name: 'Meta-check',
  description: 'Phase 10: Run 10 meta-check questions, 6 final test questions, and adversarial challenge.',
  schema: z.object({}).strict(),
},
```

- [ ] **Step 3: Register real tools (replacing stubs)**

Remove the stub loop (lines 348-363). Add real tool registrations following the Phase 7 pattern:

```typescript
// Phase 8
server.registerTool({
  name: phaseDefinitions[8].name,
  description: phaseDefinitions[8].description,
  inputSchema: phaseDefinitions[8].schema,
  async execute(): Promise<PhaseToolResult> {
    try {
      await context.orchestrator.runPhase(8)
      const phaseResult = getPipelineState().phase_results[8] as EliminationResult | undefined
      if (!phaseResult) {
        return failureResult(8, phaseDefinitions[8].phase_name, 'Phase 8 produced no result.')
      }
      return successResult(8, phaseDefinitions[8].phase_name, phaseResult.proposals, {
        eliminated_count: phaseResult.eliminated_outcomes.length,
      })
    } catch (error) {
      return failureResult(8, phaseDefinitions[8].phase_name, error instanceof Error ? error.message : 'Phase 8 failed.')
    }
  },
})
```

Follow the same pattern for phases 9 and 10, adjusting the summary data in `successResult`.

- [ ] **Step 4: Import new result types**

Add `EliminationResult`, `ScenarioGenerationResult`, `MetaCheckResult` to the imports from `../../types/analysis-pipeline`.

### Task 5.4: Update orchestrator tests

**Files:**
- Modify: `src/pipeline/orchestrator.test.ts`

- [ ] **Step 1: Add basic phase 8-10 execution tests**

Add tests that verify phases 8-10 can be run through the orchestrator:

1. **"runs phase 8 after phase 7 completes"** — Set up analysis state with phases 1-7 complete, run phase 8. Expect: no error, phase_results[8] exists.

2. **"runs phase 9 after phase 8 completes"** — Same pattern.

3. **"runs phase 10 after phase 9 completes"** — Same pattern. Check analysis_complete field.

### Task 5.5: Update MCP server tests

**Files:**
- Modify: `src/mcp/server.test.ts`

- [ ] **Step 1: Verify stub removal**

Check that the tests don't rely on the stub behavior. If there are tests expecting "not implemented" errors for phases 8-10, update them to expect success.

- [ ] **Step 2: Run all tests**

```bash
npx vitest run src/pipeline/phase-8-elimination.test.ts
npx vitest run src/pipeline/phase-9-scenarios.test.ts
npx vitest run src/pipeline/phase-10-metacheck.test.ts
npx vitest run src/pipeline/orchestrator.test.ts
npx vitest run src/pipeline/revalidation-engine.test.ts
npx vitest run src/mcp/server.test.ts
npx tsc --noEmit
```

All must pass.

- [ ] **Step 3: Commit**

```
feat: wire phases 8-10 into orchestrator, MCP tools, and revalidation

Replaces phase 8-10 stubs with real implementations. Orchestrator
dispatches to new runners, MCP tools return structured results,
Phase 10 meta-check can trigger revalidation.
```

---

## Execution Order

```
Chunk 1 (types)            ── must be first (all other chunks depend on types)
       ↓
Chunk 2 (Phase 8 runner)   ─┐
Chunk 3 (Phase 9 runner)    ├── can run sequentially (Phase 9 reads Phase 8 results in tests)
Chunk 4 (Phase 10 runner)  ─┘
       ↓
Chunk 5 (integration)      ── must be last (wires everything together)
```

Chunks 2-4 are sequential because Phase 9 tests need Phase 8 results and Phase 10 tests need Phase 9 results. However, the runners themselves are independent — a subagent implementing Phase 9 just needs the Phase 8 runner to exist (for test setup), not to review it.
