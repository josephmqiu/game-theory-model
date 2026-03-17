# Phase 6: Full Formal Modeling

**Purpose:** Apply game-theoretic tools to the now-stabilized strategic picture. This is where the math and formal concepts go — after the baseline model has been grounded and refined.

### 6a: Choose the right formal representation

For each identified game, choose the appropriate representation:

- **Normal form (payoff matrix)** — for simultaneous moves and finite strategy sets. Good for quick equilibrium identification.
- **Extensive form (game tree)** — when timing, sequencing, information sets, and credibility matter. Good for understanding escalation dynamics and information revelation.
- **Repeated game** — when current behavior depends on past rounds and the shadow of future interaction. Good for understanding cooperation, punishment, and reputation.
- **Bayesian game** — when players have private information about type, capability, cost, or resolve. Good for analyzing how observed actions update beliefs.
- **Signaling model** — when observable actions are specifically intended to shape the other side's beliefs. Good for separating credible from non-credible communication.
- **Bargaining model** — when outside options, patience, deadlines, and commitment problems determine outcomes. Good for negotiation and settlement analysis.

One real-world event can support multiple formalizations. But each one should answer a different question. A quick 2×2 normal-form matrix captures the core tension. A detailed extensive-form tree captures the sequential dynamics. A repeated game captures the long-run interaction. These complement rather than replace each other.

### 6b: Estimate payoffs with discipline

Every payoff estimate is an assumption. Make it explicit:

- **Rank:** ordinal preference first (A > B > C for this player)
- **Value:** cardinal estimate only if justified by evidence for magnitudes
- **Range:** plausible interval
- **Confidence:** high / medium / low
- **Rationale:** why this ranking or number?
- **What it depends on:** which factual claims or assumptions support it?

**Ordinal before cardinal.** If you can only rank outcomes, rank them. Do not fabricate numerical precision. False precision in payoffs propagates through every computation — the resulting equilibrium calculations look rigorous but are built on fabricated numbers.

### 6c: Solve the baseline equilibrium first

For each formalized game, identify:

- **Dominant strategies** — strategies that are best regardless of what others do
- **Nash equilibria** — strategy profiles where no player can improve by unilaterally changing
- **Subgame perfect equilibria** — in sequential games, equilibria that are credible at every decision point (eliminates empty threats)
- **Bayesian Nash equilibria** — in games with incomplete information, equilibria where each type of each player optimizes given beliefs
- **Separating / pooling / semi-separating equilibria** — in signaling games, whether different types take distinguishable actions

Do not solve the fancy version before solving the simple one. The baseline equilibrium is the anchor. Additional layers of complexity are tested against it.

### 6d: Address equilibrium selection

When multiple equilibria exist, what determines which one obtains?

- **Path dependence / history** — the repeated game history may make some equilibria unreachable. Destroyed trust eliminates cooperative equilibria even though they still exist mathematically.
- **Focal points (Schelling)** — shared cultural or contextual knowledge that makes one equilibrium salient. A public demand of "unconditional surrender" creates a focal point that is very difficult to walk back from.
- **Relative cost of swerving** — in chicken, the player for whom swerving is more costly (existential vs political) is less likely to swerve.
- **Commitment devices** — has either player burned bridges or made irreversible moves that eliminate certain strategies? Public commitments, troop deployments, and burned diplomatic channels all constrain future choices.
- **Institutional rules** — voting procedures, veto powers, ratification requirements, and legal authorities that constrain which equilibria are reachable.
- **Salient public narratives** — media framing, historical analogies, and domestic political narratives that create expectations which become self-reinforcing.

### 6e: Analyze bargaining dynamics

For negotiations or potential settlements:

- **Outside options** — what each player gets if bargaining fails. The player with the better outside option has more bargaining power. If outside options are improving over time for one side, delay benefits that side.
- **Patience / discount factors** — who is more patient? The more patient player gets a better deal in bargaining models. Short-term political pressure reduces patience.
- **Deadlines** — real or constructed time pressure that forces decisions. Electoral cycles, military windows, resource depletion, and seasonal factors all create deadlines.
- **Commitment problems** — can either side credibly commit to honoring an agreement? If not, what enforcement mechanisms could substitute for trust?
- **Dynamic inconsistency** — will the deal survive leadership transitions? Agreements that depend on executive discretion rather than ratified treaties or legislation are vulnerable to future defection.
- **Issue linkage** — whether concessions in one domain affect bargaining power in another.

### 6f: Analyze communication — cheap talk, costly signals, and audience costs

Categorize observable actions carefully:

- **Cheap talk** — statements, communications, public demands that cost little or nothing directly. Diplomatic speeches, press releases, marketing claims, opening arguments.
- **Costly signals** — actions that are expensive, risky, or partially irreversible. Closing a shipping strait, deploying forces, offering concessions; shipping a product, signing an exclusive contract. These are informative precisely because they are expensive to fake.
- **Audience costs** — public commitments that create penalties for backing down. These convert cheap talk into moderately costly signals, but only if the audience actually punishes reversal.

**Important correction: cheap talk is not automatically worthless.** It can be informative when interests are at least partially aligned, the speaker has reputational capital to protect, statements are verifiable later, or the repeated game makes lying costly over time.

### 6g: Evaluate option value

When a player appears to be "doing nothing," they may be preserving option value:

- Preserving escalation flexibility
- Avoiding irreversible commitment under uncertainty
- Waiting for information revelation
- Letting another player's constraints tighten first

Option value is highest when uncertainty is high. Players who preserve options during high-uncertainty periods are behaving rationally, even if it looks like indecision.

### 6h: Apply behavioral and analytical overlays — labeled explicitly

Some tools improve the analysis without being core game theory in the narrow sense. Use them deliberately, but label them clearly so the user of the analysis knows which parts come from formal equilibrium results and which come from adjacent frameworks.

**Prospect theory / reference dependence** — modifies how losses and gains are perceived. Players evaluate outcomes relative to a reference point, and losses loom larger than equivalent gains. Do not skip it in any analysis involving military force, sanctions, or ultimatums. But label predictions that depend on it.

**Behavioral biases** — overconfidence, sunk-cost reasoning, groupthink, anchoring, and honor-based escalation dynamics.

**Scenario planning** — structured exploration of future paths. A forecasting discipline rather than an equilibrium concept.

**Red-teaming / counteranalysis** — adversarial model checking. Valuable for robustness but not itself a game-theoretic method.

Do not smuggle these in as if they were equilibrium results.

### 6i: Model cross-game effects formally when needed

For each cross-game link identified:

- What is the trigger (which move in Game A affects Game B)?
- What is the effect type? (payoff shift, belief update, strategy unlock/elimination, player entry/exit, commitment change, resource transfer, timing change)
- What is the magnitude and direction?
- Is the effect immediate or delayed?
- Does it cascade (does the effect in Game B trigger further effects in Game C)?

Not every event requires this. Use it when multiple games genuinely interact. The cross-game effects are often where the most valuable and surprising analytical insights emerge.

**Tools to use:** `add_formalization`, `set_payoff`, `add_strategy`, `add_signal_classification`, `add_cross_game_link`.
