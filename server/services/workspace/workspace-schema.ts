import type { DatabaseSync } from "node:sqlite";

export const WORKSPACE_SCHEMA_VERSION = 1;

const WORKSPACE_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  analysis_type TEXT NOT NULL,
  file_path TEXT,
  workspace_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  thread_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  message_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  run_id TEXT,
  kind TEXT NOT NULL,
  activity_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  provider TEXT,
  model TEXT,
  effort TEXT,
  status TEXT NOT NULL,
  run_json TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- NOTE: provider_session_bindings and command_receipts are local runtime state,
-- not portable workspace data. They are colocated here as accepted debt in
-- schema v1 because the DB is not yet exported. A future phase should split
-- these into a separate local-runtime-state.sqlite so the portable workspace
-- boundary is enforced at the storage layer.
CREATE TABLE IF NOT EXISTS provider_session_bindings (
  thread_id TEXT PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_session_id TEXT NOT NULL,
  run_id TEXT,
  binding_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS command_receipts (
  command_id TEXT PRIMARY KEY,
  receipt_id TEXT,
  workspace_id TEXT,
  thread_id TEXT,
  run_id TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_fingerprint TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  accepted_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  duplicate_of_command_id TEXT,
  conflict_with_command_id TEXT,
  requested_by TEXT NOT NULL,
  correlation_id TEXT,
  causation_id TEXT,
  result_json TEXT,
  error_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_threads_workspace_id ON threads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_activities_workspace_id ON activities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activities_thread_id ON activities(thread_id);
CREATE INDEX IF NOT EXISTS idx_activities_run_id ON activities(run_id);
CREATE INDEX IF NOT EXISTS idx_runs_workspace_id ON runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_runs_thread_id ON runs(thread_id);
CREATE INDEX IF NOT EXISTS idx_provider_session_bindings_workspace_id ON provider_session_bindings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_command_receipts_receipt_id ON command_receipts(receipt_id);

INSERT OR IGNORE INTO schema_migrations (version, applied_at)
VALUES (${WORKSPACE_SCHEMA_VERSION}, CAST(strftime('%s', 'now') AS INTEGER) * 1000);

PRAGMA user_version = ${WORKSPACE_SCHEMA_VERSION};
`;

export function initializeWorkspaceSchema(db: DatabaseSync): void {
  db.exec(WORKSPACE_SCHEMA_SQL);
}
