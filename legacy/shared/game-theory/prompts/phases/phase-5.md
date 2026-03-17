# Phase 5: Recursive Revalidation Checkpoint

**Purpose:** Determine whether findings from Phase 4 require re-running earlier phases.

### Disruption triggers

If the historical research revealed any of the following, loop back:

| Disruption                                            |         Loop back to         |
| ----------------------------------------------------- | :--------------------------: |
| New player with independent agency discovered         |           Phase 2            |
| Player's objective function changed                   |      Phase 2 + Phase 3       |
| New game identified                                   |           Phase 3            |
| Existing game reframed                                |           Phase 3            |
| Repeated interaction dominates one-shot incentives    |      Phase 3 + Phase 4       |
| New cross-game link discovered                        |           Phase 3i           |
| Escalation ladder needs revision                      |           Phase 3e           |
| Institutional constraint changed or was misunderstood |           Phase 3g           |
| Critical empirical assumption invalidated             |           Phase 7            |
| Formal model cannot explain a core observed fact      | Phase 3, simplify or reframe |

### How to revalidate

Don't start from scratch. Re-run the affected phase with the new information and check what downstream conclusions change.

- If a player's objective function changed, re-check every game they're in — their strategy rankings may have shifted.
- If a new game was identified, add it to the cross-game constraint table and re-check which strategies survive across all games.
- If a game was reframed, the equilibrium analysis changes — re-run Phase 6.
- If an institutional constraint was misunderstood, the strategy space may be wider or narrower than modeled.

### This checkpoint fires throughout the process, not just here

Phase 5 is positioned after the historical analysis because that's the most common trigger point. But the recursive loop can fire at any phase. Phase 6's formal modeling may reveal a hidden game. Phase 10's meta-check may surface a missing player. Any disruption propagates backward to the earliest affected phase and then forward again.

### Why Phase 4 is the most common trigger

The historical repeated game analysis is the phase most likely to fire multiple triggers simultaneously. The historical research can:

- Reveal a new game (e.g. dual-track deception — negotiations as intelligence instrument)
- Change a player's objective function
- Surface new player dynamics
- Invalidate a critical assumption (e.g. that both sides preferred negotiated settlement)
- Shift scenario probabilities significantly

All five disruption triggers can fire at once. That's why Phase 4 must come before predictions, and why Phase 5 exists as a mandatory checkpoint rather than an optional review.

**Tools to use:** `check_disruption_triggers`. If triggers fire, return to the appropriate earlier phase before continuing.
