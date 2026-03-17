Propose a change to an existing entity for user review, staging it as a diff rather than applying it immediately.
Inputs: `entity_type` (required), `entity_id` (required), `changes` (required object with the fields to change), `rationale` (required — explain why this change is warranted based on new information).
Use this instead of direct update\_\* tools when modifying entities the user has previously reviewed or accepted; only the renderer can promote proposed revisions to the canonical store.
The user will see the proposal and can accept or reject it — never bypass this workflow for entities that have already been user-reviewed.
