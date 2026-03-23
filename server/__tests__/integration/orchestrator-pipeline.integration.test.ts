/**
 * Integration tests: analysis-agent orchestrator → analysis-service → revision-diff → entity-graph-service.
 *
 * Tests the orchestrator's observable state and classification logic.
 * Only the AI adapter is mocked. The async orchestrator execution is tested
 * via runtime-status state machine transitions, not progress event streams
 * (which have timing dependencies with synchronous mocks).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetAllServices,
  PHASE_FIXTURES,
} from "../../__test-utils__/fixtures";
import {
  createMockRunAnalysisPhase,
} from "../../__test-utils__/mock-adapter";

// ── Mock ONLY the AI adapters ──

const mockImpl = createMockRunAnalysisPhase();
const mockRunAnalysisPhase = vi.fn((...args: unknown[]) =>
  (mockImpl as Function)(...args),
);

vi.mock("../../services/ai/claude-adapter", () => ({
  runAnalysisPhase: (...args: unknown[]) => mockRunAnalysisPhase(...args),
}));

vi.mock("../../services/ai/codex-adapter", () => ({
  runAnalysisPhase: (...args: unknown[]) => mockRunAnalysisPhase(...args),
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

const orchestrator = await import("../../agents/analysis-agent");
const runtimeStatus = await import("../../services/runtime-status");
const entityGraph = await import("../../services/entity-graph-service");

// Helper to wait for orchestrator async execution
async function waitForRun() {
  const p = orchestrator._getRunPromise();
  if (p) await p;
  // Yield to ensure all cleanup runs
  await new Promise((r) => setTimeout(r, 10));
}

// ── Tests ──

describe("orchestrator pipeline integration", () => {
  beforeEach(() => {
    resetAllServices();
    vi.clearAllMocks();
  });

  it("runFull returns a valid runId and acquires runtime status", async () => {
    const { runId } = await orchestrator.runFull(
      "Steel trade war",
      "anthropic",
      undefined,
      undefined,
      { activePhases: ["situational-grounding"] },
    );

    expect(runId).toMatch(/^run-/);

    // Runtime status should have been acquired (at minimum)
    // Either still running or already completed
    const snapshot = runtimeStatus.getSnapshot();
    expect(["running", "idle"]).toContain(snapshot.status);

    await waitForRun();
  });

  it("runFull populates entity graph with entities after run completes", async () => {
    // Use a single phase to avoid timing issues with multi-phase mock detection
    await orchestrator.runFull(
      "Steel trade war",
      "anthropic",
      undefined,
      undefined,
      { activePhases: ["situational-grounding"] },
    );
    await waitForRun();

    // Verify entities from the phase landed in the graph
    const analysis = entityGraph.getAnalysis();
    const fixture = PHASE_FIXTURES["situational-grounding"]!;
    expect(analysis.entities.length).toBe(fixture.entities.length);

    // All relationship endpoints should resolve to real entities
    const entityIds = new Set(analysis.entities.map((e) => e.id));
    for (const rel of analysis.relationships) {
      expect(entityIds.has(rel.fromEntityId)).toBe(true);
      expect(entityIds.has(rel.toEntityId)).toBe(true);
    }
  });

  it("runtime-status transitions through running to idle on success", async () => {
    const statusHistory: string[] = [];
    const unsub = runtimeStatus.onStatusChange(() => {
      statusHistory.push(runtimeStatus.getSnapshot().status);
    });

    await orchestrator.runFull(
      "Steel trade war",
      "anthropic",
      undefined,
      undefined,
      { activePhases: ["situational-grounding", "player-identification"] },
    );
    await waitForRun();
    unsub();

    expect(statusHistory).toContain("running");
    // Final state should be idle (success)
    const final = runtimeStatus.getSnapshot();
    expect(final.status).toBe("idle");
  });

  it("classifyFailure correctly categorizes error types", () => {
    // Terminal errors
    expect(orchestrator.classifyFailure("schema refused by provider")).toBe(
      "terminal",
    );
    expect(
      orchestrator.classifyFailure("Authentication failed: invalid API key"),
    ).toBe("terminal");
    expect(orchestrator.classifyFailure("not permitted for this model")).toBe(
      "terminal",
    );

    // Retryable errors
    expect(orchestrator.classifyFailure("ECONNREFUSED")).toBe("retryable");
    expect(orchestrator.classifyFailure("network error")).toBe("retryable");
    expect(orchestrator.classifyFailure("empty response")).toBe("retryable");
    expect(orchestrator.classifyFailure("JSON parse error")).toBe("retryable");
    expect(orchestrator.classifyFailure("zod validation failed")).toBe(
      "retryable",
    );
  });

  it("getResult returns entities after completed run", async () => {
    const { runId } = await orchestrator.runFull(
      "Steel trade war",
      "anthropic",
      undefined,
      undefined,
      { activePhases: ["situational-grounding"] },
    );
    await waitForRun();

    const result = orchestrator.getResult(runId);
    expect(result.entities.length).toBeGreaterThan(0);
    expect(result.relationships.length).toBeGreaterThanOrEqual(0);
  });

  it("concurrent runFull calls are rejected", async () => {
    await orchestrator.runFull(
      "Steel trade war",
      "anthropic",
      undefined,
      undefined,
      { activePhases: ["situational-grounding"] },
    );

    await expect(
      orchestrator.runFull("Another topic", "anthropic", undefined, undefined, {
        activePhases: ["situational-grounding"],
      }),
    ).rejects.toThrow(/already active/);

    await waitForRun();
  });
});
