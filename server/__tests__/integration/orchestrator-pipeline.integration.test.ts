/**
 * Integration tests for the analysis orchestrator's end-to-end behavior.
 *
 * Tests that runFull() actually executes multiple phases, populates the entity
 * graph, and manages runtime status correctly.
 * Only the AI adapter is mocked — everything else runs real.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunStatus } from "../../../shared/types/api";
import {
  resetAllServices,
  PHASE_FIXTURES,
} from "../../__test-utils__/fixtures";
import { createMockRunAnalysisPhase } from "../../__test-utils__/mock-adapter";

// ── Mock ONLY the AI adapters ──

const defaultMock = createMockRunAnalysisPhase();
const mockRunAnalysisPhase = vi.fn((...args: unknown[]) =>
  (defaultMock as Function)(...args),
);

vi.mock("../../services/ai/claude-adapter", () => ({
  runAnalysisPhase: (...args: unknown[]) => mockRunAnalysisPhase(...args),
}));

vi.mock("../../services/ai/codex-adapter", () => ({
  runAnalysisPhase: (...args: unknown[]) => mockRunAnalysisPhase(...args),
}));

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

function flushAsync(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Tests ──

describe("orchestrator pipeline integration", () => {
  beforeEach(() => {
    resetAllServices();
    mockRunAnalysisPhase.mockImplementation((...args: unknown[]) =>
      (defaultMock as Function)(...args),
    );
  });

  afterEach(async () => {
    const p = orchestrator._getRunPromise();
    if (p) await p;
    await flushAsync();
    vi.clearAllMocks();
  });

  it("runs 3 phases sequentially and populates the entity graph with entities from each", async () => {
    const testPhases = [
      "situational-grounding",
      "player-identification",
      "baseline-model",
    ] as const;

    await orchestrator.runFull(
      "Steel trade war",
      "anthropic",
      undefined,
      undefined,
      { activePhases: [...testPhases] },
    );
    await flushAsync();

    const analysis = entityGraph.getAnalysis();

    // Each phase contributed the right number of entities
    for (const phase of testPhases) {
      const phaseEntities = analysis.entities.filter((e) => e.phase === phase);
      const fixture = PHASE_FIXTURES[phase]!;
      expect(phaseEntities.length, `entity count for ${phase}`).toBe(
        fixture.entities.length,
      );
    }

    // All relationship endpoints are valid entity IDs (no dangling refs)
    const entityIds = new Set(analysis.entities.map((e) => e.id));
    for (const rel of analysis.relationships) {
      expect(
        entityIds.has(rel.fromEntityId),
        `dangling from: ${rel.fromEntityId}`,
      ).toBe(true);
      expect(
        entityIds.has(rel.toEntityId),
        `dangling to: ${rel.toEntityId}`,
      ).toBe(true);
    }

    // The adapter was called once per phase plus once for synthesis (no retries)
    expect(mockRunAnalysisPhase).toHaveBeenCalledTimes(testPhases.length + 1);
  });

  it("transitions runtime-status through running to idle, with kind=analysis", async () => {
    const statusHistory: RunStatus[] = [];
    const unsub = runtimeStatus.onStatusChange(() => {
      statusHistory.push({ ...runtimeStatus.getSnapshot() });
    });

    await orchestrator.runFull(
      "Steel trade war",
      "anthropic",
      undefined,
      undefined,
      { activePhases: ["situational-grounding", "player-identification"] },
    );
    await flushAsync();
    unsub();

    // Must have observed "running" with kind "analysis"
    expect(statusHistory.some((s) => s.status === "running")).toBe(true);
    expect(statusHistory.some((s) => s.kind === "analysis")).toBe(true);

    // Final state is idle
    expect(runtimeStatus.getSnapshot().status).toBe("idle");

    // Entities exist (proves phases ran through to completion)
    expect(entityGraph.getAnalysis().entities.length).toBeGreaterThan(0);
  });

  it("getResult returns a point-in-time snapshot with entities from all requested phases", async () => {
    const { runId } = await orchestrator.runFull(
      "Steel trade war",
      "anthropic",
      undefined,
      undefined,
      { activePhases: ["situational-grounding", "player-identification"] },
    );
    await flushAsync();

    const result = orchestrator.getResult(runId);
    expect(result.entities.length).toBeGreaterThan(0);

    const phases = new Set(result.entities.map((e) => e.phase));
    expect(phases.has("situational-grounding")).toBe(true);
    expect(phases.has("player-identification")).toBe(true);
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

    await flushAsync();
  });

  it("classifyFailure distinguishes terminal from retryable errors", () => {
    // Terminal — no retry, run fails immediately
    expect(orchestrator.classifyFailure("schema refused by provider")).toBe(
      "terminal",
    );
    expect(orchestrator.classifyFailure("not permitted for this model")).toBe(
      "terminal",
    );
    expect(orchestrator.classifyFailure("invalid_json_schema")).toBe(
      "terminal",
    );

    // Retryable — orchestrator retries up to MAX_RETRIES
    expect(orchestrator.classifyFailure("ECONNREFUSED")).toBe("retryable");
    expect(orchestrator.classifyFailure("empty response")).toBe("retryable");
    expect(orchestrator.classifyFailure("zod validation failed")).toBe(
      "retryable",
    );
    expect(orchestrator.classifyFailure("JSON parse error")).toBe("retryable");
  });
});
