# Game Theory Analytical Methodology v3

A repeatable process for applying game theory to real-world events.


## The core principle

Game theory applied to a misunderstood situation produces confident-looking nonsense. The model is only as good as the factual foundation, the player identification, the institutional structure, and the historical context.

Most analytical failures come from one of two errors:

1. **Formalizing too early** — jumping to "it's a prisoner's dilemma" before understanding who's actually playing, what they want, and what happened last time they interacted.
2. **Formalizing too late** — collecting history, anecdotes, and rhetoric for so long that the analysis turns into unconstrained storytelling.

The methodology is structured to avoid both mistakes.

**Facts first. Players second. Baseline model third. History fourth. Full formalization fifth. Predictions last.**

The baseline model comes early for one reason: even a rough game forces discipline. It tells you what information matters, what history matters, and which facts are strategic versus merely descriptive. But it must be held loosely — the historical phase will often break it.

---

## Phase 1: Situational grounding

**Purpose:** Build the factual picture before identifying any games.

Do not start with theory. Start with: what is actually happening right now? Research the current state thoroughly. Collect specific data points, not summaries. Numbers anchor the analysis and prevent narrative drift.

**What to capture:**

- Capabilities and resources (military assets and deployments; product features and market position; financial reserves and legal representation — whatever each side can bring to bear)
- Economic and financial impact (prices, supply disruptions, market reactions, sanctions, revenue shifts, cost structures)
- Stakeholder positions from each side (political statements, company announcements, legal filings — distinguish public posturing from operational signals)
- Impact on affected parties (civilian casualties and displacement; customer disruption; employee impact; collateral damage to third parties)
- Timeline of key events with exact dates
- What each side has actually done (actions), not just what they've said (words)
- Rules and constraints already in force (treaties, sanctions regimes, alliance commitments; regulations, contracts, platform terms; legal authorities, organizational mandates)

**Discipline:** Capture sources with timestamps. Preserve specific numbers and quotes. These become the evidence foundation that every later claim traces back to.

**What to watch for:** Facts that surprise you. If something doesn't fit your initial mental model of the situation, that's signal — it usually means the game structure is different from what you assumed.

---

## Phase 2: Player identification

**Purpose:** Know who's playing and what they're optimizing for before naming any game.

This is where most analyses go wrong. They identify two players and one game. Real events involve multiple players with complex, internally conflicting objectives.

### 2a: Identify all players with agency

Include obvious players but also look for:

- **Primary players** — actors making the most consequential moves directly. Nations in a conflict, firms in a market, parties in a lawsuit, principals in a negotiation.
- **Involuntary players** — actors who didn't choose the game but are affected by it and have constrained agency. Their constrained responses still shape the game. Civilians in a conflict, customers in a price war, employees in a merger, bystanders in a dispute.
- **Background players** — actors whose structural interests are served by the situation continuing or resolving in specific ways, even if they are not making visible moves. A third country benefiting from a rival's distraction, an open-source community affected by a standards war, extended family in a divorce.
- **Internal players** (intra-player agents) — when a nominally single actor is actually multiple agents with divergent incentives. "The United States" may be a political leader, a military establishment, a legislature, a bureaucracy, and a public. "The company" may be a CEO, a board, a product team, and shareholders. The principal-agent problems within players are often more dangerous than the conflicts between players.
- **Gatekeepers** — actors who cannot determine the outcome alone but can block, delay, or veto critical moves. A Senate that fails to pass a War Powers resolution, a regulator that blocks a merger, a judge who rules on admissibility — gatekeepers whose inaction changes the game structure.

### 2b: Write explicit objective functions

For each player, write out the full objective function with AND clauses:

> "The US wants to degrade Iranian military capability AND eliminate the nuclear program AND reopen the Strait of Hormuz AND maintain domestic political support AND preserve international credibility."

Then identify:

