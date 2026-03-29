import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspaceDatabase } from "../workspace-db";
import type { PhaseSummary } from "../../../../shared/types/events";
import type {
  PhaseTurnPromptProvenance,
  RunPromptProvenance,
} from "../../../../shared/types/workspace-state";
import {
  DEFAULT_PROMPT_PACK_ID,
  DEFAULT_PROMPT_PACK_MODE,
  DEFAULT_PROMPT_PACK_VERSION,
} from "../../../../shared/types/prompt-pack";

function createPhaseSummary(durationMs = 100): PhaseSummary {
  return {
    entitiesCreated: 1,
    relationshipsCreated: 0,
    entitiesUpdated: 0,
    durationMs,
  };
}

function createRunPromptProvenance(): RunPromptProvenance {
  return {
    analysisType: "game-theory",
    activePhases: ["situational-grounding", "player-identification"],
    promptPackId: DEFAULT_PROMPT_PACK_ID,
    promptPackVersion: DEFAULT_PROMPT_PACK_VERSION,
    promptPackMode: DEFAULT_PROMPT_PACK_MODE,
    promptPackSource: {
      kind: "bundled",
      path: "/test/prompt-pack.json",
    },
    templateSetIdentity: DEFAULT_PROMPT_PACK_ID,
    templateSetHash: "template-set-hash",
    toolPolicyByPhase: {
      "situational-grounding": {
        enabledAnalysisTools: [
          "get_entity",
          "query_entities",
          "query_relationships",
          "request_loopback",
        ],
        webSearch: true,
      },
      "player-identification": {
        enabledAnalysisTools: [
          "get_entity",
          "query_entities",
          "query_relationships",
          "request_loopback",
        ],
        webSearch: true,
      },
    },
  };
}

