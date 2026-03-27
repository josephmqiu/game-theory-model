import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceDatabase } from "../../services/workspace/workspace-db";
import type { WorkspaceDatabase } from "../../services/workspace/workspace-db";
import type { Analysis } from "../../../shared/types/entity";
import { normalizePhaseStates } from "../../../src/types/methodology";
import {
  _resetForTest,
  _setRepoForTest,
  newAnalysis,
  loadAnalysis,
  getAnalysis,
  getAnalysisId,
  createEntity,
  createRelationship,
  updateEntity,
  removeEntity,
  initializeFromDatabase,
} from "../entity-graph-service";
import {
  makeFactData,
  makePlayerData,
  defaultProvenance,
} from "../../__test-utils__/fixtures";

/** Seed the workspaces table so FK constraints on graph tables are satisfied. */
function seedWorkspace(database: WorkspaceDatabase, workspaceId: string): void {
  database.workspaces.upsertWorkspace({
    id: workspaceId,
    name: "Test Workspace",
    analysisType: "game-theory",
    filePath: null,
    workspaceJson: "{}",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

describe("entity-graph-service integration", () => {
  const tempDirs: string[] = [];
  let database: WorkspaceDatabase;

  beforeEach(() => {
    _resetForTest();
    const tempDir = mkdtempSync(join(tmpdir(), "gta-eg-integration-"));
    tempDirs.push(tempDir);
    database = createWorkspaceDatabase({
      databasePath: join(tempDir, "workspace-state.sqlite"),
    });
    _setRepoForTest(database.entityGraph);
    seedWorkspace(database, "ws-1");
  });

  afterEach(() => {
    database?.close();
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  it("createEntity persists to SQLite", () => {
    newAnalysis("test topic", "ws-1");
    const analysisId = getAnalysisId();
    expect(analysisId).toBeTruthy();

    const entity = createEntity(makeFactData(), defaultProvenance);

    const rows = database.entityGraph.listEntities(analysisId!);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(entity.id);
    expect(rows[0].type).toBe("fact");
    expect(rows[0].data).toMatchObject({
      type: "fact",
      date: "2026-03-19",
      source: "test",
      content: "A fact",
      category: "action",
    });
  });

  it("updateEntity persists updated fields to SQLite", () => {
    newAnalysis("test topic", "ws-1");

    const entity = createEntity(makeFactData(), defaultProvenance);

    updateEntity(
      entity.id,
      { rationale: "updated rationale" },
      defaultProvenance,
    );

    const rows = database.entityGraph.listEntities(getAnalysisId()!);
    expect(rows).toHaveLength(1);
    expect(rows[0].rationale).toBe("updated rationale");
  });

  it("removeEntity cascades relationship deletion in SQLite", () => {
    newAnalysis("test topic", "ws-1");
    const analysisId = getAnalysisId()!;

    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makePlayerData(), defaultProvenance);

    createRelationship({
      type: "supports",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });

    removeEntity(e1.id);

    const entities = database.entityGraph.listEntities(analysisId);
    expect(entities).toHaveLength(1);
    expect(entities[0].id).toBe(e2.id);

    const relationships = database.entityGraph.listRelationships(analysisId);
    expect(relationships).toHaveLength(0);
  });

  it("newAnalysis clears previous entities from SQLite", () => {
    newAnalysis("topic-1", "ws-1");
    createEntity(makeFactData(), defaultProvenance);

    // Starting a new analysis for the same workspace clears old data
    newAnalysis("topic-2", "ws-1");

    const rows = database.entityGraph.listEntities(getAnalysisId()!);
    expect(rows).toHaveLength(0);
  });

  it("loadAnalysis writes full state to SQLite", () => {
    const factEntity = {
      id: "ent-fact-1",
      type: "fact" as const,
      phase: "situational-grounding" as const,
      data: {
        type: "fact" as const,
        date: "2026-03-19",
        source: "test",
        content: "loaded fact",
        category: "action" as const,
      },
      confidence: "high" as const,
      rationale: "loaded rationale",
      revision: 1,
      stale: false,
      source: "ai" as const,
      provenance: {
        source: "phase-derived" as const,
        runId: "load-run",
        timestamp: Date.now(),
      },
    };

    const playerEntity = {
      id: "ent-player-1",
      type: "player" as const,
      phase: "player-identification" as const,
      data: {
        type: "player" as const,
        name: "Country A",
        playerType: "primary" as const,
        knowledge: [] as string[],
      },
      confidence: "high" as const,
      rationale: "primary actor",
      revision: 1,
      stale: false,
      source: "ai" as const,
      provenance: {
        source: "phase-derived" as const,
        runId: "load-run",
        timestamp: Date.now(),
      },
    };

    const relationship = {
      id: "rel-1",
      type: "supports" as const,
      fromEntityId: "ent-fact-1",
      toEntityId: "ent-player-1",
    };

    const analysis: Analysis = {
      id: "analysis-load-test",
      name: "loaded topic",
      topic: "loaded topic",
      entities: [factEntity, playerEntity],
      relationships: [relationship],
      phases: normalizePhaseStates([], [factEntity, playerEntity]),
    };

    loadAnalysis(analysis, { workspaceId: "ws-1" });

    const dbEntities = database.entityGraph.listEntities("analysis-load-test");
    expect(dbEntities).toHaveLength(2);
    const dbEntityIds = dbEntities.map((e) => e.id).sort();
    expect(dbEntityIds).toEqual(["ent-fact-1", "ent-player-1"]);

    const dbRels = database.entityGraph.listRelationships("analysis-load-test");
    expect(dbRels).toHaveLength(1);
    expect(dbRels[0].fromEntityId).toBe("ent-fact-1");
    expect(dbRels[0].toEntityId).toBe("ent-player-1");
    expect(dbRels[0].type).toBe("supports");
  });

  it("initializeFromDatabase hydrates in-memory state from SQLite", () => {
    newAnalysis("test topic", "ws-1");

    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makePlayerData(), defaultProvenance);

    const originalEntityIds = [e1.id, e2.id].sort();

    // Clear in-memory state but leave the database intact
    _resetForTest();
    _setRepoForTest(database.entityGraph);

    // Hydrate from SQLite
    initializeFromDatabase("ws-1");

    const restored = getAnalysis();
    expect(restored.entities).toHaveLength(2);
    const restoredIds = restored.entities.map((e) => e.id).sort();
    expect(restoredIds).toEqual(originalEntityIds);
  });

  it("createRelationship persists to SQLite", () => {
    newAnalysis("test topic", "ws-1");
    const analysisId = getAnalysisId()!;

    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makePlayerData(), defaultProvenance);

    const rel = createRelationship({
      type: "supports",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });

    const rows = database.entityGraph.listRelationships(analysisId);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(rel.id);
    expect(rows[0].type).toBe("supports");
    expect(rows[0].fromEntityId).toBe(e1.id);
    expect(rows[0].toEntityId).toBe(e2.id);
  });
});
