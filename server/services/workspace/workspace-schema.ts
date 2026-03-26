import type { DatabaseSync } from "node:sqlite";

export const WORKSPACE_SCHEMA_VERSION = 5;

const BASE_SCHEMA_SQL = `
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
  run_kind TEXT,
  active_phase TEXT,
  progress_completed INTEGER NOT NULL DEFAULT 0,
  progress_total INTEGER NOT NULL DEFAULT 0,
  failure_json TEXT,
  latest_activity_at INTEGER,
  latest_activity_kind TEXT,
  latest_activity_message TEXT,
  summary_status_message TEXT,
  summary_failed_phase TEXT,
  summary_completed_phases INTEGER NOT NULL DEFAULT 0,
  prompt_analysis_type TEXT,
  prompt_active_phases_json TEXT,
  prompt_pack_id TEXT,
  prompt_pack_version TEXT,
  prompt_pack_mode TEXT,
  prompt_template_set_identity TEXT,
  prompt_template_set_hash TEXT,
  latest_phase_turn_id TEXT,
  log_file_name TEXT,
  run_json TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_session_bindings (
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_session_id TEXT NOT NULL,
  phase_turn_id TEXT,
  run_id TEXT,
  binding_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (thread_id, purpose)
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
`;

const FINAL_SCHEMA_SQL = `
-- No FK constraints on domain_events: events are an audit trail that may
-- reference entities not yet created (e.g. thread.created events are appended
-- in the same batch that creates the thread projection row). Orphan cleanup
-- is handled by workspace deletion logic, not by cascade constraints.
CREATE TABLE IF NOT EXISTS domain_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  run_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  recorded_at INTEGER NOT NULL,
  command_id TEXT,
  receipt_id TEXT,
  correlation_id TEXT,
  causation_id TEXT,
  caused_by_event_id TEXT,
  producer TEXT NOT NULL,
  schema_version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS phase_turn_summaries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  turn_index INTEGER NOT NULL,
  status TEXT NOT NULL,
  prompt_pack_id TEXT,
  prompt_pack_version TEXT,
  prompt_pack_mode TEXT,
  prompt_template_identity TEXT,
  prompt_template_hash TEXT,
  prompt_effective_prompt_hash TEXT,
  prompt_variant TEXT,
  activity_last_kind TEXT,
  activity_last_message TEXT,
  activity_last_occurred_at INTEGER,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  last_event_id TEXT NOT NULL,
  failure_json TEXT,
  phase_turn_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(run_id, phase, turn_index)
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
CREATE INDEX IF NOT EXISTS idx_provider_session_bindings_thread_id ON provider_session_bindings(thread_id);
CREATE INDEX IF NOT EXISTS idx_command_receipts_receipt_id ON command_receipts(receipt_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_events_sequence ON domain_events(sequence);
CREATE INDEX IF NOT EXISTS idx_domain_events_workspace_sequence ON domain_events(workspace_id, sequence);
CREATE INDEX IF NOT EXISTS idx_domain_events_thread_sequence ON domain_events(thread_id, sequence);
CREATE INDEX IF NOT EXISTS idx_domain_events_run_sequence ON domain_events(run_id, sequence);
CREATE INDEX IF NOT EXISTS idx_domain_events_command_id ON domain_events(command_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_caused_by_event_id ON domain_events(caused_by_event_id);
CREATE INDEX IF NOT EXISTS idx_phase_turn_summaries_run_id ON phase_turn_summaries(run_id);
`;

function getUserVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get() as
    | { user_version?: number }
    | undefined;
  return Number(row?.user_version ?? 0);
}

function getColumnNames(db: DatabaseSync, tableName: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name?: string;
  }>;
  return new Set(rows.map((row) => String(row.name)));
}

function ensureColumn(
  db: DatabaseSync,
  tableName: string,
  columnName: string,
  columnSql: string,
): void {
  if (getColumnNames(db, tableName).has(columnName)) {
    return;
  }
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
}

function recordMigration(db: DatabaseSync, version: number): void {
  db.prepare(
    `INSERT OR IGNORE INTO schema_migrations (version, applied_at)
     VALUES ($version, $appliedAt)`,
  ).run({
    $version: version,
    $appliedAt: Date.now(),
  });
  db.exec(`PRAGMA user_version = ${version}`);
}

