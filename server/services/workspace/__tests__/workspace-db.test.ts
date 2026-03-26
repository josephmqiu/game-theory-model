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
        "prompt_template_identity",
        "prompt_template_hash",
        "prompt_effective_prompt_hash",
        "prompt_variant",
        "activity_last_kind",
        "activity_last_message",
        "activity_last_occurred_at",
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
});
