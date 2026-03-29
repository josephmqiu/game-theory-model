import type { DatabaseSync } from "node:sqlite";
import type {
  Analysis,
  AnalysisEntity,
  AnalysisRelationship,
} from "../../../shared/types/entity";
import type { PhaseState } from "../../../src/types/methodology";
import { parseJsonColumn, stringifyJson } from "./sqlite-json";

export interface EntityGraphRepository {
  // Metadata
  getAnalysisMetadata(
    workspaceId: string,
  ): { analysisId: string; name: string; topic: string } | undefined;
  upsertAnalysisMetadata(
    workspaceId: string,
    analysisId: string,
    name: string,
    topic: string,
  ): void;

  // Entities
  listEntities(analysisId: string): AnalysisEntity[];
  listStaleEntityIds(analysisId: string): string[];
  upsertEntity(
    workspaceId: string,
    analysisId: string,
    entity: AnalysisEntity,
  ): void;
  deleteEntity(id: string): void;
  updateStaleFlags(ids: string[], stale: boolean): void;
  deleteEntitiesByIds(ids: string[]): void;

  // Relationships
  listRelationships(analysisId: string): AnalysisRelationship[];
  upsertRelationship(
    workspaceId: string,
    analysisId: string,
    rel: AnalysisRelationship,
  ): void;
  deleteRelationship(id: string): void;
  deleteRelationshipsByEntityIds(entityIds: string[]): void;

  // Phase states
  listPhaseStates(analysisId: string): PhaseState[];
  upsertPhaseState(
    workspaceId: string,
    analysisId: string,
    phase: string,
    state: PhaseState,
  ): void;
  clearPhaseStates(analysisId: string): void;

  // Bulk
  replaceAnalysis(workspaceId: string, analysis: Analysis): void;
  clearForWorkspace(workspaceId: string): void;
  clear(): void;
}

// ── Row mappers ──

function mapEntityRow(row: Record<string, unknown>): AnalysisEntity {
  return parseJsonColumn<AnalysisEntity>(
    row.entity_json,
    "graph_entities.entity_json",
  );
}

function mapRelationshipRow(
  row: Record<string, unknown>,
): AnalysisRelationship {
  return parseJsonColumn<AnalysisRelationship>(
    row.relationship_json,
    "graph_relationships.relationship_json",
  );
}

function mapPhaseStateRow(row: Record<string, unknown>): PhaseState {
  return parseJsonColumn<PhaseState>(
    row.phase_state_json,
    "graph_phase_states.phase_state_json",
  );
}

// ── Factory ──

