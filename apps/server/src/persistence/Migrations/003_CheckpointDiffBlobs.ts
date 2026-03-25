/**
 * Migration 003 - CheckpointDiffBlobs (removed)
 *
 * Originally created the checkpoint_diff_blobs table for code-editor
 * checkpointing. The table is no longer needed but the migration slot
 * must remain so that the sequential migration runner stays consistent
 * with databases that already applied it.
 */
import * as Effect from "effect/Effect";

export default Effect.void;