function createPhasePromptProvenance(
  phase: PhaseTurnPromptProvenance["phase"],
  variant: PhaseTurnPromptProvenance["variant"] = "initial",
): PhaseTurnPromptProvenance {
  return {
    promptPackId: DEFAULT_PROMPT_PACK_ID,
    promptPackVersion: DEFAULT_PROMPT_PACK_VERSION,
    promptPackMode: DEFAULT_PROMPT_PACK_MODE,
    promptPackSource: {
      kind: "bundled",
      path: "/test/prompt-pack.json",
    },
    phase,
    templateIdentity: `${DEFAULT_PROMPT_PACK_ID}:${phase}:${variant}`,
    templateHash: `${phase}-template-hash`,
    effectivePromptHash: `${phase}-${variant}-effective-hash`,
    variant,
    toolPolicy: {
      enabledAnalysisTools: [
        "get_entity",
        "query_entities",
        "query_relationships",
        "request_loopback",
      ],
      webSearch: true,
    },
    doneCondition: `${phase} done`,
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
        kind: "explicit" as const,
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
          promptProvenance: createRunPromptProvenance(),
          logCorrelation: {
            logFileName: "run-1.jsonl",
          },
        },
        commandId: "cmd-1",
        receiptId: "receipt-1",
        correlationId: "corr-1",
        causationId: "cause-1",
        occurredAt: 100,
        producer: "test",
      },
      {
        kind: "explicit" as const,
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
          summary: {
            statusMessage: "Run started",
            completedPhases: 0,
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
          kind: "run" as const,
          type: "phase.completed",
          runId: "run-1",
          payload: {
            phase: "situational-grounding",
            phaseTurnId: "missing-turn",
            summary: createPhaseSummary(),
          },
          occurredAt: 200,
          producer: "test",
        },
      ]),
    ).toThrow('without phase turn "missing-turn"');

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
        kind: "explicit" as const,
        type: "phase.started",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          phase: "situational-grounding",
          phaseTurnId: "phase-turn-1",
          turnIndex: 1,
          promptProvenance: createPhasePromptProvenance(
            "situational-grounding",
          ),
        },
        occurredAt: 200,
        producer: "test",
      },
      {
        kind: "explicit" as const,
        type: "phase.activity.recorded",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          phase: "situational-grounding",
          phaseTurnId: "phase-turn-1",
          kind: "note",
          message: "Gathering background facts",
        },
        occurredAt: 201,
        producer: "test",
      },
      {
        kind: "explicit" as const,
        type: "phase.completed",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          phase: "situational-grounding",
          phaseTurnId: "phase-turn-1",
          summary: createPhaseSummary(40),
        },
        occurredAt: 202,
        producer: "test",
      },
      {
        kind: "explicit" as const,
        type: "phase.started",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          phase: "situational-grounding",
          phaseTurnId: "phase-turn-2",
          turnIndex: 2,
          promptProvenance: createPhasePromptProvenance(
            "situational-grounding",
            "revision",
          ),
        },
        occurredAt: 203,
        producer: "test",
      },
      {
        kind: "explicit" as const,
        type: "phase.activity.recorded",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          phase: "situational-grounding",
          phaseTurnId: "phase-turn-2",
          kind: "tool",
          message: "Re-checking sources",
          toolName: "web.search",
        },
        occurredAt: 204,
        producer: "test",
      },
      {
        kind: "explicit" as const,
        type: "phase.completed",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          phase: "situational-grounding",
          phaseTurnId: "phase-turn-2",
          summary: createPhaseSummary(30),
        },
        occurredAt: 205,
        producer: "test",
      },
      {
        kind: "explicit" as const,
        type: "run.completed",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          finishedAt: 206,
          summary: {
            statusMessage: "Run completed",
            completedPhases: 2,
          },
          latestPhaseTurnId: "phase-turn-2",
        },
        occurredAt: 206,
        producer: "test",
      },
      {
        kind: "explicit" as const,
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
          summary: {
            statusMessage: "Run completed",
            completedPhases: 2,
          },
          latestPhaseTurnId: "phase-turn-2",
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
    expect(phaseTurns[1]).toMatchObject({
      id: "phase-turn-2",
      promptProvenance: expect.objectContaining({
        variant: "revision",
      }),
      activitySummary: {
        lastKind: "tool",
        lastMessage: "Re-checking sources",
        lastOccurredAt: 204,
      },
    });

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
      latestPhaseTurnId: "phase-turn-2",
      promptProvenance: createRunPromptProvenance(),
      logCorrelation: {
        logFileName: "run-1.jsonl",
      },
    });

    database.close();
  });

  it("projects analysis metadata from canonical thread activities onto runs and phase turns", () => {
    const database = createDatabase();
    const { context } = appendStartedRun(database);

    database.eventStore.appendEvents([
      {
        kind: "explicit" as const,
        type: "phase.started",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          phase: "situational-grounding",
          phaseTurnId: "phase-turn-1",
          turnIndex: 1,
          promptProvenance: createPhasePromptProvenance(
            "situational-grounding",
          ),
        },
        occurredAt: 200,
        producer: "test",
      },
      {
        kind: "explicit" as const,
        type: "thread.activity.recorded",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          activityId: "activity-analysis-1",
          runId: "run-1",
          phase: "situational-grounding",
          phaseTurnId: "phase-turn-1",
          scope: "analysis-phase",
          kind: "tool",
          message: "Used query_entities",
          status: "completed",
          toolName: "query_entities",
          occurredAt: 201,
        },
        occurredAt: 201,
        producer: "test",
      },
    ]);

    const [activity] = database.activities.listActivitiesByRunId("run-1");
    expect(activity).toMatchObject({
      id: "activity-analysis-1",
      runId: "run-1",
      phase: "situational-grounding",
      phaseTurnId: "phase-turn-1",
      scope: "analysis-phase",
      kind: "tool",
      status: "completed",
      toolName: "query_entities",
    });

    const run = database.runs.getRunState("run-1");
    expect(run).toMatchObject({
      latestActivity: {
        kind: "tool",
        message: "Used query_entities",
      },
      latestActivityAt: 201,
      latestPhaseTurnId: "phase-turn-1",
    });

    const turn =
      database.phaseTurnSummaries.getPhaseTurnSummary("phase-turn-1");
    expect(turn).toMatchObject({
      activitySummary: {
        lastKind: "tool",
        lastMessage: "Used query_entities",
        lastOccurredAt: 201,
      },
    });

    database.close();
  });

  it("projects analysis and revalidation runs separately on the same thread", () => {
    const database = createDatabase();
    const { context } = appendStartedRun(database);

    database.eventStore.appendEvents([
      {
        kind: "explicit" as const,
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
          promptProvenance: createRunPromptProvenance(),
          logCorrelation: {
            logFileName: "reval-1.jsonl",
          },
        },
        occurredAt: 300,
        producer: "test",
      },
      {
        kind: "explicit" as const,
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
          summary: {
            statusMessage: "Run started",
            completedPhases: 0,
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
        kind: "explicit" as const,
        type: "run.completed",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          finishedAt: 500,
          summary: {
            statusMessage: "Run completed",
            completedPhases: 0,
          },
        },
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

  it("marks the active phase turn failed when a run fails", () => {
    const database = createDatabase();
    const { context } = appendStartedRun(database);

    database.eventStore.appendEvents([
      {
        kind: "explicit" as const,
        type: "phase.started",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          phase: "situational-grounding",
          phaseTurnId: "phase-turn-failed",
          turnIndex: 1,
          promptProvenance: createPhasePromptProvenance(
            "situational-grounding",
          ),
        },
        occurredAt: 600,
        producer: "test",
      },
      {
        kind: "explicit" as const,
        type: "run.failed",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          activePhase: "situational-grounding",
          latestPhaseTurnId: "phase-turn-failed",
          failedPhase: "situational-grounding",
          error: {
            tag: "provider",
            message: "Upstream failure",
            retryable: false,
            reason: "unknown",
            provider: "claude",
          },
          finishedAt: 601,
          summary: {
            statusMessage: "Upstream failure",
            failedPhase: "situational-grounding",
            completedPhases: 0,
          },
        },
        occurredAt: 601,
        producer: "test",
      },
    ]);

    const run = database.runs.getRunState("run-1");
    expect(run).toMatchObject({
      status: "failed",
      latestPhaseTurnId: "phase-turn-failed",
      summary: {
        statusMessage: "Upstream failure",
        failedPhase: "situational-grounding",
        completedPhases: 0,
      },
    });

    const phaseTurn =
      database.phaseTurnSummaries.getPhaseTurnSummary("phase-turn-failed");
    expect(phaseTurn).toMatchObject({
      id: "phase-turn-failed",
      status: "failed",
      failure: expect.objectContaining({
        message: "Upstream failure",
      }),
    });

    database.close();
  });

  it("projects canonical chat messages and thread-scoped activities separately", () => {
    const database = createDatabase();
    const context = database.eventStore.resolveThreadContext({
      workspaceId: "workspace-1",
      threadTitle: "Chat thread",
      producer: "test",
      occurredAt: 600,
    });

    database.eventStore.appendEvents([
      ...(context.createdThreadEvent ? [context.createdThreadEvent] : []),
      {
        kind: "explicit" as const,
        type: "message.recorded",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        payload: {
          messageId: "msg-1",
          role: "user",
          content: "Walk me through the players.",
          createdAt: 601,
          updatedAt: 601,
        },
        occurredAt: 601,
        producer: "test",
      },
      {
        kind: "explicit" as const,
        type: "thread.activity.recorded",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        payload: {
          activityId: "activity-1",
          scope: "chat-turn",
          kind: "web-search",
          message: "Used WebSearch",
          status: "completed",
          toolName: "WebSearch",
          query: "trade war players",
          occurredAt: 602,
        },
        occurredAt: 602,
        producer: "test",
      },
      {
        kind: "explicit" as const,
        type: "message.recorded",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        payload: {
          messageId: "msg-2",
          role: "assistant",
          content: "The core players are the US, China, and allied blocs.",
          createdAt: 603,
          updatedAt: 603,
        },
        occurredAt: 603,
        producer: "test",
      },
    ]);

    const messages = database.messages.listMessagesByThreadId(context.threadId);
    expect(messages.map((message) => [message.role, message.content])).toEqual([
      ["user", "Walk me through the players."],
      ["assistant", "The core players are the US, China, and allied blocs."],
    ]);

    const activities = database.activities.listActivitiesByThreadId(
      context.threadId,
    );
    expect(activities).toEqual([
      expect.objectContaining({
        id: "activity-1",
        scope: "chat-turn",
        kind: "web-search",
        status: "completed",
        toolName: "WebSearch",
        query: "trade war players",
      }),
    ]);

    const thread = database.threads.getThreadState(context.threadId);
    expect(thread).toMatchObject({
      latestActivityAt: 603,
    });

    database.close();
  });

  it("projects analysis message metadata through the durable message read model", () => {
    const database = createDatabase();
    const context = database.eventStore.resolveThreadContext({
      workspaceId: "workspace-1",
      threadTitle: "Analysis thread",
      producer: "test",
      occurredAt: 700,
    });

    database.eventStore.appendEvents([
      ...(context.createdThreadEvent ? [context.createdThreadEvent] : []),
      {
        kind: "explicit" as const,
        type: "message.recorded",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          messageId: "msg-analysis-1",
          role: "assistant",
          content: "Completed Player Identification.",
          runId: "run-1",
          phaseTurnId: "phase-turn-2",
          phase: "player-identification",
          runKind: "analysis",
          source: "analysis",
          kind: "assistant-turn",
          createdAt: 701,
          updatedAt: 701,
        },
        occurredAt: 701,
        producer: "test",
      },
    ]);

    const [message] = database.messages.listMessagesByThreadId(context.threadId);
    expect(JSON.parse(message!.messageJson)).toMatchObject({
      runId: "run-1",
      phaseTurnId: "phase-turn-2",
      phase: "player-identification",
      runKind: "analysis",
      source: "analysis",
      kind: "assistant-turn",
    });

    database.close();
  });

  it("projects run.cancelled onto run state and phase turn", () => {
    const database = createDatabase();
    const { context } = appendStartedRun(database);

    database.eventStore.appendEvents([
      {
        kind: "explicit" as const,
        type: "phase.started",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          phase: "situational-grounding",
          phaseTurnId: "phase-turn-cancelled",
          turnIndex: 1,
          promptProvenance: createPhasePromptProvenance(
            "situational-grounding",
          ),
        },
        occurredAt: 700,
        producer: "test",
      },
      {
        kind: "explicit" as const,
        type: "run.cancelled",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          activePhase: "situational-grounding",
          latestPhaseTurnId: "phase-turn-cancelled",
          finishedAt: 701,
          summary: {
            statusMessage: "User cancelled",
            completedPhases: 0,
          },
        },
        occurredAt: 701,
        producer: "test",
      },
    ]);

    const run = database.runs.getRunState("run-1");
    expect(run).toMatchObject({
      status: "cancelled",
      summary: {
        statusMessage: "User cancelled",
      },
    });

    const phaseTurn = database.phaseTurnSummaries.getPhaseTurnSummary(
      "phase-turn-cancelled",
    );
    expect(phaseTurn).toMatchObject({
      status: "cancelled",
    });
    expect(phaseTurn!.failure).toBeUndefined();

    const thread = database.threads.getThreadState(context.threadId);
    expect(thread).toMatchObject({
      latestTerminalStatus: "cancelled",
    });

    database.close();
  });

  it("projects question.created into pending questions", () => {
    const database = createDatabase();
    const { context } = appendStartedRun(database);

    database.eventStore.appendEvents([
      {
        kind: "explicit" as const,
        type: "question.created",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          questionId: "q-1",
          header: "Input needed",
          question: "Which actors matter most?",
          options: [{ label: "Option A" }, { label: "Option B" }],
          multiSelect: false,
        },
        occurredAt: 800,
        producer: "test",
      },
    ]);

    const pending = database.questions.getById("q-1");
    expect(pending).toBeDefined();
    expect(pending!.status).toBe("pending");
    expect(pending!.question.header).toBe("Input needed");
    expect(pending!.question.question).toBe("Which actors matter most?");
    expect(pending!.question.options).toHaveLength(2);

    database.close();
  });

  it("projects question.resolved onto existing question", () => {
    const database = createDatabase();
    const { context } = appendStartedRun(database);

    database.eventStore.appendEvents([
      {
        kind: "explicit" as const,
        type: "question.created",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          questionId: "q-1",
          header: "Input needed",
          question: "Which actors matter most?",
          options: [{ label: "Option A" }, { label: "Option B" }],
          multiSelect: false,
        },
        occurredAt: 800,
        producer: "test",
      },
      {
        kind: "explicit" as const,
        type: "question.resolved",
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        runId: "run-1",
        payload: {
          questionId: "q-1",
          selectedOptions: [0],
          customText: "Both are important",
          resolvedAt: 900,
        },
        occurredAt: 900,
        producer: "test",
      },
    ]);

    const resolved = database.questions.getById("q-1");
    expect(resolved).toBeDefined();
    expect(resolved!.status).toBe("resolved");
    expect(resolved!.answer).toBeDefined();
    expect(resolved!.answer!.selectedOptions).toEqual([0]);
    expect(resolved!.answer!.customText).toBe("Both are important");

    database.close();
  });

  it("projects thread.renamed onto thread title", () => {
    const database = createDatabase();
    const context = database.eventStore.resolveThreadContext({
      workspaceId: "workspace-1",
      threadId: "thread-rename-test",
      threadTitle: "Original",
      producer: "test",
      occurredAt: 100,
    });

    database.eventStore.appendEvents([
      ...(context.createdThreadEvent ? [context.createdThreadEvent] : []),
    ]);

    const threadBefore = database.threads.getThreadState(context.threadId);
    expect(threadBefore).toBeDefined();
    expect(threadBefore!.title).toBe("Original");

    database.eventStore.appendEvents([
      {
        kind: "explicit" as const,
        type: "thread.renamed",
        workspaceId: "workspace-1",
        threadId: context.threadId,
        payload: {
          title: "Renamed Thread",
        },
        occurredAt: 200,
        producer: "test",
      },
    ]);

    const threadAfter = database.threads.getThreadState(context.threadId);
    expect(threadAfter).toBeDefined();
    expect(threadAfter!.title).toBe("Renamed Thread");

    database.close();
  });

  it("projects thread.deleted by removing thread state", () => {
    const database = createDatabase();
    const context = database.eventStore.resolveThreadContext({
      workspaceId: "workspace-1",
      threadId: "thread-delete-test",
      threadTitle: "Doomed Thread",
      producer: "test",
      occurredAt: 100,
    });

    database.eventStore.appendEvents([
      ...(context.createdThreadEvent ? [context.createdThreadEvent] : []),
    ]);

    const threadBefore = database.threads.getThreadState(context.threadId);
    expect(threadBefore).toBeDefined();

    database.eventStore.appendEvents([
      {
        kind: "explicit" as const,
        type: "thread.deleted",
        workspaceId: "workspace-1",
        threadId: context.threadId,
        payload: {
          deletedAt: 300,
        },
        occurredAt: 300,
        producer: "test",
      },
    ]);

    const threadAfter = database.threads.getThreadState(context.threadId);
    expect(threadAfter).toBeUndefined();

    database.close();
  });
});