export function createEntityGraphRepository(
  db: DatabaseSync,
): EntityGraphRepository {
  // ── Metadata statements ──

  const getMetadataStatement = db.prepare(
    `SELECT analysis_id, name, topic
     FROM graph_analysis_metadata
     WHERE workspace_id = $workspaceId
     LIMIT 1`,
  );

  const upsertMetadataStatement = db.prepare(
    `INSERT INTO graph_analysis_metadata (
       analysis_id,
       workspace_id,
       name,
       topic,
       updated_at
     ) VALUES (
       $analysisId,
       $workspaceId,
       $name,
       $topic,
       $updatedAt
     )
     ON CONFLICT(analysis_id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       name = excluded.name,
       topic = excluded.topic,
       updated_at = excluded.updated_at`,
  );

  // ── Entity statements ──

  const listEntitiesStatement = db.prepare(
    `SELECT entity_json
     FROM graph_entities
     WHERE analysis_id = $analysisId
     ORDER BY created_at ASC, id ASC`,
  );

  const listStaleEntityIdsStatement = db.prepare(
    `SELECT id
     FROM graph_entities
     WHERE analysis_id = $analysisId AND stale = 1
     ORDER BY created_at ASC, id ASC`,
  );

  const upsertEntityStatement = db.prepare(
    `INSERT INTO graph_entities (
       id,
       workspace_id,
       analysis_id,
       type,
       phase,
       confidence,
       source,
       stale,
       "group",
       provenance_source,
       provenance_run_id,
       entity_json,
       created_at,
       updated_at
     ) VALUES (
       $id,
       $workspaceId,
       $analysisId,
       $type,
       $phase,
       $confidence,
       $source,
       $stale,
       $group,
       $provenanceSource,
       $provenanceRunId,
       $entityJson,
       $createdAt,
       $updatedAt
     )
     ON CONFLICT(id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       analysis_id = excluded.analysis_id,
       type = excluded.type,
       phase = excluded.phase,
       confidence = excluded.confidence,
       source = excluded.source,
       stale = excluded.stale,
       "group" = excluded."group",
       provenance_source = excluded.provenance_source,
       provenance_run_id = excluded.provenance_run_id,
       entity_json = excluded.entity_json,
       updated_at = excluded.updated_at`,
  );

  const deleteEntityStatement = db.prepare(
    `DELETE FROM graph_entities WHERE id = $id`,
  );

  const updateStaleFlagStatement = db.prepare(
    `UPDATE graph_entities
     SET stale = $stale, updated_at = $updatedAt
     WHERE id = $id`,
  );

  // ── Relationship statements ──

  const listRelationshipsStatement = db.prepare(
    `SELECT relationship_json
     FROM graph_relationships
     WHERE analysis_id = $analysisId
     ORDER BY created_at ASC, id ASC`,
  );

  const upsertRelationshipStatement = db.prepare(
    `INSERT INTO graph_relationships (
       id,
       workspace_id,
       analysis_id,
       type,
       from_entity_id,
       to_entity_id,
       relationship_json,
       created_at,
       updated_at
     ) VALUES (
       $id,
       $workspaceId,
       $analysisId,
       $type,
       $fromEntityId,
       $toEntityId,
       $relationshipJson,
       $createdAt,
       $updatedAt
     )
     ON CONFLICT(id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       analysis_id = excluded.analysis_id,
       type = excluded.type,
       from_entity_id = excluded.from_entity_id,
       to_entity_id = excluded.to_entity_id,
       relationship_json = excluded.relationship_json,
       updated_at = excluded.updated_at`,
  );

  const deleteRelationshipStatement = db.prepare(
    `DELETE FROM graph_relationships WHERE id = $id`,
  );

  const deleteRelsByEntityStatement = db.prepare(
    `DELETE FROM graph_relationships
     WHERE from_entity_id = $entityId OR to_entity_id = $entityId`,
  );

  // ── Phase state statements ──

  const listPhaseStatesStatement = db.prepare(
    `SELECT phase_state_json
     FROM graph_phase_states
     WHERE analysis_id = $analysisId
     ORDER BY phase ASC`,
  );

  const upsertPhaseStateStatement = db.prepare(
    `INSERT INTO graph_phase_states (
       workspace_id,
       analysis_id,
       phase,
       status,
       phase_state_json,
       updated_at
     ) VALUES (
       $workspaceId,
       $analysisId,
       $phase,
       $status,
       $phaseStateJson,
       $updatedAt
     )
     ON CONFLICT(workspace_id, analysis_id, phase) DO UPDATE SET
       status = excluded.status,
       phase_state_json = excluded.phase_state_json,
       updated_at = excluded.updated_at`,
  );

  const clearPhaseStatesStatement = db.prepare(
    `DELETE FROM graph_phase_states WHERE analysis_id = $analysisId`,
  );

  // ── Workspace-scoped clear statements ──

  const clearEntitiesForWorkspace = db.prepare(
    `DELETE FROM graph_entities WHERE workspace_id = $workspaceId`,
  );

  const clearRelationshipsForWorkspace = db.prepare(
    `DELETE FROM graph_relationships WHERE workspace_id = $workspaceId`,
  );

  const clearPhaseStatesForWorkspace = db.prepare(
    `DELETE FROM graph_phase_states WHERE workspace_id = $workspaceId`,
  );

  const clearMetadataForWorkspace = db.prepare(
    `DELETE FROM graph_analysis_metadata WHERE workspace_id = $workspaceId`,
  );

  // ── Repository ──

  return {
    // ── Metadata ──

    getAnalysisMetadata(workspaceId) {
      const row = getMetadataStatement.get({
        $workspaceId: workspaceId,
      }) as Record<string, unknown> | undefined;
      if (!row) return undefined;
      return {
        analysisId: row.analysis_id as string,
        name: row.name as string,
        topic: row.topic as string,
      };
    },

    upsertAnalysisMetadata(workspaceId, analysisId, name, topic) {
      upsertMetadataStatement.run({
        $analysisId: analysisId,
        $workspaceId: workspaceId,
        $name: name,
        $topic: topic,
        $updatedAt: Date.now(),
      });
    },

    // ── Entities ──

    listEntities(analysisId) {
      return listEntitiesStatement
        .all({ $analysisId: analysisId })
        .map((row) => mapEntityRow(row as Record<string, unknown>));
    },

    listStaleEntityIds(analysisId) {
      return listStaleEntityIdsStatement
        .all({ $analysisId: analysisId })
        .map((row) => (row as Record<string, unknown>).id as string);
    },

    upsertEntity(workspaceId, analysisId, entity) {
      upsertEntityStatement.run({
        $id: entity.id,
        $workspaceId: workspaceId,
        $analysisId: analysisId,
        $type: entity.type,
        $phase: entity.phase,
        $confidence: entity.confidence,
        $source: entity.source,
        $stale: entity.stale ? 1 : 0,
        $group: entity.group ?? null,
        $provenanceSource: entity.provenance?.source ?? null,
        $provenanceRunId: entity.provenance?.runId ?? null,
        $entityJson: stringifyJson(entity),
        $createdAt: entity.provenance?.timestamp ?? Date.now(),
        $updatedAt: Date.now(),
      });
    },

    deleteEntity(id) {
      deleteEntityStatement.run({ $id: id });
    },

    updateStaleFlags(ids, stale) {
      if (ids.length === 0) return;
      const flag = stale ? 1 : 0;
      for (const id of ids) {
        updateStaleFlagStatement.run({
          $id: id,
          $stale: flag,
          $updatedAt: Date.now(),
        });
      }
    },

    deleteEntitiesByIds(ids) {
      for (const id of ids) {
        deleteEntityStatement.run({ $id: id });
      }
    },

    // ── Relationships ──

    listRelationships(analysisId) {
      return listRelationshipsStatement
        .all({ $analysisId: analysisId })
        .map((row) => mapRelationshipRow(row as Record<string, unknown>));
    },

    upsertRelationship(workspaceId, analysisId, rel) {
      upsertRelationshipStatement.run({
        $id: rel.id,
        $workspaceId: workspaceId,
        $analysisId: analysisId,
        $type: rel.type,
        $fromEntityId: rel.fromEntityId,
        $toEntityId: rel.toEntityId,
        $relationshipJson: stringifyJson(rel),
        $createdAt: rel.provenance?.timestamp ?? Date.now(),
        $updatedAt: Date.now(),
      });
    },

    deleteRelationship(id) {
      deleteRelationshipStatement.run({ $id: id });
    },

    deleteRelationshipsByEntityIds(entityIds) {
      for (const id of entityIds) {
        deleteRelsByEntityStatement.run({ $entityId: id });
      }
    },

    // ── Phase states ──

    listPhaseStates(analysisId) {
      return listPhaseStatesStatement
        .all({ $analysisId: analysisId })
        .map((row) => mapPhaseStateRow(row as Record<string, unknown>));
    },

    upsertPhaseState(workspaceId, analysisId, phase, state) {
      upsertPhaseStateStatement.run({
        $workspaceId: workspaceId,
        $analysisId: analysisId,
        $phase: phase,
        $status: state.status,
        $phaseStateJson: stringifyJson(state),
        $updatedAt: Date.now(),
      });
    },

    clearPhaseStates(analysisId) {
      clearPhaseStatesStatement.run({ $analysisId: analysisId });
    },

    // ── Bulk ──

    replaceAnalysis(workspaceId, analysis) {
      db.exec("SAVEPOINT replace_analysis");
      try {
        // Clear existing data for this workspace
        clearEntitiesForWorkspace.run({ $workspaceId: workspaceId });
        clearRelationshipsForWorkspace.run({ $workspaceId: workspaceId });
        clearPhaseStatesForWorkspace.run({ $workspaceId: workspaceId });
        clearMetadataForWorkspace.run({ $workspaceId: workspaceId });

        // Insert metadata
        upsertMetadataStatement.run({
          $analysisId: analysis.id,
          $workspaceId: workspaceId,
          $name: analysis.name,
          $topic: analysis.topic,
          $updatedAt: Date.now(),
        });

        // Insert all entities
        for (const entity of analysis.entities) {
          upsertEntityStatement.run({
            $id: entity.id,
            $workspaceId: workspaceId,
            $analysisId: analysis.id,
            $type: entity.type,
            $phase: entity.phase,
            $confidence: entity.confidence,
            $source: entity.source,
            $stale: entity.stale ? 1 : 0,
            $group: entity.group ?? null,
            $provenanceSource: entity.provenance?.source ?? null,
            $provenanceRunId: entity.provenance?.runId ?? null,
            $entityJson: stringifyJson(entity),
            $createdAt: entity.provenance?.timestamp ?? Date.now(),
            $updatedAt: Date.now(),
          });
        }

        // Insert all relationships
        for (const rel of analysis.relationships) {
          upsertRelationshipStatement.run({
            $id: rel.id,
            $workspaceId: workspaceId,
            $analysisId: analysis.id,
            $type: rel.type,
            $fromEntityId: rel.fromEntityId,
            $toEntityId: rel.toEntityId,
            $relationshipJson: stringifyJson(rel),
            $createdAt: rel.provenance?.timestamp ?? Date.now(),
            $updatedAt: Date.now(),
          });
        }

        // Insert all phase states
        for (const phase of analysis.phases) {
          upsertPhaseStateStatement.run({
            $workspaceId: workspaceId,
            $analysisId: analysis.id,
            $phase: phase.phase,
            $status: phase.status,
            $phaseStateJson: stringifyJson(phase),
            $updatedAt: Date.now(),
          });
        }

        db.exec("RELEASE replace_analysis");
      } catch (error) {
        db.exec("ROLLBACK TO replace_analysis");
        throw error;
      }
    },

    clearForWorkspace(workspaceId) {
      db.exec("SAVEPOINT clear_workspace");
      try {
        clearEntitiesForWorkspace.run({ $workspaceId: workspaceId });
        clearRelationshipsForWorkspace.run({ $workspaceId: workspaceId });
        clearPhaseStatesForWorkspace.run({ $workspaceId: workspaceId });
        clearMetadataForWorkspace.run({ $workspaceId: workspaceId });
        db.exec("RELEASE clear_workspace");
      } catch (error) {
        db.exec("ROLLBACK TO clear_workspace");
        throw error;
      }
    },

    clear() {
      db.prepare("DELETE FROM graph_entities").run();
      db.prepare("DELETE FROM graph_relationships").run();
      db.prepare("DELETE FROM graph_phase_states").run();
      db.prepare("DELETE FROM graph_analysis_metadata").run();
    },
  };
}
