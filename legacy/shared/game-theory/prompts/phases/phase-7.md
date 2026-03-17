# Phase 7: Assumption Extraction and Sensitivity

**Purpose:** Make every assumption explicit and determine which ones the predictions depend on most.

### 7a: List every assumption

Pull out every assumption embedded in the analysis. Common categories:

- **Behavioral assumptions** — "Trump's primary objective is midterm positioning"
- **Capability assumptions** — "Iran retains enough stockpile to sustain Strait closure for months"
- **Structural assumptions** — "China will exploit the yuan oil opportunity"
- **Institutional assumptions** — "The Senate will not pass a War Powers resolution"
- **Rationality assumptions** — "Iran's leadership will prioritize regime survival over ideology"
- **Information assumptions** — "US intelligence damage assessments are broadly accurate"

### 7b: Rate sensitivity

For each assumption: **What happens to the prediction if this is wrong?**

- **Critical** — flipping this assumption flips the central prediction
- **High** — significantly changes probability estimates or eliminates a scenario
- **Medium** — modifies details but not the structural prediction
- **Low** — cosmetic effect

Assumptions rated critical or high need the strongest evidence. If they are supported only by inference rather than direct evidence, flag that explicitly.

### 7c: Identify correlated assumptions

Some assumptions move together because they are driven by the same latent factor. "Iran regime fragility" might simultaneously affect willingness to escalate, probability of internal power struggles, effectiveness of economic pressure, and timeline for reconstitution. Identify these clusters explicitly so that scenarios can account for correlated changes rather than treating each assumption as independent.

### 7d: Mark which assumptions are game-theoretic and which are empirical

This separation matters for diagnosis when predictions fail.

- **Game-theoretic assumption:** the move order is sequential, or the interaction is effectively repeated, or the game is best modeled as chicken rather than prisoner's dilemma
- **Empirical assumption:** missile inventories are low, or public support is collapsing, or oil prices will exceed a threshold

When a prediction fails, you want to know whether the model structure was wrong or the empirical input was wrong. These require different corrections.

**Tools to use:** `add_assumption`, `update_assumption`, `add_contradiction`, `add_latent_factor`.
