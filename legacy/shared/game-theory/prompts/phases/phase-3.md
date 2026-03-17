# Phase 3: Baseline Strategic Model

**Purpose:** Build the smallest game that captures the main strategic tension.

This is the first formal step — but it is intentionally rough. The goal is not elegance. The goal is to create a minimal model early enough to discipline the rest of the analysis.

### 3a: Start with the minimal sufficient game

Do not require multiple games by default. Start with the smallest model that can explain the core strategic problem:

- Who are the main players?
- What are their feasible actions right now?
- What outcomes do they prefer, at least ordinally?
- Are moves simultaneous, sequential, repeated, or under incomplete information?

Then ask: **What important observed fact does this simple model fail to explain?**

Only add another game, another player, or another layer of complexity if it changes behavior in a meaningful way. A real-world event may ultimately require multiple linked games. But complexity should be earned, not assumed.

### 3b: Match the event to the nearest canonical structure

Common baseline structures:

**Chicken / brinkmanship** — both sides escalate, each hoping the other backs down. Key features: mutual destruction if neither swerves, asymmetric costs of swerving, credibility of commitment to not swerve.

**Prisoner's dilemma** — individual incentives push toward mutual defection even though mutual cooperation is better for both. Key feature: dominant strategy to defect regardless of what the other does.

**Coordination game** — players want alignment but may fail to coordinate on which equilibrium. Key feature: multiple equilibria, communication problems.

**War of attrition** — both sides incur ongoing costs and the one that quits first loses. Key feature: the cost-exchange ratio determines who wins if the game goes long.

**Bargaining game** — players divide value under threats, deadlines, outside options, and commitment problems. Key feature: the distribution of patience and outside options determines bargaining power.

**Signaling game** — one player knows something private and takes an observable action that may reveal it. Key feature: costly signals are more credible than cheap signals, but cheap signals can still be partially informative.

**Bayesian / incomplete information game** — players act under uncertainty about others' type, capability, or resolve. Key feature: actions serve dual purpose as both strategic moves and information signals.

**Coalition / alliance game** — partially aligned players bargain over agenda control, burden sharing, entrapment, and abandonment. Key feature: allies with different objectives can drag each other into unwanted escalation.

**Domestic political game** — leaders optimize for political survival, which may diverge from state welfare. Key feature: audience costs, rally effects, electoral timing constraints.

**Economic hostage / chokepoint game** — threatening infrastructure, supply chains, or markets that affect third parties more than the direct adversary. Key feature: costs are imposed on the global commons, not just the opponent.

**Bertrand competition** — players compete on price (or a single observable dimension) for substitutable goods or services. Key feature: undercutting pressure drives prices toward marginal cost. Relevant when switching costs are low and offerings are comparable.

**Hotelling differentiation** — players choose positions on a spectrum (features, market segment, ideology) to capture share. Key feature: differentiation reduces direct competition but limits addressable market. The tension between capturing the center and defending a niche.

**Entry deterrence** — an incumbent faces a potential entrant with a different cost structure or capability. Key feature: the incumbent may invest in deterrence (excess capacity, patents, reputation, predatory pricing) that is costly but prevents entry.

**Network effects / platform competition** — value to each user increases with total adoption, creating winner-take-most dynamics. Key feature: tipping points after which switching becomes prohibitively costly. Early adoption advantages compound.

### 3c: Distinguish deterrence from compellence

This distinction matters enormously for prediction.

**Deterrence** — preventing an action by threatening punishment. Structurally easier: you make a credible threat and wait. The other side just has to not do something.

**Compellence** — forcing an action by threatening continued punishment until the other side acts. Structurally harder: you have to maintain pressure, the other side has to visibly do something, and visible capitulation carries its own costs.

Identify who is trying to deter, who is trying to compel, and whether they are trying to do both at once. Compellence almost always takes longer and costs more than the compelling side expects.

This distinction applies beyond military contexts. In business: maintaining a patent portfolio to prevent market entry is deterrence. Using a price war to force a competitor to exit is compellence. In legal disputes: the threat of litigation deters breach. A lawsuit to compel performance is compellence. The structural asymmetry is the same.

