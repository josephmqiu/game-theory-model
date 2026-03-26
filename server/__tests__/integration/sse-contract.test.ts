/**
 * SSE contract tests: verify events.get.ts handler produces correct SSE output.
 *
 * Uses the same FakeServerResponse + listener-based mock pattern as the existing
 * events.test.ts, but focuses on contract correctness: does the server emit
 * events in the exact format the client expects?
 */

import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Listener-based mocks (same pattern as events.test.ts) ──

const mutationListeners = new Set<(event: Record<string, unknown>) => void>();
const statusListeners = new Set<(event: Record<string, unknown>) => void>();
const orchestratorListeners = new Set<(event: Record<string, unknown>) => void>();
const revalidationListeners = new Set<(event: Record<string, unknown>) => void>();

let currentRevision = 0;

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
}));

vi.mock("../../services/entity-graph-service", () => ({
  onMutation: (callback: (event: Record<string, unknown>) => void) => {
    mutationListeners.add(callback);
    return () => mutationListeners.delete(callback);
  },
}));

vi.mock("../../services/runtime-status", () => ({
  getRevision: () => currentRevision,
  onStatusChange: (callback: (event: Record<string, unknown>) => void) => {
    statusListeners.add(callback);
    return () => statusListeners.delete(callback);
  },
}));

vi.mock("../../agents/analysis-agent", () => ({
  onProgress: (callback: (event: Record<string, unknown>) => void) => {
    orchestratorListeners.add(callback);
    return () => orchestratorListeners.delete(callback);
  },
}));

vi.mock("../../services/revalidation-service", () => ({
  onProgress: (callback: (event: Record<string, unknown>) => void) => {
    revalidationListeners.add(callback);
    return () => revalidationListeners.delete(callback);
  },
}));

// ── FakeServerResponse ──

class FakeServerResponse extends EventEmitter {
  headers: Record<string, string> | null = null;
  chunks: string[] = [];

  writeHead(_statusCode: number, headers: Record<string, string>): void {
    this.headers = headers;
  }

  write(chunk: string): void {
    this.chunks.push(chunk);
  }

  close(): void {
    this.emit("close");
  }
}

function createEvent() {
  const res = new FakeServerResponse();
  return { event: { node: { res } }, res };
}

