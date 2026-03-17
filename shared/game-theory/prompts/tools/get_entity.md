Retrieve a single entity from the canonical store by type and ID, returning its full current state.
Inputs: `type` (required — entity type such as player, game, source, formalization, assumption, scenario), `id` (required — the entity's ID).
Use this to review an entity's current state before updating or referencing it, ensuring you don't overwrite fields you intend to preserve.
Prefer this over list_entities when you already know the ID; it is faster and returns the complete field set rather than a summary.
