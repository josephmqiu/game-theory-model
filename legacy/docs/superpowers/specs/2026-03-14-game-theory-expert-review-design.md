# Game Theory Expert Review — Design Changes

**Date:** 2026-03-14
**Source:** Expert review of the full infrastructure spec by a game theory domain specialist
**Approach:** Fix correctness issues now, design data models for new concepts now, defer solver implementations to M9/M10 with contracts-in-code (stub files, `DEFERRED:` tags, skipped tests, `not_ready` readiness gates)

## Guiding principle

Wrong answers are unacceptable. "Not yet solvable" is fine. The readiness gate pattern enforces this: unimplemented solvers return `not_ready` with a specific reason. Heuristic approximations that silently pretend to be correct solutions are forbidden.

Deferred work lives in code, not in spec documents:
- Solver stubs with `DEFERRED:M9` comment blocks
- Skipped tests with the same tag
- Readiness gates that return `not_ready`
- All greppable with `grep DEFERRED:`

CLAUDE.md gets one principle: "Unimplemented solvers must return `not_ready`. Never substitute heuristic approximations."

---

## Tier 1 — Solver Correctness Fixes

Six changes to make the existing computation layer honest about what it computes.

### 1.1 Backward induction — honest naming + belief specification

**Problem:** The spec averages payoffs across information set nodes, implicitly assuming uniform beliefs. This is wrong for signaling games where beliefs should update based on observed actions. Calling this "backward induction" implies subgame-perfect equilibrium, which it is not for imperfect-information games.

**Fix:**
- Rename solver output method to `backward_induction_uniform_belief`
- Add optional `beliefs` to `InformationSet`. Beliefs are mathematical probability weights (not strategic estimates), so they use plain numbers with a sum-to-1 invariant and a single rationale at the information-set level:

```typescript
interface InformationSet {
  id: string;
  player_id: string;
  node_ids: string[];
  beliefs?: Record<string, number>;  // node_id → probability weight, must sum to 1.0
  belief_rationale?: string;         // why these beliefs (documented once, not per-weight)
}
```

Post-validation invariant: when `beliefs` is provided, values must sum to 1.0 ± 0.001 and all keys must be members of `node_ids`.

- When `beliefs` is provided, use those weights instead of uniform averaging
- When `beliefs` is absent, default to uniform and flag in output: "Assumes uniform beliefs at information sets — not equivalent to sequential equilibrium"
- DEFERRED:M9 — sequential equilibrium solver with belief-consistency checks

### 1.2 Ordinal payoffs — hard block on mixed-strategy Nash

**Problem:** The spec warns that mixed-strategy equilibrium depends on cardinalization of ordinal preferences. A warning is not strong enough — computing mixing probabilities on ordinal payoffs produces meaningless numbers.

**Fix:**
- If any payoff in the formalization uses `representation: 'ordinal_rank'`, the mixed-strategy Nash solver returns `{ status: 'not_ready', reason: 'Mixed-strategy Nash requires cardinal (von Neumann-Morgenstern) payoffs. Ordinal rankings cannot determine mixing probabilities.' }`
- Pure-strategy Nash and dominance analysis remain available on ordinal payoffs (only need rank-order comparison)

### 1.3 Nash n>2 — document limitation and degradation path

**Problem:** Support enumeration doesn't scale beyond 2 players. The app's target use cases (geopolitical crises, multi-party negotiations) routinely involve 3+ players. Nash computation for n>2 is PPAD-complete.

**Fix:**
- 2-player: support enumeration (exact) — unchanged
- n>2: readiness gate returns `not_ready` with actionable suggestions:
  - "Consider dominance elimination to reduce strategy space"
  - "Consider pairwise 2-player subgame analysis"
  - "Use play-out engine for interactive exploration"
- DEFERRED:M9 — Lemke-Howson for bimatrix, iterated best-response or polymatrix approximation for n-player (with honest "approximate" labeling)

### 1.4 Repeated game equilibrium selection

**Problem:** The folk theorem tells us that in repeated games with sufficiently patient players, almost any feasible individually rational payoff vector can be sustained as an equilibrium. "Finding the equilibrium" is meaningless without specifying which equilibrium-selection criterion to use.

**Fix:** Add to `RepeatedGameModel`:

```typescript
equilibrium_selection?: {
  criterion: 'grim_trigger' | 'tit_for_tat' | 'pavlov'
    | 'renegotiation_proof' | 'custom';
  custom_description?: string;
}
```

- Readiness gate requires `equilibrium_selection` for repeated game solving
- DEFERRED:M9 — repeated game solver with discount factor threshold analysis

