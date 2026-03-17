Add a formal representation to an existing game, specifying how that game is modeled mathematically.
Inputs: `game_id` (required — must reference an existing game), `kind` (normal_form/extensive_form/repeated_game/bayesian/signaling/bargaining), `purpose` (explanatory/predictive), `abstraction_level` (minimal/detailed).
The `game_id` must match a game created with add_game; formalizations cannot exist without a parent game.
One game can have multiple formalizations — a 2x2 payoff matrix captures the core tension quickly, while an extensive-form tree captures sequential dynamics and commitment problems.
