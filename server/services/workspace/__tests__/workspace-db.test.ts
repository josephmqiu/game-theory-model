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
        "messages",
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