### 1.5 Coalition solution concepts

**Problem:** `CoalitionModel` has `agenda_setters` and `coalition_options` but no solution concept. Without at least one (core, Shapley value, nucleolus), the coalition formalization is a data structure without a theory.

**Fix:** Add to `CoalitionModel`:

```typescript
solution_concept?: {
  kind: 'core' | 'shapley_value' | 'nucleolus'
    | 'nash_bargaining' | 'kalai_smorodinsky' | 'custom';
  characteristic_function?: Record<string, EstimateValue>; // key = sorted comma-joined player IDs (e.g., "p1,p2,p3") → coalition value
  threat_points?: Record<string, EstimateValue>;           // player_id → outside option
  custom_description?: string;
}
```

- Readiness gate requires `solution_concept` and `characteristic_function`
- DEFERRED:M9 — coalition solver

### 1.6 Honest solver output metadata

**Problem:** Solver outputs don't communicate their limitations. A result labeled "Nash equilibrium" with no caveats is misleading when it was computed with a uniform-belief heuristic on a 2-player restriction.

**Fix:** Add `meta` field to the existing `SolverResult` type (session 4.2):

```typescript
interface SolverResultMeta {
  method_id: string;           // e.g., 'backward_induction_uniform_belief'
  method_label: string;        // e.g., 'Backward Induction (Uniform-Belief Heuristic)'
  limitations: string[];       // Structural limitations of the method (e.g., "Not equivalent to sequential equilibrium")
  assumptions_used: string[];  // Implicit assumptions the method makes (e.g., "Uniform beliefs at information sets")
}
```

**Integration with existing `SolverResult`:** `SolverResultMeta` is embedded as `meta: SolverResultMeta` on `SolverResult`. The existing `solver: SolverKind` field remains as the coarse discriminant; `meta.method_id` provides fine-grained algorithm identification. The existing `warnings: string[]` field on `SolverResult` is for runtime warnings (e.g., "interval estimate used midpoint"). `meta.limitations` is for structural limitations of the method itself. These are distinct: warnings vary per invocation, limitations are inherent to the algorithm.

**Method ID naming convention:** `{solver_kind}_{variant}` with underscore separators. Examples: `nash_support_enumeration`, `backward_induction_uniform_belief`, `dominance_iterated_strict`.

The UI renders limitations alongside results — never a clean "the answer is X" without caveats.

---

## Tier 2 — New Concepts

Organized under the three-category taxonomy: new formalization kinds, formalization extensions, and analysis functions.

### 2A. New Formalization Kinds

Two new entries in `Formalization.kind`: `'bargaining'` and `'evolutionary'`.

#### Bargaining

Captures the inputs for Rubinstein (alternating offers + discount factors + outside options) and Nash Bargaining Solution (surplus + outside options + symmetry). Handles real-world cases: trade negotiations with time pressure, plea bargaining with trial deadlines, labor disputes with strike costs.

```typescript
interface BargainingFormalization extends BaseFormalization {
  kind: 'bargaining';
  protocol: 'alternating_offers' | 'nash_demand' | 'ultimatum' | 'custom';
  parties: string[];                                    // Player IDs — subset of game.players
  outside_options: Record<string, EstimateValue>;       // player → disagreement payoff
  discount_factors: Record<string, EstimateValue>;      // player → patience
  surplus: EstimateValue;                               // total value to divide
  deadline?: {
    rounds?: EstimateValue;
    pressure_model?: 'fixed_cost' | 'shrinking_pie' | 'risk_of_breakdown';
    breakdown_probability?: EstimateValue;
  };
  first_mover?: string;                                 // player_id (alternating offers)
  commitment_power?: Record<string, EstimateValue>;     // who can credibly commit
}
```

**REFERENCE_SCHEMA entries** (following `agenda_setters` pattern on `CoalitionModel`):
```typescript
// Added to formalization REFERENCE_SCHEMA:
{ field: 'parties', target: 'player', cardinality: 'many', required: true, on_delete: 'remove_ref_or_stale_if_empty' }
{ field: 'first_mover', target: 'player', cardinality: 'one', required: false, on_delete: 'remove_ref' }
// Bargaining: outside_options, discount_factors, commitment_power, surplus are plain EstimateValue
// Their nested refs follow the wildcard pattern: e.g., 'outside_options.*.source_claims',
// 'commitment_power.*.source_claims', 'surplus.source_claims'
// Note: bargaining discount_factors uses plain EstimateValue (NOT DiscountModel).
// Repeated game discount_factors uses DiscountModel, so paths differ:
// bargaining: 'discount_factors.*.source_claims' / repeated: 'discount_factors.*.delta.source_claims'
```

