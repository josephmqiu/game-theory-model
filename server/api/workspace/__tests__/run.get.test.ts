import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createThreadService,
  getWorkspaceDatabase,
  resetWorkspaceDatabaseForTest,
} from "../../../services/workspace";

const getQueryMock = vi.fn();
const setResponseStatusMock = vi.fn();

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  getQuery: (...args: unknown[]) => getQueryMock(...args),
  setResponseStatus: (...args: unknown[]) => setResponseStatusMock(...args),
}));

function seedRun() {
  const database = getWorkspaceDatabase();
  const threadService = createThreadService(database);
  const thread = threadService.createThread({
    workspaceId: "workspace-1",
    title: "Trade war",
    producer: "test",
    occurredAt: 100,
  });

  database.eventStore.appendEvents([
    {
      type: "run.created",
      workspaceId: thread.workspaceId,
      threadId: thread.id,
      runId: "run-1",
      payload: {
        kind: "analysis",
        provider: "openai",
        model: "gpt-5.4",
        effort: "medium",
        status: "running",
        startedAt: 101,
        totalPhases: 2,
        promptProvenance: {
          analysisType: "game-theory",
          activePhases: ["situational-grounding", "player-identification"],
          promptPackId: "game-theory/default",
          promptPackVersion: "2026-03-25.1",
          promptPackMode: "analysis-runtime",
          templateSetIdentity: "game-theory/default",
          templateSetHash: "template-set-hash",
        },
        logCorrelation: {
          logFileName: "run-1.jsonl",
        },
      },
      occurredAt: 101,
      producer: "test",
    },
    {
      type: "phase.started",
      workspaceId: thread.workspaceId,
      threadId: thread.id,
      runId: "run-1",
      payload: {
        phase: "situational-grounding",
        phaseTurnId: "phase-turn-1",
        turnIndex: 1,
        promptProvenance: {
          promptPackId: "game-theory/default",
          promptPackVersion: "2026-03-25.1",
          promptPackMode: "analysis-runtime",
          phase: "situational-grounding",
          templateIdentity: "game-theory/default:situational-grounding:initial",
          templateHash: "phase-template-hash",
          effectivePromptHash: "effective-hash",
          variant: "initial",
        },
      },
      occurredAt: 102,
      producer: "test",
    },
    {
      type: "phase.activity.recorded",
      workspaceId: thread.workspaceId,
      threadId: thread.id,
      runId: "run-1",
      payload: {
        phase: "situational-grounding",
        phaseTurnId: "phase-turn-1",
        kind: "tool",
        message: "Used WebSearch",
        toolName: "WebSearch",
      },
      occurredAt: 103,
      producer: "test",
    },
    {
      type: "phase.completed",
      workspaceId: thread.workspaceId,
      threadId: thread.id,
      runId: "run-1",
      payload: {
        phase: "situational-grounding",
        phaseTurnId: "phase-turn-1",
        summary: {
          entitiesCreated: 1,
          relationshipsCreated: 0,
          entitiesUpdated: 0,
          durationMs: 10,
        },
      },
      occurredAt: 104,
      producer: "test",
    },
    {
      type: "run.completed",
      workspaceId: thread.workspaceId,
      threadId: thread.id,
      runId: "run-1",
      payload: {
        finishedAt: 106,
        summary: {
          statusMessage: "Run completed",
          completedPhases: 1,
        },
        latestPhaseTurnId: "phase-turn-1",
      },
      occurredAt: 106,
      producer: "test",
    },
  ]);

  return { thread };
}

describe("/api/workspace/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceDatabaseForTest();
  });

  it("returns run detail with durable phase turns, activities, domain events, and log filename", async () => {
    const { thread } = seedRun();
    getQueryMock.mockReturnValue({ runId: "run-1" });

    const route = (await import("../run.get")).default;
    const result = await route({} as never);

    expect(result).toMatchObject({
      run: expect.objectContaining({
        id: "run-1",
        workspaceId: thread.workspaceId,
        threadId: thread.id,
        status: "completed",
      }),
      phaseTurns: [
        expect.objectContaining({
          runId: "run-1",
          phase: "situational-grounding",
          status: "completed",
          turnIndex: 1,
        }),
      ],
      activities: expect.arrayContaining([
        expect.objectContaining({
          runId: "run-1",
          scope: "analysis-phase",
          kind: "tool",
          message: "Used WebSearch",
        }),
      ]),
      domainEvents: expect.arrayContaining([
        expect.objectContaining({ type: "run.created", runId: "run-1" }),
        expect.objectContaining({ type: "run.completed", runId: "run-1" }),
      ]),
      logFileName: "run-1.jsonl",
    });
    expect(setResponseStatusMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the run does not exist", async () => {
    getQueryMock.mockReturnValue({ runId: "missing-run" });

    const route = (await import("../run.get")).default;
    const result = await route({} as never);

    expect(result).toEqual({ error: "Run not found" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 404);
  });

  it("returns 403 when workspaceId does not match the run", async () => {
    seedRun();
    getQueryMock.mockReturnValue({
      runId: "run-1",
      workspaceId: "workspace-other",
    });

    const route = (await import("../run.get")).default;
    const result = await route({} as never);

    expect(result).toEqual({
      error: "Run does not belong to the requested workspace",
    });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 403);
  });
});
