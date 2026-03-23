/**
 * Integration tests: MCP product tools → entity-graph-service.
 *
 * Tests that product tool handlers correctly interact with the real
 * entity graph service. Only the AI adapter is mocked (for start_analysis).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAllServices, makeFactData } from "../../__test-utils__/fixtures";

// Mock AI adapter (for start_analysis tool)
vi.mock("../../services/ai/claude-adapter", () => ({
  runAnalysisPhase: vi.fn().mockResolvedValue({
    entities: [],
    relationships: [],
  }),
}));

vi.mock("../../services/ai/codex-adapter", () => ({
  runAnalysisPhase: vi.fn().mockResolvedValue({
    entities: [],
    relationships: [],
  }),
}));

// Suppress logger output
vi.mock("../../utils/ai-logger", () => ({
  createRunLogger: () => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    capture: vi.fn(),
    flush: vi.fn().mockResolvedValue(true),
    entries: () => [],
  }),
  timer: () => ({ elapsed: () => 0 }),
  serverLog: vi.fn(),
  serverWarn: vi.fn(),
  serverError: vi.fn(),
}));

// ── Real imports ──

const productTools = await import("../../mcp/product-tools");
const entityGraph = await import("../../services/entity-graph-service");

describe("MCP product tools integration", () => {
  beforeEach(() => {
    resetAllServices();
    entityGraph.newAnalysis("Integration test");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("create_entity + get_entity round-trip", () => {
    const result = productTools.handleCreateEntity({
      type: "fact",
      phase: "situational-grounding",
      data: {
        type: "fact",
        date: "2026-01-01",
        source: "test",
        content: "A test fact",
        category: "action",
      },
      confidence: "high",
      rationale: "Created via MCP tool",
    });

    const parsed = JSON.parse(result);
    expect(parsed.created).toBeDefined();
    expect(parsed.created.length).toBe(1);
    const entity = parsed.created[0];
    expect(entity.id).toBeTruthy();
    expect(entity.type).toBe("fact");

    // Retrieve the entity
    const getResult = productTools.handleGetEntity({ id: entity.id });
    const retrieved = JSON.parse(getResult);
    expect(retrieved.id).toBe(entity.id);
    expect(retrieved.data.content).toBe("A test fact");
  });

  it("query_entities filters by phase", () => {
    // Create entities for two phases
    productTools.handleCreateEntity({
      type: "fact",
      phase: "situational-grounding",
      data: {
        type: "fact",
        date: "2026-01-01",
        source: "test",
        content: "Fact 1",
        category: "action",
      },
      confidence: "high",
      rationale: "test",
    });

    productTools.handleCreateEntity({
      type: "player",
      phase: "player-identification",
      data: {
        type: "player",
        name: "Country A",
        playerType: "primary",
        knowledge: [],
      },
      confidence: "high",
      rationale: "test",
    });

    // Query just phase 1
    const result = productTools.handleQueryEntities({
      phase: "situational-grounding",
    });
    const parsed = JSON.parse(result);
    expect(parsed.length).toBe(1);
    expect(parsed[0].type).toBe("fact");

    // Query phase 2
    const result2 = productTools.handleQueryEntities({
      phase: "player-identification",
    });
    const parsed2 = JSON.parse(result2);
    expect(parsed2.length).toBe(1);
    expect(parsed2[0].type).toBe("player");
  });

  it("delete_entity removes from graph", () => {
    const createResult = productTools.handleCreateEntity({
      type: "fact",
      phase: "situational-grounding",
      data: {
        type: "fact",
        date: "2026-01-01",
        source: "test",
        content: "To be deleted",
        category: "action",
      },
      confidence: "high",
      rationale: "test",
    });
    const { created } = JSON.parse(createResult);
    const id = created[0].id;

    // Delete it
    const deleteResult = productTools.handleDeleteEntity({ id });
    const deleted = JSON.parse(deleteResult);
    expect(deleted.deleted).toBe(true);

    // Verify it's gone
    const entities = entityGraph.getEntitiesByPhase("situational-grounding");
    expect(entities.find((e) => e.id === id)).toBeUndefined();
  });

  it("handleToolCall returns error for unknown tool", async () => {
    const result = await productTools.handleToolCall(
      "nonexistent_tool",
      {},
      "chat",
    );
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Unknown tool");
  });

  it("create_relationship + query_relationships round-trip", () => {
    // Create two entities first
    const e1 = JSON.parse(
      productTools.handleCreateEntity({
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-01-01",
          source: "test",
          content: "Fact A",
          category: "action",
        },
        confidence: "high",
        rationale: "test",
      }),
    );

    const e2 = JSON.parse(
      productTools.handleCreateEntity({
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-01-02",
          source: "test",
          content: "Fact B",
          category: "economic",
        },
        confidence: "high",
        rationale: "test",
      }),
    );

    const entity1Id = e1.created[0].id;
    const entity2Id = e2.created[0].id;

    // Create relationship (handler uses fromId/toId, not fromEntityId/toEntityId)
    const relResult = productTools.handleCreateRelationship({
      type: "precedes",
      fromId: entity1Id,
      toId: entity2Id,
    });
    const rel = JSON.parse(relResult);
    expect(rel.id).toBeTruthy();
    expect(rel.type).toBe("precedes");

    // Query relationships
    const queryResult = productTools.handleQueryRelationships({});
    const rels = JSON.parse(queryResult);
    expect(rels.length).toBe(1);
    expect(rels[0].fromEntityId).toBe(entity1Id);
    expect(rels[0].toEntityId).toBe(entity2Id);
  });
});
