import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // ── Analysis state (singleton row for the current analysis) ──
  yield* sql`
    CREATE TABLE IF NOT EXISTS analysis_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      analysis_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      topic TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  // ── Analysis runs ──
  yield* sql`
    CREATE TABLE IF NOT EXISTS analysis_runs (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      current_phase TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_analysis_runs_status
    ON analysis_runs(status)
  `;

  // ── Analysis entities ──
  yield* sql`
    CREATE TABLE IF NOT EXISTS analysis_entities (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      phase TEXT NOT NULL,
      type TEXT NOT NULL,
      data_json TEXT NOT NULL,
      confidence TEXT NOT NULL DEFAULT 'medium',
      rationale TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'ai',
      revision INTEGER NOT NULL DEFAULT 1,
      stale INTEGER NOT NULL DEFAULT 0,
      entity_group TEXT,
      provenance_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_analysis_entities_run_id
    ON analysis_entities(run_id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_analysis_entities_phase
    ON analysis_entities(phase)
  `;

  // ── Analysis relationships ──
  yield* sql`
    CREATE TABLE IF NOT EXISTS analysis_relationships (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      type TEXT NOT NULL,
      from_entity_id TEXT NOT NULL,
      to_entity_id TEXT NOT NULL,
      metadata_json TEXT,
      source TEXT,
      provenance_json TEXT,
      created_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_analysis_relationships_from
    ON analysis_relationships(from_entity_id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_analysis_relationships_to
    ON analysis_relationships(to_entity_id)
  `;
});