### 3d: Build the first-pass strategy table

Before doing deep history, write a crude table:

| Player   | Strategy A | Strategy B | Strategy C |
| -------- | :--------: | :--------: | :--------: |
| Player 1 |            |            |            |
| Player 2 |            |            |            |

Then annotate:

- Which strategies are actually feasible now?
- Which require new capabilities or new political permission?
- Which are rhetoric only?
- Which are clearly dominated or nearly dominated?

This table is provisional. Its purpose is to keep the later phases from drifting.

### 3e: Map the escalation ladder

List the escalation rungs that have already been climbed and those that remain available. For each side:

- What have they already done? (rungs climbed)
- What is the next escalation step? (next rung)
- How many rungs remain above the current level?
- Who has escalation dominance (more remaining options to escalate)?
- Where does the stability-instability paradox apply? (stable at the highest level, but deeply unstable at conventional levels precisely because the highest level is stable)
- Which rungs are reversible and which create irreversible commitment?

The escalation ladder applies to any strategic interaction where players can commit increasingly costly or irreversible actions. In military conflicts, the rungs are types of military action. In business competition, they might be price adjustments → exclusive partnerships → acquisitions → antitrust actions. In legal disputes: demand letter → mediation → litigation → appeal → enforcement. The analytical value is the same in every domain: understanding which rungs have been climbed, which remain available, who has escalation dominance, and which rungs create irreversible commitment.

### 3f: Map the move order and time structure

Even at this early stage, specify the timing:

- Who moves first?
- Who can respond immediately?
- What can be revised later?
- Which threats are only relevant if they remain credible after the first move?

Additionally, distinguish three time notions that must never be conflated:

- **Event time** — when things happen in the real world (chronological dates)
- **Model time** — the strategic move order in the formalization (which may compress or reorder real-world events)
- **Simulation time** — turn order during any play-out or war-gaming exercise

A world event spanning months can be modeled as a single simultaneous game or a sequential tree. The choice of move order in the model is itself an analytical decision that needs justification.

If timing matters — and it usually does — the event is not just a payoff matrix.

### 3g: Identify institutional constraints as game-structure parameters

Institutional rules don't just provide background context or select equilibria — they determine which games can be played and which strategies are feasible.

- **International institutions** — UN Security Council veto structure, IAEA verification authority, WTO dispute mechanisms, ICC jurisdiction
- **Domestic legal constraints** — War Powers Act, congressional authorization requirements, judicial review, parliamentary approval
- **Alliance obligations** — NATO Article 5, bilateral defense treaties, intelligence-sharing agreements
- **Economic institutions** — OPEC pricing mechanisms, SWIFT banking system, sanctions enforcement, reserve currency dependencies
- **Arms control frameworks** — NPT, existing bilateral agreements, verification regimes

Treat these as parameters that define the game, not as background flavor. A Senate vote that fails to constrain presidential military authority changes the game's strategy space — it eliminates a potential check and expands what the executive can do without domestic political cost.

### 3h: Add adjacent games only when they change the answer

After the minimal baseline model is built, ask whether the event also contains:

- A domestic political game
- A coalition game
- An economic chokepoint game
- A credibility / reputation game
- A repeated game with long memory
- A private-information or signaling layer

Add each only if it changes incentives, constrains strategies, or alters equilibrium selection. If a game doesn't change the answer, leave it out.

### 3i: Build the cross-game constraint table if multiple games matter

If more than one game survives the test above, build the cross-game constraint table.

| Strategy   | Military game | Economic game | Credibility game | Domestic game |
| ---------- | :-----------: | :-----------: | :--------------: | :-----------: |
| Strategy 1 |               |               |                  |               |
| Strategy 2 |               |               |                  |               |
| Strategy 3 |               |               |                  |               |

For each cell, mark whether the strategy succeeds (✓), fails (✗), or has uncertain/mixed effects (?).

The strategy that survives across games is often more predictive than the equilibrium of any single isolated game. If every available strategy fails in at least two games, the player is genuinely trapped — and trapped players do unpredictable things.

**Tools to use:** `add_game`, `update_game`, `add_formalization`, `add_strategy`, `add_escalation_ladder`.
