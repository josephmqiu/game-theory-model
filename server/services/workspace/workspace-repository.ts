import type { DatabaseSync } from "node:sqlite";
import type { Analysis } from "../../../shared/types/entity";
import { stringifyJson, toNullableText } from "./sqlite-json";
import type { WorkspaceRecord } from "./workspace-types";

export interface WorkspaceRepository {
  getWorkspace(id: string): WorkspaceRecord | undefined;
  listWorkspaces(): WorkspaceRecord[];
  upsertWorkspace(workspace: WorkspaceRecord): WorkspaceRecord;
  clear(): void;
}

function mapWorkspaceRow(row: Record<string, unknown>): WorkspaceRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    analysisType: String(row.analysis_type),
    filePath: row.file_path === null ? null : String(row.file_path),
    workspaceJson: String(row.workspace_json),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function createWorkspaceRepository(
  db: DatabaseSync,
): WorkspaceRepository {
  const getStatement = db.prepare(
    `SELECT id, name, analysis_type, file_path, workspace_json, created_at, updated_at
     FROM workspaces
     WHERE id = $id
     LIMIT 1`,
  );
  const listStatement = db.prepare(
    `SELECT id, name, analysis_type, file_path, workspace_json, created_at, updated_at
     FROM workspaces
     ORDER BY updated_at DESC, id ASC`,
  );
  const upsertStatement = db.prepare(
    `INSERT INTO workspaces (
       id, name, analysis_type, file_path, workspace_json, created_at, updated_at
     ) VALUES (
       $id, $name, $analysisType, $filePath, $workspaceJson, $createdAt, $updatedAt
     )
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       analysis_type = excluded.analysis_type,
       file_path = excluded.file_path,
       workspace_json = excluded.workspace_json,
       updated_at = excluded.updated_at`,
  );
  const clearStatement = db.prepare(`DELETE FROM workspaces`);

  return {
    getWorkspace(id) {
      const row = getStatement.get({ $id: id });
      return row ? mapWorkspaceRow(row) : undefined;
    },
    listWorkspaces() {
      return listStatement.all().map((row) => mapWorkspaceRow(row));
    },
    upsertWorkspace(workspace) {
      upsertStatement.run({
        $id: workspace.id,
        $name: workspace.name,
        $analysisType: workspace.analysisType,
        $filePath: toNullableText(workspace.filePath),
        $workspaceJson: workspace.workspaceJson,
        $createdAt: workspace.createdAt,
        $updatedAt: workspace.updatedAt,
      });

      const stored = getStatement.get({ $id: workspace.id });
      if (!stored) {
        throw new Error(`Failed to persist workspace "${workspace.id}".`);
      }
      return mapWorkspaceRow(stored);
    },
    clear() {
      clearStatement.run();
    },
  };
}

/** Used for initial/empty workspace creation where no entity data exists yet. */
export function createWorkspaceRecordFromSnapshot(input: {
  id: string;
  name: string;
  analysisType: string;
  filePath?: string | null;
  snapshot: unknown;
  createdAt?: number;
  updatedAt?: number;
}): WorkspaceRecord {
  const now = Date.now();
  return {
    id: input.id,
    name: input.name,
    analysisType: input.analysisType,
    filePath: toNullableText(input.filePath),
    workspaceJson: stringifyJson(input.snapshot),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

/**
 * Build a WorkspaceRecord where entity data is guaranteed to come from the
 * canonical `analysis` parameter (should be entityGraphService.getAnalysis()).
 * Non-entity fields (layout, threads, etc.) come from `nonEntityFields`.
 */
export function createCanonicalWorkspaceRecord(input: {
  id: string;
  name: string;
  analysisType: string;
  filePath?: string | null;
  analysis: Readonly<Analysis>;
  nonEntityFields: {
    layout?: unknown;
    threads?: unknown[];
    artifacts?: unknown[];
    checkpointHeaders?: unknown[];
    pendingQuestions?: unknown[];
  };
  createdAt?: number;
  updatedAt?: number;
}): WorkspaceRecord {
  const now = Date.now();
  const snapshot = {
    id: input.id,
    name: input.name,
    analysisType: input.analysisType,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    analysis: input.analysis,
    layout: input.nonEntityFields.layout ?? {},
    threads: input.nonEntityFields.threads ?? [],
    artifacts: input.nonEntityFields.artifacts ?? [],
    checkpointHeaders: input.nonEntityFields.checkpointHeaders ?? [],
    pendingQuestions: input.nonEntityFields.pendingQuestions ?? [],
  };
  return {
    id: input.id,
    name: input.name,
    analysisType: input.analysisType,
    filePath: toNullableText(input.filePath),
    workspaceJson: stringifyJson(snapshot),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