- **Internal conflicts** — which objectives contradict each other for the same player? These internal conflicts often determine behavior more than the conflict between players. If reopening the Strait requires ground troops but domestic support requires no ground troops, the player is trapped.
- **Priority ordering** — which objectives are absolute or near-absolute priorities, and which are tradable? Some objectives are effectively non-negotiable (regime survival for an authoritarian state). But do not assume every stated red line is truly lexicographic — test whether the player has ever traded it away before.
- **Stability** — is the objective function stable or shifting over time? An objective function that shifts three times in two weeks is itself a strategic variable. Other players cannot optimize against a moving target, which creates uncertainty that may be deliberate.
- **Non-standard utility** — ideological commitments, honor-based reasoning, historical trauma, martyrdom narratives, domestic symbolism, and regime survival logic may materially alter payoffs. These are not irrational — they are different utility functions that change the game's equilibrium structure.

### 2c: Identify what each player knows and doesn't know

- What information does each player have about others' capabilities?
- What does each player believe about others' resolve and red lines?
- What private constraints does each player know about itself but conceal from others?
- Where are the information asymmetries that create strategic opportunities or risks?

If the answer to any of these questions matters for behavior, incomplete information is already part of the game.

---

## Phase 3: Baseline strategic model

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

| Player | Strategy A | Strategy B | Strategy C |
|--------|:---:|:---:|:---:|
| Player 1 | | | |
| Player 2 | | | |

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

The escalation ladder applies to any strategic interaction where players can commit increasingly costly or irreversible actions. In military conflicts, the rungs are types of military action (strikes on military targets → oil infrastructure → naval confrontation → catastrophic tier). In business competition, they might be price adjustments → exclusive partnerships → acquisitions → antitrust actions. In legal disputes: demand letter → mediation → litigation → appeal → enforcement. The analytical value is the same in every domain: understanding which rungs have been climbed, which remain available, who has escalation dominance, and which rungs create irreversible commitment.

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

- **International institutions** — UN Security Council veto structure (who can block collective action?), IAEA verification authority, WTO dispute mechanisms, ICC jurisdiction
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

| Strategy | Military game | Economic game | Credibility game | Domestic game |
|----------|:---:|:---:|:---:|:---:|
| Strategy 1 | | | | |
| Strategy 2 | | | | |
| Strategy 3 | | | | |

For each cell, mark whether the strategy succeeds (✓), fails (✗), or has uncertain/mixed effects (?).

The strategy that survives across games is often more predictive than the equilibrium of any single isolated game. If every available strategy fails in at least two games, the player is genuinely trapped — and trapped players do unpredictable things.

---

## Phase 4: Historical repeated game

**Purpose:** Use history to refine the baseline model before making predictions.

This phase remains one of the most important — and the most likely to break the baseline model. But it is now explicitly tied to the model from Phase 3. History is not collected for its own sake. It is collected to answer a strategic question: what does the repeated interaction tell us about trust, punishment, reputation, and equilibrium selection now?

### 4a: Map the last 5-10 years of interaction as a repeated game

For each pair of key players, document:

- Each major move (cooperation, defection, punishment, concession, delay)
- The sequence and timing
- What the other side was doing at the time of each move
- The outcome of each round
- Whether the move changed future beliefs or institutional rules

### 4b: Look for specific repeated-game patterns

**Defection during cooperation** — the most trust-destroying move. Did one side attack, sanction, or withdraw while the other was cooperating or negotiating? How many times?

**Tit-for-tat behavior** — proportional retaliation that keeps the door open for re-cooperation. Signals sophistication and willingness to return to cooperation if the other side does.

**Grim trigger** — a switch to permanent punishment after defection. If one side has adopted "never cooperate again," the repeated game has collapsed into a one-shot game with much worse equilibria.

**Selective forgiveness** — retaliation followed by restoration of cooperation if the other side repairs trust. Distinct from tit-for-tat because it involves judgment about whether the defection was a one-time deviation or a structural change.

