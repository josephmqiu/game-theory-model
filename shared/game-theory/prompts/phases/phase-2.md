# Phase 2: Player Identification

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

**Tools to use:** `add_player`, `update_player`, `add_player_objective`, `update_information_state`. Use `web_search` if you need to research specific actors.
