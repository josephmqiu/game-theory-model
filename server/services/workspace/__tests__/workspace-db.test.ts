import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  createWorkspaceDatabase,
} from "../workspace-db";
import { initializeWorkspaceSchema } from "../workspace-schema";
import { createWorkspaceRecordFromSnapshot } from "../workspace-repository";

describe("workspace database", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (!dir) continue;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createDatabasePath(): string {
    const tempDir = mkdtempSync(join(tmpdir(), "gta-workspace-"));
    tempDirs.push(tempDir);
    return join(tempDir, "workspace-state.sqlite");
  }

  it("initializes the schema idempotently and persists workspace rows", () => {
    const databasePath = createDatabasePath();
    const database = createWorkspaceDatabase({ databasePath });

    initializeWorkspaceSchema(database.db);

    const tableNames = database.db
      .prepare(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table'
         ORDER BY name ASC`,
      )
      .all()
      .map((row) => String(row.name));

    expect(tableNames).toEqual(
      expect.arrayContaining([
        "activities",
        "command_receipts",
        "domain_events",
        "messages",
        "phase_turn_summaries",
        "provider_session_bindings",
        "runs",
        "schema_migrations",
        "threads",
        "workspaces",
      ]),
    );

    const migrationCount = database.db
      .prepare(`SELECT COUNT(*) AS count FROM schema_migrations`)
      .get();
    expect(Number(migrationCount?.count)).toBe(1);

    const runColumns = database.db
      .prepare(`PRAGMA table_info(runs)`)
      .all()
      .map((row) => String(row.name));
    expect(runColumns).toEqual(
      expect.arrayContaining([
        "summary_status_message",
        "summary_failed_phase",
        "summary_completed_phases",
        "prompt_analysis_type",
        "prompt_active_phases_json",
        "prompt_pack_id",
        "prompt_pack_version",
        "prompt_pack_mode",
        "prompt_template_set_identity",
        "prompt_template_set_hash",
        "latest_phase_turn_id",
        "log_file_name",
      ]),
    );

    const phaseTurnColumns = database.db
      .prepare(`PRAGMA table_info(phase_turn_summaries)`)
      .all()
      .map((row) => String(row.name));
    expect(phaseTurnColumns).toEqual(
      expect.arrayContaining([
        "prompt_pack_id",
        "prompt_pack_version",
        "prompt_pack_mode",
        "prompt_template_identity",
        "prompt_template_hash",
        "prompt_effective_prompt_hash",
        "prompt_variant",
        "activity_last_kind",
        "activity_last_message",
        "activity_last_occurred_at",
      ]),
    );

    const bindingColumns = database.db
      .prepare(`PRAGMA table_info(provider_session_bindings)`)
      .all()
      .map((row) => String(row.name));
    expect(bindingColumns).toEqual(
      expect.arrayContaining([
        "thread_id",
        "purpose",
        "workspace_id",
        "provider",
        "provider_session_id",
        "phase_turn_id",
        "run_id",
        "binding_json",
        "updated_at",
      ]),
    );

    const workspace = createWorkspaceRecordFromSnapshot({
      id: "workspace-1",
      name: "Trade war",
      analysisType: "game-theory",
      snapshot: {
        analysis: { id: "analysis-1", name: "Trade war" },
        layout: {},
      },
      createdAt: 100,
      updatedAt: 200,
    });

    const stored = database.workspaces.upsertWorkspace(workspace);
    expect(stored).toEqual(workspace);
    expect(database.workspaces.getWorkspace("workspace-1")).toEqual(workspace);
    expect(database.workspaces.listWorkspaces()).toEqual([workspace]);

    database.close();
  });

  it("migrates legacy provider session bindings to purpose-keyed rows", () => {
    const databasePath = createDatabasePath();
    const legacyDb = new DatabaseSync(databasePath, {
      enableForeignKeyConstraints: true,
      timeout: 5_000,
    });

    legacyDb.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        analysis_type TEXT NOT NULL,
        file_path TEXT,
        workspace_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        thread_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE provider_session_bindings (
        thread_id TEXT PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_session_id TEXT NOT NULL,
        run_id TEXT,
        binding_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO workspaces (
        id, name, analysis_type, file_path, workspace_json, created_at, updated_at
      ) VALUES (
        'workspace-1',
        'Workspace',
        'game-theory',
        NULL,
        '{}',
        100,
        100
      );
      INSERT INTO threads (
        id, workspace_id, title, thread_json, created_at, updated_at
      ) VALUES (
        'thread-1',
        'workspace-1',
        'Thread',
        '{}',
        100,
        100
      );
      INSERT INTO provider_session_bindings (
        thread_id,
        workspace_id,
        provider,
        provider_session_id,
        run_id,
        binding_json,
        updated_at
      ) VALUES (
        'thread-1',
        'workspace-1',
        'claude',
        'session-legacy',
        'run-legacy',
        '{"version":1,"provider":"claude","workspaceId":"workspace-1","threadId":"thread-1","purpose":"chat","runId":"run-legacy","providerSessionId":"session-legacy","updatedAt":100}',
        100
      );
      PRAGMA user_version = 4;
    `);
    legacyDb.close();

    const database = createWorkspaceDatabase({ databasePath });

    const binding = database.providerSessionBindings.getBinding(
      "thread-1",
      "chat",
    );
    expect(binding).toMatchObject({
      threadId: "thread-1",
      purpose: "chat",
      workspaceId: "workspace-1",
      provider: "claude",
      providerSessionId: "session-legacy",
      phaseTurnId: null,
      runId: "run-legacy",
    });

    const columns = database.db
      .prepare(`PRAGMA table_info(provider_session_bindings)`)
      .all()
      .map((row) => String(row.name));
    expect(columns).toEqual(
      expect.arrayContaining(["purpose", "phase_turn_id"]),
    );

    database.close();
  });
});