function tableExists(db: DatabaseSync, tableName: string): boolean {
  const row = db
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table'
         AND name = $tableName
       LIMIT 1`,
    )
    .get({ $tableName: tableName }) as { name?: string } | undefined;
  return Boolean(row?.name);
}

function providerSessionBindingsNeedMigration(db: DatabaseSync): boolean {
  return (
    tableExists(db, "provider_session_bindings") &&
    !getColumnNames(db, "provider_session_bindings").has("purpose")
  );
}

function migrateProviderSessionBindingsToPurposeKey(db: DatabaseSync): void {
  if (!providerSessionBindingsNeedMigration(db)) {
    return;
  }

  db.exec(`
    BEGIN TRANSACTION;

    ALTER TABLE provider_session_bindings RENAME TO provider_session_bindings_legacy;

    CREATE TABLE provider_session_bindings (
      thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_session_id TEXT NOT NULL,
      phase_turn_id TEXT,
      run_id TEXT,
      binding_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (thread_id, purpose)
    );

    INSERT INTO provider_session_bindings (
      thread_id,
      purpose,
      workspace_id,
      provider,
      provider_session_id,
      phase_turn_id,
      run_id,
      binding_json,
      updated_at
    )
    SELECT
      thread_id,
      'chat',
      workspace_id,
      provider,
      provider_session_id,
      NULL,
      run_id,
      binding_json,
      updated_at
    FROM provider_session_bindings_legacy;

    DROP TABLE provider_session_bindings_legacy;

    COMMIT;
  `);
}

function ensureProjectionColumns(db: DatabaseSync): void {
  ensureColumn(
    db,
    "threads",
    "is_primary",
    "is_primary INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(db, "threads", "latest_run_id", "latest_run_id TEXT");
  ensureColumn(
    db,
    "threads",
    "latest_activity_at",
    "latest_activity_at INTEGER",
  );
  ensureColumn(
    db,
    "threads",
    "latest_terminal_status",
    "latest_terminal_status TEXT",
  );
  ensureColumn(db, "threads", "summary", "summary TEXT");

  ensureColumn(db, "runs", "run_kind", "run_kind TEXT");
  ensureColumn(db, "runs", "active_phase", "active_phase TEXT");
  ensureColumn(
    db,
    "runs",
    "progress_completed",
    "progress_completed INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    db,
    "runs",
    "progress_total",
    "progress_total INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(db, "runs", "failure_json", "failure_json TEXT");
  ensureColumn(db, "runs", "latest_activity_at", "latest_activity_at INTEGER");
  ensureColumn(db, "runs", "latest_activity_kind", "latest_activity_kind TEXT");
  ensureColumn(
    db,
    "runs",
    "latest_activity_message",
    "latest_activity_message TEXT",
  );
  ensureColumn(
    db,
    "runs",
    "summary_status_message",
    "summary_status_message TEXT",
  );
  ensureColumn(db, "runs", "summary_failed_phase", "summary_failed_phase TEXT");
  ensureColumn(
    db,
    "runs",
    "summary_completed_phases",
    "summary_completed_phases INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(db, "runs", "prompt_analysis_type", "prompt_analysis_type TEXT");
  ensureColumn(
    db,
    "runs",
    "prompt_active_phases_json",
    "prompt_active_phases_json TEXT",
  );
  ensureColumn(
    db,
    "runs",
    "prompt_template_set_identity",
    "prompt_template_set_identity TEXT",
  );
  ensureColumn(db, "runs", "prompt_pack_id", "prompt_pack_id TEXT");
  ensureColumn(db, "runs", "prompt_pack_version", "prompt_pack_version TEXT");
  ensureColumn(db, "runs", "prompt_pack_mode", "prompt_pack_mode TEXT");
  ensureColumn(
    db,
    "runs",
    "prompt_template_set_hash",
    "prompt_template_set_hash TEXT",
  );
  ensureColumn(db, "runs", "latest_phase_turn_id", "latest_phase_turn_id TEXT");
  ensureColumn(db, "runs", "log_file_name", "log_file_name TEXT");

  ensureColumn(db, "activities", "phase", "phase TEXT");
  ensureColumn(
    db,
    "activities",
    "event_sequence",
    "event_sequence INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    db,
    "activities",
    "caused_by_event_id",
    "caused_by_event_id TEXT",
  );
  ensureColumn(db, "activities", "occurred_at", "occurred_at INTEGER");
  ensureColumn(db, "activities", "scope", "scope TEXT");
  ensureColumn(db, "activities", "status", "status TEXT");

  ensureColumn(
    db,
    "phase_turn_summaries",
    "prompt_pack_id",
    "prompt_pack_id TEXT",
  );
  ensureColumn(
    db,
    "phase_turn_summaries",
    "prompt_pack_version",
    "prompt_pack_version TEXT",
  );
  ensureColumn(
    db,
    "phase_turn_summaries",
    "prompt_pack_mode",
    "prompt_pack_mode TEXT",
  );
  ensureColumn(
    db,
    "phase_turn_summaries",
    "prompt_template_identity",
    "prompt_template_identity TEXT",
  );
  ensureColumn(
    db,
    "phase_turn_summaries",
    "prompt_template_hash",
    "prompt_template_hash TEXT",
  );
  ensureColumn(
    db,
    "phase_turn_summaries",
    "prompt_effective_prompt_hash",
    "prompt_effective_prompt_hash TEXT",
  );
  ensureColumn(
    db,
    "phase_turn_summaries",
    "prompt_variant",
    "prompt_variant TEXT",
  );
  ensureColumn(
    db,
    "phase_turn_summaries",
    "activity_last_kind",
    "activity_last_kind TEXT",
  );
  ensureColumn(
    db,
    "phase_turn_summaries",
    "activity_last_message",
    "activity_last_message TEXT",
  );
  ensureColumn(
    db,
    "phase_turn_summaries",
    "activity_last_occurred_at",
    "activity_last_occurred_at INTEGER",
  );
}

export function initializeWorkspaceSchema(db: DatabaseSync): void {
  db.exec(BASE_SCHEMA_SQL);
  db.exec(FINAL_SCHEMA_SQL);
  ensureProjectionColumns(db);

  const currentVersion = getUserVersion(db);
  if (currentVersion < WORKSPACE_SCHEMA_VERSION) {
    if (currentVersion < 5) {
      migrateProviderSessionBindingsToPurposeKey(db);
    }
    recordMigration(db, WORKSPACE_SCHEMA_VERSION);
  }
}
