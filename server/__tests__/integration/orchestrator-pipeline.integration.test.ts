/**
 * Integration tests for the analysis orchestrator's end-to-end behavior.
 *
 * Tests that runFull() actually executes multiple phases, populates the entity
 * graph, manages runtime status correctly, and triggers synthesis.
 * Only the AI adapter is mocked — everything else runs real.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunStatus } from "../../../shared/types/api";
import type { AnalysisProgressEvent } from "../../../shared/types/events";
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

vi.mock("../../services/ai/adapter-contract", () => ({
  getRuntimeAdapter: vi.fn(async (providerInput?: string) => {
    const isCodex = providerInput === "openai" || providerInput === "codex";
    return {
      provider: isCodex ? "codex" : "claude",
      createSession(key: { ownerId: string; runId?: string }) {
        return {
          provider: isCodex ? "codex" : "claude",
          key,
          streamChatTurn: vi.fn(),
          runStructuredTurn<T = unknown>(input: {
            prompt: string;
            systemPrompt: string;
            model: string;
            schema: Record<string, unknown>;
            signal?: AbortSignal;
            runId?: string;
            maxTurns?: number;
            webSearch?: boolean;
            onActivity?: unknown;
          }) {
            return mockRunAnalysisPhase(
              input.prompt,
              input.systemPrompt,
              input.model,
              input.schema,
              {
                signal: input.signal,
                runId: input.runId,
                maxTurns: input.maxTurns,
                webSearch: input.webSearch,
                onActivity: input.onActivity,
              },
            ) as Promise<T>;
          },
          getDiagnostics: vi.fn(() => ({
            provider: isCodex ? "codex" : "claude",
            sessionId: "orchestrator-pipeline-session",
            details: { ownerId: key.ownerId },
          })),
          dispose: vi.fn(async () => {}),
        };
      },
      listModels: vi.fn(async () => []),
      checkHealth: vi.fn(async () => ({
        provider: isCodex ? "codex" : "claude",
        status: "healthy",
        reason: null,
        checkedAt: Date.now(),
        checks: [],
      })),
    };
  }),
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

/** Wait for the orchestrator async execution to finish by polling isRunning(). */
async function waitForRunComplete(maxWaitMs = 5000): Promise<void> {
  const start = Date.now();
  while (orchestrator.isRunning() && Date.now() - start < maxWaitMs) {
    await flushAsync(5);
  }
  // One final flush to let any trailing microtasks settle
  await flushAsync(10);
}

/**
 * Build a mock that handles both phase calls and synthesis calls.
 * Phase calls use the default fixture mock; synthesis calls return
 * a valid analysis-report referencing entities currently in the graph.
 */
function createSynthesisAwareMock() {
  return (...args: unknown[]) => {
    const systemPrompt = args[1] as string;

    // Detect synthesis call by checking if it uses the synthesis system prompt
    if (
      systemPrompt &&
      systemPrompt.includes("game-theory analyst synthesizing")
    ) {
      // Read current graph entities to build realistic references
      const analysis = entityGraph.getAnalysis();
      const refs = analysis.entities.slice(0, 3).map((e) => ({
        entity_id: e.id,
        display_name:
          "name" in e.data
            ? (e.data as Record<string, unknown>).name
            : "content" in e.data
              ? (e.data as Record<string, unknown>).content
              : e.id,
      }));

      return Promise.resolve({
        type: "analysis-report",
        executive_summary:
          "The steel trade war creates a chicken-game dynamic favoring de-escalation.",
        why: "Both players face domestic economic pressure that makes sustained escalation costly.",
        key_evidence: [
          "Country A imposed 25% tariffs",
          "Country B exports dropped 40%",
        ],
        open_assumptions: ["No third-party escalation trigger"],
        entity_references: refs,
        prediction_verdict: null,
        what_would_change: [
          "Military incident in contested region",
          "Domestic political crisis forcing escalation",
        ],
        source_url: null,
        analysis_timestamp: new Date().toISOString(),
      });
    }

    // Default: delegate to phase fixture mock
    return (defaultMock as Function)(...args);
  };
}

// ── Tests ──

