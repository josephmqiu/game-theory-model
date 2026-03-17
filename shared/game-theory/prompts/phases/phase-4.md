# Phase 4: Historical Repeated Game

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

**Tools to use:** `add_repeated_game_entry`, `add_trust_assessment`, `add_repeated_game_pattern`, `add_dynamic_inconsistency_risk`, `web_search`.
