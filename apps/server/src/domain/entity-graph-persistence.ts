// entity-graph-persistence.ts — SQLite write-through bridge for entity-graph-service.
//
// The entity-graph-service is a module-level singleton (not an Effect service).
// This bridge opens a direct synchronous SQLite connection so that every
// create/update/delete in the entity graph writes through to disk.
// On server startup, loadFromDisk() hydrates the in-memory singleton.
//
// The connection shares the same database file as the Effect SqlClient
// (state.sqlite) and is opened AFTER migrations have run.

import type {
  Analysis,
  AnalysisEntity,
  AnalysisRelationship,
  EntityProvenance,
} from "./types/entity";
import { normalizePhaseStates } from "./types/methodology";

// ── Database handle ──

interface SyncDatabase {
  run(sql: string, ...params: unknown[]): void;
  all(sql: string, ...params: unknown[]): Record<string, unknown>[];
  get(sql: string, ...params: unknown[]): Record<string, unknown> | undefined;
  close(): void;
}

let db: SyncDatabase | null = null;

// ── Initialization ──

/**
 * Open a synchronous SQLite connection for entity graph persistence.
 * Must be called AFTER Effect migrations have run (which create the tables).
 */
export function init(dbPath: string): void {
  if (db) return; // already initialized

  if (typeof process !== "undefined" && process.versions?.bun) {
    // Bun runtime — dynamic require to avoid compile-time dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BunSqlite = require("bun:sqlite") as any;
    const bunDb = new BunSqlite.Database(dbPath) as any;
    bunDb.run("PRAGMA journal_mode = WAL;");
    bunDb.run("PRAGMA foreign_keys = ON;");
    db = {
      run: (sql, ...params) => bunDb.run(sql, ...params),
      all: (sql, ...params) =>
        bunDb.query(sql).all(...params) as Record<string, unknown>[],
      get: (sql, ...params) =>
        bunDb.query(sql).get(...params) as Record<string, unknown> | undefined,
      close: () => bunDb.close(),
    };
  } else {
    // Node runtime (node:sqlite DatabaseSync) — dynamic require
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NodeSqlite = require("node:sqlite") as any;
    const nodeDb = new NodeSqlite.DatabaseSync(dbPath) as any;
    nodeDb.exec("PRAGMA journal_mode = WAL;");
    nodeDb.exec("PRAGMA foreign_keys = ON;");
    db = {
      run: (sql, ...params) => {
        const stmt = nodeDb.prepare(sql);
        stmt.run(...params);
      },
      all: (sql, ...params) => {
        const stmt = nodeDb.prepare(sql);
        return stmt.all(...params) as Record<string, unknown>[];
      },
      get: (sql, ...params) => {
        const stmt = nodeDb.prepare(sql);
        return stmt.get(...params) as Record<string, unknown> | undefined;
      },
      close: () => nodeDb.close(),
    };
  }
}

export function isInitialized(): boolean {
  return db !== null;
}

function requireDb(): SyncDatabase {
  if (!db) {
    throw new Error(
      "entity-graph-persistence: not initialized. Call init(dbPath) after migrations.",
    );
  }
  return db;
}

// ── Helpers ──

function now(): string {
  return new Date().toISOString();
}

function serializeProvenance(p: EntityProvenance | undefined): string | null {
  return p ? JSON.stringify(p) : null;
}

function deserializeProvenance(
  json: string | null | undefined,
): EntityProvenance | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as EntityProvenance;
  } catch {
    return undefined;
  }
}

// ── Analysis state ──

export function saveAnalysisState(analysis: Analysis): void {
  const d = requireDb();
  const timestamp = now();
  d.run(
    `INSERT INTO analysis_state (id, analysis_id, name, topic, created_at, updated_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       analysis_id = excluded.analysis_id,
       name = excluded.name,
       topic = excluded.topic,
       updated_at = excluded.updated_at`,
    analysis.id,
    analysis.name ?? "",
    analysis.topic ?? "",
    timestamp,
    timestamp,
  );
}

export function clearAnalysisState(): void {
  const d = requireDb();
  d.run("DELETE FROM analysis_state");
  d.run("DELETE FROM analysis_entities");
  d.run("DELETE FROM analysis_relationships");
}

// ── Entity persistence ──