describe("orchestrator pipeline integration", () => {
  beforeEach(async () => {
    await resetAllServices();
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

    const { runId } = await orchestrator.runFull(
      "Steel trade war",
      "anthropic",
      undefined,
      undefined,
      { activePhases: [...testPhases] },
    );
    const runPromise = orchestrator._getRunPromise();
    if (runPromise) {
      await runPromise;
    }
    await waitForRunComplete();

    const result = orchestrator.getResult(runId);

    expect(result.entities.length).toBeGreaterThan(0);

    // The run result preserves the full phase-by-phase outputs.
    for (const phase of testPhases) {
      const phaseEntities = result.entities.filter((e) => e.phase === phase);
      const fixture = PHASE_FIXTURES[phase]!;
      expect(phaseEntities.length, `entity count for ${phase}`).toBe(
        fixture.entities.length,
      );
    }

    // All relationship endpoints are valid entity IDs (no dangling refs)
    const entityIds = new Set(result.entities.map((e) => e.id));
    for (const rel of result.relationships) {
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

// ── Synthesis integration tests ──

describe("orchestrator synthesis integration", () => {
  beforeEach(async () => {
    await resetAllServices();
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

  it("creates an analysis-report entity in the graph after all phases complete", async () => {
    mockRunAnalysisPhase.mockImplementation(createSynthesisAwareMock());

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
    await waitForRunComplete();

    const analysis = entityGraph.getAnalysis();
    const reportEntity = analysis.entities.find(
      (e) => e.type === "analysis-report",
    );

    expect(reportEntity).toBeDefined();
    expect(reportEntity!.type).toBe("analysis-report");

    // The report entity should have an executive summary in its data
    const reportData = reportEntity!.data as Record<string, unknown>;
    expect(typeof reportData.executive_summary).toBe("string");
    expect((reportData.executive_summary as string).length).toBeGreaterThan(0);
  });

  it("creates relationship edges from the report to each referenced entity", async () => {
    mockRunAnalysisPhase.mockImplementation(createSynthesisAwareMock());

    await orchestrator.runFull(
      "Steel trade war",
      "anthropic",
      undefined,
      undefined,
      {
        activePhases: [
          "situational-grounding",
          "player-identification",
          "baseline-model",
        ],
      },
    );
    await waitForRunComplete();

    const analysis = entityGraph.getAnalysis();
    const reportEntity = analysis.entities.find(
      (e) => e.type === "analysis-report",
    );
    expect(reportEntity).toBeDefined();

    // Report should have outgoing relationship edges
    const reportRelationships = analysis.relationships.filter(
      (r) => r.fromEntityId === reportEntity!.id,
    );
    expect(reportRelationships.length).toBeGreaterThan(0);

    // Every relationship target must be a valid entity in the graph
    const entityIds = new Set(analysis.entities.map((e) => e.id));
    for (const rel of reportRelationships) {
      expect(
        entityIds.has(rel.toEntityId),
        `report relationship targets non-existent entity: ${rel.toEntityId}`,
      ).toBe(true);
    }

    // Relationship types should be semantically appropriate (not all the same generic type)
    const relTypes = new Set(reportRelationships.map((r) => r.type));
    // With facts and players referenced, we expect at least "informed-by"
    expect(relTypes.has("informed-by")).toBe(true);
  });

  it("emits synthesis_started and synthesis_completed events when synthesis succeeds", async () => {
    mockRunAnalysisPhase.mockImplementation(createSynthesisAwareMock());

    const events: AnalysisProgressEvent[] = [];
    const unsub = orchestrator.onProgress((event) => {
      events.push(event);
    });

    await orchestrator.runFull(
      "Steel trade war",
      "anthropic",
      undefined,
      undefined,
      { activePhases: ["situational-grounding", "player-identification"] },
    );
    await waitForRunComplete();
    unsub();

    const synthStarted = events.find((e) => e.type === "synthesis_started");
    const synthCompleted = events.find((e) => e.type === "synthesis_completed");

    expect(synthStarted).toBeDefined();
    expect(synthCompleted).toBeDefined();

    // synthesis_started should come after analysis_completed
    const analysisCompleted = events.findIndex(
      (e) => e.type === "analysis_completed",
    );
    const synthStartedIdx = events.findIndex(
      (e) => e.type === "synthesis_started",
    );
    expect(synthStartedIdx).toBeGreaterThan(analysisCompleted);
  });

  it("completes the analysis normally when synthesis fails -- synthesis failure is non-fatal", async () => {
    // Default mock throws on synthesis prompt (cannot detect phase) -- this is our failure case
    const testPhases = [
      "situational-grounding",
      "player-identification",
    ] as const;

    const events: AnalysisProgressEvent[] = [];
    const unsub = orchestrator.onProgress((event) => {
      events.push(event);
    });

    await orchestrator.runFull(
      "Steel trade war",
      "anthropic",
      undefined,
      undefined,
      { activePhases: [...testPhases] },
    );
    await waitForRunComplete();
    unsub();

    // Analysis completed successfully
    expect(events.some((e) => e.type === "analysis_completed")).toBe(true);
    expect(events.some((e) => e.type === "analysis_failed")).toBe(false);

    // Runtime status returns to idle (no stuck state)
    expect(runtimeStatus.getSnapshot().status).toBe("idle");

    // Phase entities still exist in the graph
    const analysis = entityGraph.getAnalysis();
    expect(analysis.entities.length).toBeGreaterThan(0);

    // No analysis-report entity was created (synthesis failed)
    const reportEntity = analysis.entities.find(
      (e) => e.type === "analysis-report",
    );
    expect(reportEntity).toBeUndefined();
  });
});