**Dual-track deception** — using diplomatic engagement as cover for military preparation, intelligence extraction, or positional improvement. If this pattern is detected, all future diplomatic signals from that player lose credibility.

**Adverse selection** — repeated interaction that systematically punishes moderates and rewards hardliners within one side. If cooperation is consistently punished, the internal political process selects for hawkish types who were right to distrust. This is self-reinforcing and very difficult to reverse.

### 4c: Assess the state of trust infrastructure

Based on the repeated game history, what is each player's posterior belief that the other will honor commitments? This matters in any repeated interaction — between nations negotiating treaties, between firms considering partnerships, between co-defendants deciding whether to cooperate, between parties in a long-running dispute.

- If near zero: cooperative agreement is effectively impossible without external enforcement
- If low: cooperation may require third-party guarantees, escrow, or automatic penalties
- If moderate: cooperation is possible but will require costly credibility-building steps
- If high: standard negotiation or partnership process can work

### 4d: Identify dynamic inconsistency risks

Can commitments survive leadership transitions? Look for:

- Treaty ratification or legislation (durable) versus executive discretion only (fragile)
- Bureaucratic lock-in versus easy reversal
- Electoral cycles or leadership transition deadlines
- Short versus long decision horizons (short-horizon leaders defect more because they won't bear the long-term costs)
- Whether the institutional form of the commitment matches the commitment's required durability

### 4e: Assess the global signaling effect

Every interaction between two players is observed by all other players. What lessons has the broader system drawn?

- "Negotiating with Player A during military buildup is dangerous"
- "Player B honors agreements across administrations"
- "Concessions to Player C are exploited"

A bilateral repeated game often becomes a global reputation game. The signaling effects compound over decades and affect the player's ability to negotiate with anyone, not just the current adversary.

### 4f: Re-check the baseline model

At the end of the historical phase, ask explicitly:

- Does the baseline game from Phase 3 still look right?
- Did history reveal that the real game is repeated rather than one-shot?
- Did it reveal a hidden player, hidden commitment problem, or hidden type uncertainty?
- Did it eliminate cooperative equilibria that still existed mathematically on paper?
- Did it change any player's objective function?
- Did it reframe the deterrence/compellence structure?

If yes to any, revise the model before proceeding.

---

## Phase 5: Recursive revalidation checkpoint

**Purpose:** Determine whether findings from Phase 4 require re-running earlier phases.

### Disruption triggers

If the historical research revealed any of the following, loop back:

| Disruption | Loop back to |
|-----------|:---:|
| New player with independent agency discovered | Phase 2 |
| Player's objective function changed | Phase 2 + Phase 3 |
| New game identified | Phase 3 |
| Existing game reframed | Phase 3 |
| Repeated interaction dominates one-shot incentives | Phase 3 + Phase 4 |
| New cross-game link discovered | Phase 3i |
| Escalation ladder needs revision | Phase 3e |
| Institutional constraint changed or was misunderstood | Phase 3g |
| Critical empirical assumption invalidated | Phase 7 |
| Formal model cannot explain a core observed fact | Phase 3, simplify or reframe |

### How to revalidate

Don't start from scratch. Re-run the affected phase with the new information and check what downstream conclusions change.

- If a player's objective function changed, re-check every game they're in — their strategy rankings may have shifted.
- If a new game was identified, add it to the cross-game constraint table and re-check which strategies survive across all games.
- If a game was reframed, the equilibrium analysis changes — re-run Phase 6.
- If an institutional constraint was misunderstood, the strategy space may be wider or narrower than modeled.

### This checkpoint fires throughout the process, not just here

Phase 5 is positioned after the historical analysis because that's the most common trigger point. But the recursive loop can fire at any phase. Phase 6's formal modeling may reveal a hidden game. Phase 10's meta-check may surface a missing player. Any disruption propagates backward to the earliest affected phase and then forward again.

### Why Phase 4 is the most common trigger

The historical repeated game analysis is the phase most likely to fire multiple triggers simultaneously. In the founding analysis (US-Iran 2026), the historical research:

- Revealed a new game (dual-track deception — negotiations as intelligence instrument)
- Changed a player's objective function (Iran shifted from "negotiate if advantageous" to "never negotiate with the US")
- Surfaced a new player dynamic (Netanyahu's entrapment of Trump via intelligence-sharing)
- Invalidated a critical assumption (that both sides preferred negotiated settlement to continued fighting)
- Shifted scenario probabilities (negotiated settlement dropped from ~40% to ~10%)

All five disruption triggers fired at once. That's why Phase 4 must come before predictions, and why Phase 5 exists as a mandatory checkpoint rather than an optional review.

---

## Phase 6: Full formal modeling

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
- **Patience / discount factors** — who is more patient? The more patient player gets a better deal in bargaining models. Short-term political pressure (midterm elections, economic pain, public attention cycles) reduces patience.
- **Deadlines** — real or constructed time pressure that forces decisions. Electoral cycles, military windows, resource depletion, and seasonal factors all create deadlines.
- **Commitment problems** — can either side credibly commit to honoring an agreement? If not, what enforcement mechanisms could substitute for trust? Third-party guarantors, escrowed assets, automatic snapback provisions, and institutional ratification are all commitment devices.
- **Dynamic inconsistency** — will the deal survive leadership transitions? Agreements that depend on executive discretion rather than ratified treaties or legislation are vulnerable to future defection by successor governments.
- **Issue linkage** — whether concessions in one domain affect bargaining power in another. Linking issues can create deals that are impossible on any single dimension, but also creates complexity that can prevent agreement.

### 6f: Analyze communication — cheap talk, costly signals, and audience costs

Categorize observable actions carefully:

- **Cheap talk** — statements, communications, public demands that cost little or nothing directly. Diplomatic speeches, press releases, marketing claims, opening arguments.
- **Costly signals** — actions that are expensive, risky, or partially irreversible. Closing a shipping strait, deploying forces, offering concessions; shipping a product, signing an exclusive contract, open-sourcing a codebase; filing a lawsuit, posting a bond. These are informative precisely because they are expensive to fake.
- **Audience costs** — public commitments that create penalties for backing down. A political leader who promises "no negotiation" faces voter backlash for reversing. A CEO who announces a product pivot faces board scrutiny for abandoning it. These convert cheap talk into moderately costly signals, but only if the audience actually punishes reversal.

**Important correction: cheap talk is not automatically worthless.** It can be informative when:

- Interests are at least partially aligned
- The speaker has reputational capital to protect
- Statements are verifiable later
- The repeated game makes lying costly over time
- The communication narrows the set of possible types even if it doesn't fully resolve uncertainty

Costly signals are usually more credible. But dismissing all diplomatic statements as noise would cause you to miss partially informative communication that turns out to be important.

### 6g: Evaluate option value

When a player appears to be "doing nothing," they may be preserving option value:

- Preserving escalation flexibility
- Avoiding irreversible commitment under uncertainty
- Waiting for information revelation
- Letting another player's constraints tighten first

Option value is highest when uncertainty is high. Players who preserve options during high-uncertainty periods are behaving rationally, even if it looks like indecision.

Option value is real and analytically useful, but treat it as an overlay on the equilibrium analysis, not a substitute for it.

### 6h: Apply behavioral and analytical overlays — labeled explicitly

Some tools improve the analysis without being core game theory in the narrow sense. Use them deliberately, but label them clearly so the user of the analysis knows which parts come from formal equilibrium results and which come from adjacent frameworks.

**Prospect theory / reference dependence** — modifies how losses and gains are perceived. Players evaluate outcomes relative to a reference point, and losses loom larger than equivalent gains. A regime whose reference point is "sovereignty and dignity" may experience capitulation as a catastrophic loss even when the material terms are favorable. This explains why bombing campaigns against ideologically motivated actors fail more often than standard rational-actor models predict.

*Prospect theory is adjacent to core game theory but frequently essential for analyzing responses to coercion. Do not skip it in any analysis involving military force, sanctions, or ultimatums. But label predictions that depend on it.*

**Behavioral biases** — overconfidence, sunk-cost reasoning, groupthink, anchoring, and honor-based escalation dynamics. These modify individual decision-making in ways that standard rationality assumptions don't capture.

**Scenario planning** — structured exploration of future paths. A forecasting discipline rather than an equilibrium concept.

**Red-teaming / counteranalysis** — adversarial model checking. Valuable for robustness but not itself a game-theoretic method.

Do not smuggle these in as if they were equilibrium results. The user of the analysis should be able to tell which predictions rest on Nash equilibrium logic and which rest on a behavioral or judgmental overlay.

### 6i: Model cross-game effects formally when needed

For each cross-game link identified:

- What is the trigger (which move in Game A affects Game B)?
- What is the effect type? (payoff shift, belief update, strategy unlock/elimination, player entry/exit, commitment change, resource transfer, timing change)
- What is the magnitude and direction?
- Is the effect immediate or delayed?
- Does it cascade (does the effect in Game B trigger further effects in Game C)?

Not every event requires this. Use it when multiple games genuinely interact. The cross-game effects are often where the most valuable and surprising analytical insights emerge — seeing how one game constrains another frequently generates predictions that single-game analysis misses entirely.

---

## Phase 7: Assumption extraction and sensitivity

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

---

## Phase 8: Elimination

**Purpose:** Establish what can't happen before predicting what will.

This is more valuable than it sounds. It constrains the possibility space and prevents scenarios that seem plausible on the surface but are actually eliminated by the strategic structure.

For each eliminated outcome, state which phase's findings eliminate it:

- "Bilateral negotiated settlement is eliminated because Phase 4 shows the trust infrastructure is destroyed."
- "Clean 'declare victory and leave' is eliminated because Phase 3i shows the cross-game constraint table has no strategy that succeeds in the economic and credibility games simultaneously."
- "Quick decisive military victory is eliminated because Phase 1 facts show 14 days of bombardment haven't achieved the stated objectives."

**The test:** If someone who hasn't done this analysis would consider the outcome plausible, it is worth explicitly eliminating with reasoning. The eliminations are often the most surprising and valuable outputs of the entire analysis.

---

## Phase 9: Scenario generation

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

---

## Phase 10: Meta-check

**Purpose:** Catch blind spots before finalizing.

Ask explicitly:

1. **Which player have I spent the least time analyzing?** That's usually where the blind spot is.
2. **Which game am I most confident about?** Overconfidence usually means under-examination.
3. **What's the strongest counterargument to my central thesis?** Steel-man the opposition. If you can't construct a compelling counterargument, you haven't understood the opposing view well enough.
4. **What information would most change my predictions?** Name the specific fact or event.
5. **Which claim in this analysis is most dependent on discretionary judgment rather than formal structure?** That claim needs the most scrutiny.
6. **Have I treated a public statement as more informative than it deserves?** Check whether you gave weight to cheap talk that lacks the conditions for informativeness.
7. **Have I treated a stated red line as lexicographic without evidence that it truly is?** Test whether the player has ever traded that objective away.
8. **Did I add complexity because the event is complex, or because I was reluctant to simplify?** Complexity should be earned.
9. **Could a smaller model explain 80% of the behavior just as well?** If yes, the simpler model should be the primary frame, with additional games as supplements.
10. **Which adjacent analytical tool did I use, and did I label it correctly as adjacent rather than core game theory?** Prospect theory, behavioral biases, option value, and scenario intuition should be identified as overlays.

---

## The recursive loop

The methodology is not linear. It is a directed graph with backward edges.

### Trigger conditions

At any phase, if you discover:

| Discovery | Action |
|-----------|--------|
| New player with independent agency | → Back to Phase 2, then forward |
| Player's objective function changed | → Back to Phase 2, rebuild Phase 3 |
| New game identified | → Back to Phase 3 |
| Existing game reframed | → Back to Phase 3 |
| Repeated interaction dominates one-shot incentives | → Back to Phase 3 + Phase 4 |
| New cross-game link | → Back to Phase 3i or Phase 6i |
| Escalation ladder needs revision | → Back to Phase 3e |
| Institutional constraint changed or misunderstood | → Back to Phase 3g |
| Critical empirical assumption invalidated | → Back to Phase 7, then re-run Phase 8 + 9 |
| Formal model cannot explain a core observed fact | → Back to Phase 3, simplify or reframe |
| Behavioral overlay changes the equilibrium prediction | → Back to Phase 6h, re-label and re-assess |

### Convergence

The recursive loop converges when a full pass through all phases produces no new disruption triggers.

In practice:

- The first pass builds the initial model
- The second pass usually revises it materially (most commonly triggered by Phase 4)
- The third pass is often confirmatory — minor refinements but no structural changes

If after 4+ passes the model is still changing structurally, that is diagnostic: the situation is genuinely complex, the available information is inadequate, or the analyst is forcing the wrong abstraction.

---

## Common failure modes

### Premature formalization
Jumping to a named game before understanding the players, their histories, and the institutional context.

### Unconstrained storytelling
Collecting facts and history without building a baseline model early enough to determine what matters strategically.

### Complexity inflation
Adding multiple games, hidden players, and layered formalisms before proving that the simple model fails. Complexity should be earned by showing what the simple model cannot explain.

### Single-game analysis
Analyzing one game in isolation when the real dynamics emerge from the interaction between games. The cross-game constraint table exists to prevent this.

### False precision
Assigning cardinal payoffs when you only have ordinal preferences. The resulting equilibrium calculations look rigorous but are built on fabricated numbers.

### Monolithic players
Treating states, firms, or alliances as single rational actors when the internal principal-agent dynamics are driving behavior.

### Cheap-talk absolutism
Assuming public statements are either fully informative or totally worthless. In reality, cheap talk ranges from uninformative to partially informative depending on incentives, reputation, verifiability, and the repeated game context.

### Lexicographic overreach
Treating every loudly stated objective as absolute when some are actually bargaining positions, domestic theater, or contingent priorities. Test whether the player has ever traded the objective away.

### Smuggling in behavioral overlays
Using prospect theory, option value, or scenario intuition without labeling them as adjacent analytical tools rather than core equilibrium results. Both the analyst and the user of the analysis need to know which predictions rest on formal game theory and which rest on behavioral or judgmental overlays.

### Ignoring prospect theory when it matters
The opposite error: treating prospect theory as merely decorative when it is frequently the primary explanation for responses to coercion. When analyzing military force, sanctions, or ultimatums, always check whether reference dependence changes the payoff structure enough to change the equilibrium prediction.

### Ignoring option value
Mistaking delayed commitment for indecision when preserving flexibility may be the most rational strategy under high uncertainty.

### Confusing deterrence with compellence
Assuming that the power to stop an action is the same as the power to force one. Compellence is structurally harder and almost always takes longer than expected.

### Ignoring institutional constraints
Treating institutional rules as background context rather than as parameters that define the game structure and strategy space.

### Linear analysis
Running through the phases once and treating the output as final. The recursive loop exists because significant findings in later phases routinely invalidate conclusions from earlier phases.

---

## Final test

A good game-theoretic analysis of a real-world event should be able to answer these questions clearly:

1. **What is the smallest game that captures the core strategic tension?**
2. **What did the repeated interaction history do to today's incentives and beliefs?**
3. **Which strategies are actually feasible once institutional, domestic, and escalation constraints are added?**
4. **What equilibrium or near-equilibrium behavior follows from that structure?**
5. **Which parts of the final forecast come from the model, and which come from analyst judgment under uncertainty?**
6. **What specific evidence would change the central prediction?**

If the methodology cannot answer those six questions, it is not yet finished.
