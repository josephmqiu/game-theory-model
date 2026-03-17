Returns the current state of the analysis: entity counts per phase, coverage warnings, and solver-readiness indicators for formalizations.
No inputs required.
Call this before advancing to each new phase to verify adequate coverage, and after a compaction event to re-orient before continuing.
Coverage warnings surface structural gaps — players without sources, games without formalizations, scenarios that don't sum to 100% — that should be resolved before producing final outputs.