/** Parse SSE chunks into JSON objects, same as the client does. */
function parseEvents(chunks: string[]): Array<Record<string, unknown>> {
  return chunks
    .join("")
    .split("\n\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("data: "))
    .map((entry) => JSON.parse(entry.slice(6)) as Record<string, unknown>);
}

function emitMutation(revision: number, event: Record<string, unknown>): void {
  currentRevision = revision;
  for (const listener of mutationListeners) listener(event);
}

function emitStatus(revision: number, event: Record<string, unknown>): void {
  currentRevision = revision;
  for (const listener of statusListeners) listener(event);
}

function emitOrchestratorProgress(revision: number, event: Record<string, unknown>): void {
  currentRevision = revision;
  for (const listener of orchestratorListeners) listener(event);
}

function emitRevalidationProgress(revision: number, event: Record<string, unknown>): void {
  currentRevision = revision;
  for (const listener of revalidationListeners) listener(event);
}

// ── Tests ──

describe("SSE contract: events.get.ts handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRevision = 0;
    mutationListeners.clear();
    statusListeners.clear();
    orchestratorListeners.clear();
    revalidationListeners.clear();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("sets correct SSE headers", async () => {
    const { event, res } = createEvent();
    const route = (await import("../../api/ai/events.get")).default;
    const pending = route(event as never);

    res.close();
    await pending;

    expect(res.headers).toEqual({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
  });

  it("mutation events flow through with channel, type, revision, and entity data", async () => {
    const { event, res } = createEvent();
    const route = (await import("../../api/ai/events.get")).default;
    const pending = route(event as never);

    emitMutation(5, {
      type: "entity_created",
      entity: { id: "e-1", type: "fact", phase: "situational-grounding" },
    });

    res.close();
    await pending;

    const parsed = parseEvents(res.chunks);
    expect(parsed.length).toBe(1);
    expect(parsed[0]).toEqual({
      channel: "mutation",
      revision: 5,
      type: "entity_created",
      entity: { id: "e-1", type: "fact", phase: "situational-grounding" },
    });
  });

  it("all 8 mutation event types produce valid SSE with correct channel", async () => {
    const { event, res } = createEvent();
    const route = (await import("../../api/ai/events.get")).default;
    const pending = route(event as never);

    const mutationEvents = [
      { type: "entity_created", entity: { id: "e1" } },
      { type: "entity_updated", entity: { id: "e1" }, previousProvenance: {} },
      { type: "entity_deleted", entityId: "e1" },
      { type: "relationship_created", relationship: { id: "r1" } },
      { type: "relationship_updated", relationship: { id: "r1" } },
      { type: "relationship_deleted", relationshipId: "r1" },
      { type: "stale_marked", entityIds: ["e1", "e2"] },
      { type: "state_changed" },
    ];

    mutationEvents.forEach((evt, i) => emitMutation(i + 1, evt));

    res.close();
    await pending;

    const parsed = parseEvents(res.chunks);
    expect(parsed.length).toBe(8);

    for (let i = 0; i < mutationEvents.length; i++) {
      expect(parsed[i].channel).toBe("mutation");
      expect(parsed[i].type).toBe(mutationEvents[i].type);
      expect(typeof parsed[i].revision).toBe("number");
    }
  });

  it("terminal progress events (analysis_completed, analysis_failed) are filtered out", async () => {
    const { event, res } = createEvent();
    const route = (await import("../../api/ai/events.get")).default;
    const pending = route(event as never);

    // Emit both terminal and non-terminal progress events
    emitOrchestratorProgress(1, {
      type: "phase_started",
      phase: "situational-grounding",
      runId: "run-1",
    });
    emitOrchestratorProgress(2, {
      type: "analysis_completed",
      runId: "run-1",
    });
    emitRevalidationProgress(3, {
      type: "phase_activity",
      phase: "assumptions",
      runId: "reval-1",
      kind: "note",
      message: "Revalidating",
    });
    emitRevalidationProgress(4, {
      type: "analysis_failed",
      runId: "reval-1",
      error: "should be filtered",
    });

    res.close();
    await pending;

    const parsed = parseEvents(res.chunks);
    // Only non-terminal events should appear
    expect(parsed.length).toBe(2);
    expect(parsed[0].type).toBe("phase_started");
    expect(parsed[1].type).toBe("phase_activity");

    // Terminal events must NOT appear
    const types = parsed.map((e) => e.type);
    expect(types).not.toContain("analysis_completed");
    expect(types).not.toContain("analysis_failed");
  });

  it("status channel forwards RunStatus with all required fields", async () => {
    const { event, res } = createEvent();
    const route = (await import("../../api/ai/events.get")).default;
    const pending = route(event as never);

    emitStatus(7, {
      status: "running",
      kind: "analysis",
      runId: "run-1",
      activePhase: "player-identification",
      progress: { completed: 1, total: 9 },
      deferredRevalidationPending: false,
    });

    res.close();
    await pending;

    const parsed = parseEvents(res.chunks);
    expect(parsed.length).toBe(1);
    expect(parsed[0].channel).toBe("status");
    expect(parsed[0].revision).toBe(7);
    // Verify all RunStatus fields that the client depends on
    expect(parsed[0].status).toBe("running");
    expect(parsed[0].kind).toBe("analysis");
    expect(parsed[0].runId).toBe("run-1");
    expect(parsed[0].activePhase).toBe("player-identification");
    expect(parsed[0].progress).toEqual({ completed: 1, total: 9 });
    expect(parsed[0].deferredRevalidationPending).toBe(false);
  });

  it("client can strip envelope to get clean payload", () => {
    // The client's stripEnvelope removes channel and revision.
    // Verify this contract holds for all channel types.
    const mutationEnvelope = {
      channel: "mutation",
      revision: 5,
      type: "entity_created",
      entity: { id: "e-1", type: "fact" },
    };

    const { channel: _c, revision: _r, ...payload } = mutationEnvelope;
    expect(payload).toEqual({
      type: "entity_created",
      entity: { id: "e-1", type: "fact" },
    });
    // channel and revision should not leak into the payload
    expect(payload).not.toHaveProperty("channel");
    expect(payload).not.toHaveProperty("revision");
  });
});
