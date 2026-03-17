Draw a higher-level strategic inference from one or more claims, applying game-theoretic logic to reach an analytical conclusion.
Inputs: `statement` (required), `derived_from` (required array of claim IDs), `confidence` (0–1), `rationale` (required — explain the logical or game-theoretic step from the supporting claims to this conclusion).
All claim IDs in `derived_from` must reference claims you have already created.
Inferences inform game modeling — "Recession risk reduces the government's outside option, weakening its bargaining leverage" is an inference that should feed directly into payoff reasoning.
