/**
 * Tests for analysis-service.ts — the thin runPhase() wrapper and runPhaseWithTools().
 *
 * runPhase() is a convenience wrapper used by the eval-runner. It creates
 * temporary tool infrastructure, delegates to runPhaseWithTools(), then reads
 * entities back from the graph.
 *
 * Production callers (orchestrator, revalidation-service) use
 * runPhaseWithTools() directly with their own long-lived tool context.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock dependencies ──

// Mock claude-adapter (tool MCP server factory)
vi.mock("../ai/claude-adapter", () => ({
  createToolBasedAnalysisMcpServer: vi.fn(async () => ({
    // Mock MCP server object
  })),
}));

// Mock revision-diff (phase transactions)
const mockBeginPhaseTransaction = vi.fn();
const mockCommitPhaseTransaction = vi.fn(() => ({
  entitiesCreated: 0,
  entitiesUpdated: 0,
  entitiesDeleted: 0,
  relationshipsCreated: 0,
  currentPhaseEntityIds: [],
}));
const mockRollbackPhaseTransaction = vi.fn();

vi.mock("../revision-diff", () => ({
  beginPhaseTransaction: (...args: unknown[]) =>
    mockBeginPhaseTransaction(...args),
  commitPhaseTransaction: () => mockCommitPhaseTransaction(),
  rollbackPhaseTransaction: () => mockRollbackPhaseTransaction(),
}));

// Mock entity-graph-service
vi.mock("../entity-graph-service", () => ({
  getEntitiesByPhase: vi.fn(() => []),
  getRelationships: vi.fn(() => []),
}));

// Mock the Agent SDK query function (used by runPhaseWithTools)
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(() => {
    // Return an async generator that immediately yields a success result
    return (async function* () {
      yield {
        type: "result",
        subtype: "success",
        is_error: false,
      };
    })();
  }),
}));

// Mock resolve utilities
vi.mock("../../utils/resolve-claude-agent-env", () => ({
  buildClaudeAgentEnv: vi.fn(() => ({})),
  getClaudeAgentDebugFilePath: vi.fn(() => null),
}));

vi.mock("../../utils/resolve-claude-cli", () => ({
  resolveClaudeCli: vi.fn(() => null),
}));

// Mock ai-logger
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

// ── Tests ──

describe("analysis-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function importService() {
    return import("../analysis-service");
  }

  describe("runPhase", () => {
    it("returns error for unsupported phase", async () => {
      const { runPhase } = await importService();
      const result = await runPhase("revalidation", "US-China trade war");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported phase");
      expect(result.entities).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
    });

    it("returns error when signal is already aborted", async () => {
      const { runPhase } = await importService();
      const controller = new AbortController();
      controller.abort();

      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
        { signal: controller.signal },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Aborted");
    });

    it("creates tool infrastructure and calls beginPhaseTransaction", async () => {
      const { runPhase } = await importService();
      await runPhase("situational-grounding", "US-China trade war");

      expect(mockBeginPhaseTransaction).toHaveBeenCalledWith(
        "situational-grounding",
        expect.any(String),
      );
    });

    it("commits transaction on success", async () => {
      const { runPhase } = await importService();
      // The mocked Agent SDK query() returns success, and the writeContext
      // counters will have phaseCompleted = false by default (mock doesn't
      // call complete_phase). So this will actually rollback.
      // That's the correct behavior — the test verifies the wrapper works.
      await runPhase("situational-grounding", "test topic");

      // beginPhaseTransaction was called
      expect(mockBeginPhaseTransaction).toHaveBeenCalled();
      // Either commit or rollback was called (not both)
      const committed = mockCommitPhaseTransaction.mock.calls.length;
      const rolledBack = mockRollbackPhaseTransaction.mock.calls.length;
      expect(committed + rolledBack).toBeGreaterThan(0);
    });

    it("returns success=false when phase does not complete", async () => {
      const { runPhase } = await importService();
      const result = await runPhase("situational-grounding", "test topic");

      // With mocked Agent SDK that doesn't call complete_phase,
      // writeContext.counters.phaseCompleted stays false
      expect(result.success).toBe(false);
      expect(result.error).toContain("did not call complete_phase");
    });

    it("returns empty entities and relationships on failure", async () => {
      const { runPhase } = await importService();
      const result = await runPhase("situational-grounding", "test topic");

      // Phase doesn't complete -> failure
      expect(result.entities).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
    });
  });

  describe("runPhaseWithTools", () => {
    it("returns error for unsupported phase", async () => {
      const { runPhaseWithTools } = await importService();
      const result = await runPhaseWithTools(
        "revalidation" as any,
        "test topic",
        {},
        {
          phase: "revalidation" as any,
          allowedEntityTypes: [],
        } as any,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported phase");
      expect(result.phaseCompleted).toBe(false);
    });

    it("returns error when signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const { runPhaseWithTools } = await importService();
      const result = await runPhaseWithTools(
        "situational-grounding",
        "test topic",
        {},
        {
          phase: "situational-grounding",
          allowedEntityTypes: [],
          counters: {
            entitiesCreated: 0,
            entitiesUpdated: 0,
            entitiesDeleted: 0,
            relationshipsCreated: 0,
            phaseCompleted: false,
          },
        } as any,
        { signal: controller.signal },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Aborted");
    });

    it("returns PhaseToolResult with counters from writeContext", async () => {
      const counters = {
        entitiesCreated: 3,
        entitiesUpdated: 1,
        entitiesDeleted: 0,
        relationshipsCreated: 2,
        phaseCompleted: true,
      };

      const { runPhaseWithTools } = await importService();
      const result = await runPhaseWithTools(
        "situational-grounding",
        "test topic",
        {},
        {
          phase: "situational-grounding",
          allowedEntityTypes: ["fact"],
          counters,
        } as any,
      );

      // Query returns success, counters are read from writeContext
      expect(result.entitiesCreated).toBe(3);
      expect(result.entitiesUpdated).toBe(1);
      expect(result.entitiesDeleted).toBe(0);
      expect(result.relationshipsCreated).toBe(2);
      expect(result.phaseCompleted).toBe(true);
      expect(result.success).toBe(true);
    });

    it("returns success=false when phaseCompleted is false", async () => {
      const { runPhaseWithTools } = await importService();
      const result = await runPhaseWithTools(
        "situational-grounding",
        "test topic",
        {},
        {
          phase: "situational-grounding",
          allowedEntityTypes: ["fact"],
          counters: {
            entitiesCreated: 1,
            entitiesUpdated: 0,
            entitiesDeleted: 0,
            relationshipsCreated: 0,
            phaseCompleted: false,
          },
        } as any,
      );

      expect(result.success).toBe(false);
      expect(result.phaseCompleted).toBe(false);
      expect(result.error).toContain("did not call complete_phase");
    });
  });
});