**Post-validation invariant:** `parties` must be a subset of the linked game's `players` list.

DEFERRED:M9 — Rubinstein solver, Nash Bargaining Solution computation.

#### Evolutionary

For situations with anonymous populations and bounded rationality (market dynamics, social norms, technology adoption). Uses strategy types in a population, not named individual players.

Key design decision: **no `Population` entity type.** The evolutionary formalization is self-contained — like how `CoalitionModel` carries its own `coalition_options`. The `Player` entity remains for named strategic actors only.

```typescript
interface EvolutionaryFormalization extends BaseFormalization {
  kind: 'evolutionary';
  strategy_types: ReadonlyArray<{
    id: string;
    label: string;                                      // e.g., "Hawk", "Dove"
    description?: string;
  }>;
  fitness_matrix: Record<string, Record<string, EstimateValue>>;  // row × col → fitness
  initial_distribution: Record<string, number>;         // strategy_type_id → proportion, must sum to 1.0
  dynamics: 'replicator' | 'best_response' | 'imitation' | 'custom';
  population_size: { kind: 'infinite' } | { kind: 'finite'; size: EstimateValue };
  mutation_rate?: EstimateValue;
}
```

**Player relationship:** Evolutionary games use the parent `StrategicGame.players` list as empty or with a single pseudo-player representing "the population." The readiness gate for evolutionary formalizations exempts the "at least 2 defined players" check that applies to other formalization kinds. Cross-game links targeting an evolutionary game use strategy types, not player IDs — the `target_player_id` field is not applicable and must be absent.

**Post-validation invariants:**
- `initial_distribution` values must sum to 1.0 ± 0.001
- `initial_distribution` keys must match `strategy_types[*].id`
- `fitness_matrix` must be complete: both dimensions must match `strategy_types[*].id` exactly

DEFERRED:M9 — replicator dynamics solver, ESS (evolutionarily stable strategy) finder.

### 2B. Formalization Extensions

#### Time-inconsistency — extended discount model

Political actors facing election cycles often have time-inconsistent preferences. Standard exponential discounting (single rate) can't model "discount the near future heavily, far future less so."

Change `RepeatedGameModel.discount_factors` from `Record<string, EstimateValue>` to `Record<string, DiscountModel>`:

```typescript
interface DiscountModel {
  type: 'exponential' | 'quasi_hyperbolic';
  delta: EstimateValue;        // long-run discount factor
  beta?: EstimateValue;        // present-bias parameter (quasi_hyperbolic only, β < 1 = present-biased)
}
```

Standard exponential: `{ type: 'exponential', delta: ... }`.
Quasi-hyperbolic (β-δ): `{ type: 'quasi_hyperbolic', delta: ..., beta: ... }`.

**Migration:** This is a structural type change. Schema migration (session 1.3) converts existing `EstimateValue` entries to `{ type: 'exponential', delta: <existing_value> }`. Schema version increments accordingly.

**REFERENCE_SCHEMA impact:** Nested `EstimateValue` ref paths change from `discount_factors.*.source_claims` to `discount_factors.*.delta.source_claims` (and optionally `discount_factors.*.beta.source_claims`). The formalization REFERENCE_SCHEMA entries must reflect this.

Note: equilibrium selection on repeated games and solution concepts on coalition games are covered in Tier 1 (items 1.4 and 1.5). Belief specification on information sets is covered in Tier 1 (item 1.1).

### 2C. Analysis Functions

Four new solver types. These are computational tools applied to existing models, not new formalization kinds. They follow the standard architecture: readiness gate → compute → result with `SolverResultMeta`.

#### Correlated equilibrium solver

- **Input:** a normal-form formalization
- **Output:** probability distribution over strategy profiles that no player wants to deviate from given the mediator's recommendation
- **Computation:** linear program (computationally easier than Nash)
- **Includes:** comparison to Nash — is the correlated equilibrium a Pareto improvement?
- DEFERRED:M9

#### Credible commitment analyzer

- **Input:** a game + a player + a claimed commitment (threat, promise, or positional move)
- **Output:** `cost_of_reneging` vs `benefit_of_reneging`, `credible: boolean`, breakdown of strengthening/weakening factors (audience costs, reputation, sunk costs)
- **Connects to:** existing `audience_costs` on `Player` and assumption tracking
- DEFERRED:M9

#### Game archetype classifier ("what game is this?")

