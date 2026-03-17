Set a payoff value for one player in one outcome cell of a normal-form formalization's payoff matrix.
Inputs: `formalization_id` (required), `strategy_profile` (required — maps player IDs to strategy labels), `player_id` (required), `value` (number), `confidence` (0–1), `rationale` (required — explain why this payoff ranking is justified).
The tool will fail if the formalization does not exist or if the strategy profile does not match the formalization's defined strategies.
Use ordinal preferences when you only have ordinal data — fabricating cardinal precision in payoffs propagates distortion through all downstream equilibrium calculations.
