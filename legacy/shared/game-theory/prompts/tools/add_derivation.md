Create a directed link in the evidence chain between two existing entities to make the logical structure of the analysis explicit.
Inputs: `from_ref` (source entity ID), `to_ref` (target entity ID), `relation` (supports/infers/contradicts).
Both entity IDs must already exist in the canonical store before a derivation can be created between them.
Use "contradicts" to flag conflicting evidence rather than suppressing it — surfacing contradictions is essential for sensitivity analysis.