- **Input:** a normal-form formalization with payoffs
- **Output:** ranked list of matching archetypes (`SemanticGameLabel`) with confidence and structural explanation (e.g., "payoff structure matches Prisoner's Dilemma: mutual cooperation Pareto-dominates mutual defection, but defection is individually rational")
- **Also reports:** dominant strategies, Pareto-optimal outcomes, Nash equilibria count
- **Distinct from semantic labeling:** this is computational classification based on the actual payoff matrix, not an interpretive judgment
- DEFERRED:M9

#### Mechanism design evaluator

- **Input:** a designer player, participant players, an objective, and candidate mechanism formalizations (each a different game structure the designer could choose)
- **Output:** per-mechanism evaluation of incentive compatibility, individual rationality, and efficiency
- **Note:** most speculative of the four — evaluates game structures rather than solving within a fixed structure
- DEFERRED:M10 (depends on other solvers being available first)

---

## Tier 3 — Invariant Fixes

Three new post-validation rules added to the integrity layer.

### 3.1 Chance node probabilities must sum to 1

All outgoing edges from a chance node (`actor.kind === 'nature'`) must have `chance_estimate` values that sum to 1.0 (within tolerance ± 0.001).

```typescript
{
  id: 'chance_probability_sum',
  scope: 'game_node',
  check: 'outgoing edges from nature nodes: sum of chance_estimate values ≈ 1.0',
  severity: 'error'
}
```

### 3.2 Information set action-count consistency

All nodes in the same information set must have the same number of outgoing edges. Otherwise the player could distinguish nodes by counting options, contradicting the information set definition.

```typescript
{
  id: 'information_set_action_consistency',
  scope: 'information_set',
  check: 'all nodes in set must have equal outgoing edge count',
  severity: 'error'
}
```

### 3.3 Independent probability warning escalation

When `probability_model` is `'independent'`, the UI shows a persistent, prominent warning — not a dismissible tooltip.

```typescript
{
  id: 'independent_probability_warning',
  scope: 'scenario',
  check: 'probability_model is independent',
  severity: 'warning',
  message: 'Independent probability multiplication typically overestimates joint probabilities for real-world events. Consider dependency-aware mode.'
}
```

Remains a warning (not error) since independent mode is sometimes legitimate for quick exploration — but persistent and prominent.

---

## Impact on existing spec and sessions

### Assumes session 1.1 definitions over infrastructure spec where they diverge

Where session specs have already corrected the infrastructure spec (e.g., `readiness_cache?: SolverReadiness` in session 1.1 replacing `readiness: SolverReadiness` in the infrastructure spec), this document follows the session spec. All new formalization types extend `BaseFormalization` and inherit `readiness_cache?` — an optional L3 field excluded from serialization, recomputed by session 4.1.

### `SolverKind` union extension (M1)

Add new members to `SolverKind` for deferred solvers:

```typescript
type SolverKind =
  // Existing:
  | 'nash' | 'backward_induction' | 'expected_utility'
  | 'dominance' | 'bayesian_update' | 'cascade' | 'simulation'
  // New (DEFERRED):
  | 'bargaining' | 'evolutionary' | 'correlated_equilibrium'
  | 'credible_commitment' | 'game_classifier' | 'mechanism_design';
```

This is additive (not breaking). Required so that `SolverReadiness.supported_solvers` and `ReadinessReport.per_solver` can reference the deferred solvers.

### `SemanticGameLabel` extension (M1)

Add new semantic labels to match new formalization capabilities:

```typescript
// New additions:
| 'bargaining'           // (distinct from 'coercive_bargaining' — general bargaining)
| 'evolutionary'
```

Note: semantic labels are interpretive judgments about strategic logic. Not every formalization kind needs a corresponding semantic label, but bargaining and evolutionary are common enough to warrant direct labels.

### Type changes to `canonical.ts` (M1 — session 1.1)

| Entity/Type | Change | Session affected |
|---|---|---|
| `Formalization.kind` | Add `'bargaining'` and `'evolutionary'` | 1.1 |
| `BargainingFormalization` | New interface | 1.1 |
| `EvolutionaryFormalization` | New interface | 1.1 |
| `InformationSet` | Add optional `beliefs` (plain numbers) + `belief_rationale` | 1.1 |
| `RepeatedGameModel.discount_factors` | `EstimateValue` → `DiscountModel` | 1.1 |
| `RepeatedGameModel` | Add `equilibrium_selection` field | 1.1 |
| `CoalitionModel` | Add `solution_concept` field | 1.1 |
| `SolverResultMeta` | New interface, embedded as `meta` on `SolverResult` | 1.1, 4.x |
| `SolverKind` | Add 6 new members for deferred solvers | 1.1 |
| `DiscountModel` | New interface | 1.1 |

