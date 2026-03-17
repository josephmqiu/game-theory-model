# Phase 9: Scenario Generation

**Purpose:** Generate predictions with full traceability.

### 9a: Build scenarios

Each scenario needs:

- **Narrative** — what happens, in what phases, with what causal logic
- **Probability** — point estimate with confidence range (e.g., "40-45%")
- **Key assumptions** — which Phase 7 assumptions does this scenario depend on?
- **Invalidation conditions** — what specific evidence would kill this scenario?
- **Model basis** — which game or linked games drive it?
- **Cross-game interactions** — which cross-game effects are essential to the scenario's logic?

Scenarios should sum to approximately 100%. If they don't, there is either a missing scenario or miscalibrated probabilities.

### 9b: Separate baseline forecast from tail risks

Low-probability, high-consequence events get separate treatment. Do not bury them inside the main scenarios because their probability is low, but do not ignore them because their consequences are catastrophic.

For each tail risk:

- Probability estimate
- What would trigger it
- Why it's unlikely (what prevents it)
- What the consequences would be
- Whether any current trajectory is drifting toward it

### 9c: State the central thesis as a falsifiable claim

The analysis should produce a central thesis — a single statement that captures the core analytical finding. This thesis should be falsifiable: it should be possible to state what evidence would disprove it.

Example: "The US won every battle and may lose the war, because the strategy of winning individual games destroyed the cooperative infrastructure that underpinned American hegemony."

This is testable against future events: if the US achieves its stated objectives without the predicted structural costs, the thesis is wrong.

### 9d: Distinguish equilibrium prediction from discretionary forecast

This distinction matters and must be explicit.

- **Equilibrium prediction** — what the formal model implies under stated assumptions. "Given this game structure and these payoffs, the Nash equilibrium is X." This is model-driven.
- **Discretionary forecast** — where the analyst is making a judgment because the model is underdetermined, the evidence is incomplete, or the human system is too noisy for formal prediction. "I believe Y is more likely based on pattern-matching and intuition." This is judgment-driven.

Do not blur the two. The user of the analysis should know which parts come from the model and which parts come from analyst judgment. When the prediction fails, this distinction tells you whether to fix the model or recalibrate the judgment.

**Tools to use:** `add_scenario`, `add_tail_risk`, `add_central_thesis`.