export function insertEntity(entity: AnalysisEntity): void {
  const d = requireDb();
  const timestamp = now();
  d.run(
    `INSERT OR REPLACE INTO analysis_entities
     (id, run_id, phase, type, data_json, confidence, rationale, source, revision, stale, entity_group, provenance_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entity.id,
    entity.provenance?.runId ?? null,
    entity.phase,
    entity.type,
    JSON.stringify(entity.data),
    entity.confidence,
    entity.rationale,
    entity.source,
    entity.revision,
    entity.stale ? 1 : 0,
    entity.group ?? null,
    serializeProvenance(entity.provenance),
    timestamp,
    timestamp,
  );
}

export function updateEntityRow(id: string, entity: AnalysisEntity): void {
  const d = requireDb();
  d.run(
    `UPDATE analysis_entities SET
       phase = ?, type = ?, data_json = ?, confidence = ?, rationale = ?,
       source = ?, revision = ?, stale = ?, entity_group = ?,
       provenance_json = ?, updated_at = ?
     WHERE id = ?`,
    entity.phase,
    entity.type,
    JSON.stringify(entity.data),
    entity.confidence,
    entity.rationale,
    entity.source,
    entity.revision,
    entity.stale ? 1 : 0,
    entity.group ?? null,
    serializeProvenance(entity.provenance),
    now(),
    id,
  );
}

export function deleteEntity(id: string): void {
  const d = requireDb();
  d.run(
    "DELETE FROM analysis_relationships WHERE from_entity_id = ? OR to_entity_id = ?",
    id,
    id,
  );
  d.run("DELETE FROM analysis_entities WHERE id = ?", id);
}

export function updateEntityStale(entityIds: string[], stale: boolean): void {
  if (entityIds.length === 0) return;
  const d = requireDb();
  const placeholders = entityIds.map(() => "?").join(",");
  d.run(
    `UPDATE analysis_entities SET stale = ?, updated_at = ? WHERE id IN (${placeholders})`,
    stale ? 1 : 0,
    now(),
    ...entityIds,
  );
}

export function deleteEntitiesByIds(ids: string[]): void {
  if (ids.length === 0) return;
  const d = requireDb();
  const placeholders = ids.map(() => "?").join(",");
  d.run(
    `DELETE FROM analysis_relationships WHERE from_entity_id IN (${placeholders}) OR to_entity_id IN (${placeholders})`,
    ...ids,
    ...ids,
  );
  d.run(`DELETE FROM analysis_entities WHERE id IN (${placeholders})`, ...ids);
}

// ── Relationship persistence ──

export function insertRelationship(rel: AnalysisRelationship): void {
  const d = requireDb();
  d.run(
    `INSERT OR REPLACE INTO analysis_relationships
     (id, run_id, type, from_entity_id, to_entity_id, metadata_json, source, provenance_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    rel.id,
    rel.provenance?.runId ?? null,
    rel.type,
    rel.fromEntityId,
    rel.toEntityId,
    rel.metadata ? JSON.stringify(rel.metadata) : null,
    rel.source ?? null,
    serializeProvenance(rel.provenance),
    now(),
  );
}

export function deleteRelationship(id: string): void {
  const d = requireDb();
  d.run("DELETE FROM analysis_relationships WHERE id = ?", id);
}

// ── Load from disk ──

/**
 * Load the full analysis state from SQLite.
 * Returns null if no analysis state exists on disk.
 */
export function loadFromDisk(): Analysis | null {
  const d = requireDb();

  // Load analysis state
  const stateRow = d.get("SELECT * FROM analysis_state WHERE id = 1");
  if (!stateRow) return null;

  // Load all entities
  const entityRows = d.all(
    "SELECT * FROM analysis_entities ORDER BY created_at ASC",
  );
  const entities: AnalysisEntity[] = entityRows.map((row) => ({
    id: row.id as string,
    type: row.type as AnalysisEntity["type"],
    phase: row.phase as AnalysisEntity["phase"],
    data: JSON.parse(row.data_json as string),
    confidence: (row.confidence as AnalysisEntity["confidence"]) ?? "medium",
    source: (row.source as AnalysisEntity["source"]) ?? "ai",
    rationale: (row.rationale as string) ?? "",
    revision: (row.revision as number) ?? 1,
    stale: Boolean(row.stale),
    ...(row.entity_group ? { group: row.entity_group as string } : {}),
    provenance: deserializeProvenance(row.provenance_json as string | null),
  }));

  // Load all relationships
  const relRows = d.all(
    "SELECT * FROM analysis_relationships ORDER BY created_at ASC",
  );
  const relationships: AnalysisRelationship[] = relRows.map((row) => ({
    id: row.id as string,
    type: row.type as AnalysisRelationship["type"],
    fromEntityId: row.from_entity_id as string,
    toEntityId: row.to_entity_id as string,
    ...(row.metadata_json
      ? { metadata: JSON.parse(row.metadata_json as string) }
      : {}),
    ...(row.source
      ? { source: row.source as AnalysisRelationship["source"] }
      : {}),
    provenance: deserializeProvenance(row.provenance_json as string | null),
  }));

  return {
    id: stateRow.analysis_id as string,
    name: (stateRow.name as string) ?? "",
    topic: (stateRow.topic as string) ?? "",
    entities,
    relationships,
    phases: normalizePhaseStates([], entities),
  };
}

// ── Shutdown ──

export function close(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ── Testing ──

/** Reset persistence state. Only for use in tests. */
export function _resetForTest(): void {
  db = null;
}