### REFERENCE_SCHEMA additions (M1 — session 1.1)

New entries for `bargaining` formalization (see Bargaining section above for full list):
- `parties` → player, many, required, `remove_ref_or_stale_if_empty`
- `first_mover` → player, one, optional, `remove_ref`
- Nested `EstimateValue` refs on `outside_options`, `discount_factors`, `commitment_power` follow wildcard pattern

For `evolutionary` formalization: no player refs (self-contained). Standard `game_id` and `assumptions` refs inherited from `BaseFormalization`.

Updated field paths for `RepeatedGameModel` where `DiscountModel` wrapping changes paths (e.g., `discount_factors.*.source_claims` → `discount_factors.*.delta.source_claims`).

### Schema migration (M1 — session 1.3)

`DiscountModel` type change requires migration: existing `discount_factors` values converted to `{ type: 'exponential', delta: <existing_EstimateValue> }`. Schema version incremented.

### Readiness gate changes (M4 — sessions 4.1, 4.2, 4.3)

These modify the existing M4 session specs before implementation begins (no code exists yet).

| Solver | Change | Session |
|---|---|---|
| Nash (pure+mixed) | Change player requirement from "at least 2" to "exactly 2" for n>2 hard block | 4.1 |
| Mixed-strategy Nash | Hard block when any payoff is `ordinal_rank` | 4.1, 4.2 |
| Backward induction | Output metadata renamed, limitations listed, beliefs flagged when uniform | 4.3 |
| Repeated game | Requires `equilibrium_selection` (not just generic "no solver") | 4.1 |
| Coalition | Requires `solution_concept` + `characteristic_function` (not just generic "no solver") | 4.1 |
| Evolutionary | Exempt from "at least 2 players" check | 4.1 |
| All deferred solvers | Return `not_ready` with specific reason via `SolverKind` entries | 4.1 |

### Post-validation additions (M2 — session 2.2)

Three new invariant rules added to session 2.2 (`cascade-integrity.md`):
- **Chance probability sum (3.1):** referential integrity check on `game_edge.chance_estimate` — standard entity-level invariant
- **Information set action consistency (3.2):** requires traversal into formalization subtypes — the invariant engine must support subtype-specific validation for formalization-internal structures (note this extends the current invariant pattern)
- **Independent probability warning (3.3):** data-layer invariant returning `severity: 'warning'` — the UI prominence decision (persistent, not dismissible) belongs in M3 view sessions, not in the invariant definition

### New solver stub files (M4)

Created with `DEFERRED:` tags, returning `not_ready`. Using `src/compute/` directory (matching existing session 4.2 convention, not `src/solvers/`):
- `src/compute/bargaining.ts` — DEFERRED:M9
- `src/compute/evolutionary.ts` — DEFERRED:M9
- `src/compute/correlated-equilibrium.ts` — DEFERRED:M9
- `src/compute/credible-commitment.ts` — DEFERRED:M9
- `src/compute/game-classifier.ts` — DEFERRED:M9
- `src/compute/mechanism-design.ts` — DEFERRED:M10

### New milestones

**M9: Advanced Solvers** — implements deferred solver contracts. Depends on M4. Can run in parallel with M5-M8.

**M10: Meta-Analysis** — mechanism design evaluator. Depends on M9.

### File round-trip testing (M1 — session 1.2)

New formalization types must serialize to `.gta.json` and round-trip correctly. Tests added to session 1.2.

---

## What this does NOT change (architecture)

- Three-layer architecture (L1/L2/L3) — unchanged
- Command/event spine — unchanged
- Evidence ladder — unchanged
- EstimateValue — unchanged (still the core value type)
- Cross-game composition engine — unchanged
- Play-out engine — unchanged
- AI pipeline — unchanged
- Semantic labels vs formalizations separation — unchanged (strengthened by game classifier)

**What this DOES modify in existing sessions** (additions and corrections, not structural rewrites):
- Session 1.1: new types, field changes on existing types, SolverKind extension
- Session 1.2: new round-trip tests for new formalization types
- Session 1.3: migration function for DiscountModel
- Session 2.2: three new post-validation invariants
- Session 4.1: modified readiness gate requirements (ordinal block, n>2 block, new solver entries)
- Session 4.2: SolverResult gains `meta` field
- Session 4.3: backward induction output metadata, belief-weighted averaging
