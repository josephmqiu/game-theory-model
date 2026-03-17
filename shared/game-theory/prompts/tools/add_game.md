Create a strategic game that captures a specific interaction between players, classifying the core tension with a canonical game type.
Inputs: `name` (required), `description`, `players` (array of existing player IDs), `canonical_game_type` (chicken/prisoners_dilemma/bargaining/signaling/entry_deterrence/coordination/war_of_attrition), `move_order` (simultaneous/sequential).
All player IDs must reference players already created with add_player.
Start with the smallest game that captures the core strategic tension; add additional games only when a simpler model fails to explain observed behavior.
