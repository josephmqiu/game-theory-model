import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspaceDatabase } from "../workspace-db";
import type { PhaseSummary } from "../../../../shared/types/events";

function createPhaseSummary(durationMs = 100): PhaseSummary {
  return {
    entitiesCreated: 1,
    relationshipsCreated: 0,
    entitiesUpdated: 0,
    durationMs,
  };
}

describe("domain-event-store", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (!dir) continue;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createDatabase() {
    const tempDir = mkdtempSync(join(tmpdir(), "gta-domain-events-"));
    tempDirs.push(tempDir);
    return createWorkspaceDatabase({
      databasePath: join(tempDir, "workspace-state.sqlite"),
    });
  }

  function appendStartedRun(
    database: ReturnType<typeof createWorkspaceDatabase>,
  ) {
    const context = database.eventStore.resolveThreadContext({
      workspaceId: "workspace-1",
      producer: "test",
      commandId: "cmd-1",
      receiptId: "receipt-1",
      correlationId: "corr-1",
      causationId: "cause-1",
      occurredAt: 100,
    });
    const events = database.eventStore.appendEvents([
      ...(context.createdThreadEvent ? [context.createdThreadEvent] : []),
      {
        type: "run.created",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          kind: "analysis",
          provider: null,
          model: null,
          effort: "medium",
          status: "running",
          startedAt: 100,
          totalPhases: 2,
        },
        commandId: "cmd-1",
        receiptId: "receipt-1",
        correlationId: "corr-1",
        causationId: "cause-1",
        occurredAt: 100,
        producer: "test",
      },
      {
        type: "run.status.changed",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          status: "running",
          activePhase: null,
          progress: {
            completed: 0,
            total: 2,
          },
        },
        commandId: "cmd-1",
        receiptId: "receipt-1",
        correlationId: "corr-1",
        causationId: "cause-1",
        occurredAt: 101,
        producer: "test",
      },
    ]);

    return {
      context,
      events,
    };
  }

  it("assigns ordered sequences, copies command metadata, and links causality", () => {
    const database = createDatabase();
    const { context, events } = appendStartedRun(database);

    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(events[1]).toMatchObject({
      commandId: "cmd-1",
      receiptId: "receipt-1",
      correlationId: "corr-1",
      causationId: "cause-1",
    });
    expect(events[2]?.causedByEventId).toBe(events[1]?.id);

    const thread = database.threads.getThreadState(context.threadId);
    expect(thread).toMatchObject({
      id: context.threadId,
      workspaceId: "workspace-1",
      isPrimary: true,
      latestRunId: "run-1",
    });

    const run = database.runs.getRunState("run-1");
    expect(run).toMatchObject({
      id: "run-1",
      workspaceId: "workspace-1",
      threadId: context.threadId,
      kind: "analysis",
      status: "running",
      progress: {
        completed: 0,
        total: 2,
      },
    });

    database.close();
  });

  it("rolls back appended events when projection application fails", () => {
    const database = createDatabase();
    appendStartedRun(database);

    expect(() =>
      database.eventStore.appendEvents([
        {
          type: "phase.completed",
          runId: "run-1",
          payload: {
            phase: "situational-grounding",
            summary: createPhaseSummary(),
          },
          occurredAt: 200,
          producer: "test",
        },
      ]),
    ).toThrow("without an active phase turn");

    expect(database.eventStore.listEventsByRunId("run-1")).toHaveLength(2);
    expect(
      database.phaseTurnSummaries.listPhaseTurnSummariesByRunId("run-1"),
    ).toEqual([]);

    database.close();
  });

  it("updates phase-turn summaries and activity read models in event order", () => {
    const database = createDatabase();
    const { context } = appendStartedRun(database);

    database.eventStore.appendEvents([
      {
        type: "phase.started",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: { phase: "situational-grounding" },
        occurredAt: 200,
        producer: "test",
      },
      {
        type: "phase.activity.recorded",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          phase: "situational-grounding",
          kind: "note",
          message: "Gathering background facts",
        },
        occurredAt: 201,
        producer: "test",
      },
      {
        type: "phase.completed",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          phase: "situational-grounding",
          summary: createPhaseSummary(40),
        },
        occurredAt: 202,
        producer: "test",
      },
      {
        type: "phase.started",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: { phase: "situational-grounding" },
        occurredAt: 203,
        producer: "test",
      },
      {
        type: "phase.activity.recorded",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          phase: "situational-grounding",
          kind: "tool",
          message: "Re-checking sources",
          toolName: "web.search",
        },
        occurredAt: 204,
        producer: "test",
      },
      {
        type: "phase.completed",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          phase: "situational-grounding",
          summary: createPhaseSummary(30),
        },
        occurredAt: 205,
        producer: "test",
      },
      {
        type: "run.completed",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          finishedAt: 206,
        },
        occurredAt: 206,
        producer: "test",
      },
      {
        type: "run.status.changed",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          status: "completed",
          activePhase: null,
          progress: {
            completed: 2,
            total: 2,
          },
          finishedAt: 206,
        },
        occurredAt: 206,
        producer: "test",
      },
    ]);

    const phaseTurns =
      database.phaseTurnSummaries.listPhaseTurnSummariesByRunId("run-1");
    expect(phaseTurns).toHaveLength(2);
    expect(phaseTurns.map((turn) => turn.turnIndex)).toEqual([1, 2]);
    expect(phaseTurns.map((turn) => turn.status)).toEqual([
      "completed",
      "completed",
    ]);

    const activities = database.activities.listActivitiesByRunId("run-1");
    expect(activities).toHaveLength(2);
    expect(activities.map((activity) => activity.message)).toEqual([
      "Gathering background facts",
      "Re-checking sources",
    ]);
    expect(activities[0]!.sequence).toBeLessThan(activities[1]!.sequence);

    const run = database.runs.getRunState("run-1");
    expect(run).toMatchObject({
      status: "completed",
      latestActivity: {
        kind: "tool",
        message: "Re-checking sources",
      },
    });

    database.close();
  });

  it("projects analysis and revalidation runs separately on the same thread", () => {
    const database = createDatabase();
    const { context } = appendStartedRun(database);

    database.eventStore.appendEvents([
      {
        type: "run.created",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "reval-1",
        payload: {
          kind: "revalidation",
          provider: "claude",
          model: "claude-sonnet-4",
          effort: "medium",
          status: "running",
          startedAt: 300,
          totalPhases: 1,
        },
        occurredAt: 300,
        producer: "test",
      },
      {
        type: "run.status.changed",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "reval-1",
        payload: {
          status: "running",
          activePhase: null,
          progress: {
            completed: 0,
            total: 1,
          },
        },
        occurredAt: 301,
        producer: "test",
      },
    ]);

    const runs = database.runs.listRunsByThreadId(context.threadId);
    expect(runs.map((run) => [run.id, run.kind])).toEqual(
      expect.arrayContaining([
        ["run-1", "analysis"],
        ["reval-1", "revalidation"],
      ]),
    );

    database.close();
  });

  it("projects run.completed directly onto the run state without a trailing run.status.changed", () => {
    const database = createDatabase();
    const { context } = appendStartedRun(database);

    database.eventStore.appendEvents([
      {
        type: "run.completed",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: { finishedAt: 500 },
        occurredAt: 500,
        producer: "test",
      },
    ]);

    const run = database.runs.getRunState("run-1");
    expect(run).toMatchObject({
      status: "completed",
      finishedAt: 500,
    });

    const thread = database.threads.getThreadState(context.threadId);
    expect(thread).toMatchObject({
      latestTerminalStatus: "completed",
    });

    database.close();
  });
});
