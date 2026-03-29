import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceDatabase } from "../workspace-db";
import type {
  PhaseTurnPromptProvenance,
  RunPromptProvenance,
} from "../../../../shared/types/workspace-state";
import {
  DEFAULT_PROMPT_PACK_ID,
  DEFAULT_PROMPT_PACK_MODE,
  DEFAULT_PROMPT_PACK_VERSION,
} from "../../../../shared/types/prompt-pack";

let currentDatabase: WorkspaceDatabase | null = null;
const {
  clearProviderSessionBindingMock,
  getProviderSessionBindingMock,
  initializeFromDatabaseMock,
  getStaleEntityIdsMock,
  resumeDurableRunMock,
} = vi.hoisted(() => ({
  clearProviderSessionBindingMock: vi.fn(),
  getProviderSessionBindingMock: vi.fn(() => null),
  initializeFromDatabaseMock: vi.fn(),
  getStaleEntityIdsMock: vi.fn(() => []),
  resumeDurableRunMock: vi.fn(),
}));

vi.mock("../../utils/ai-logger", () => ({
  serverLog: vi.fn(),
  serverWarn: vi.fn(),
}));

vi.mock("../../entity-graph-service", () => ({
  initializeFromDatabase: initializeFromDatabaseMock,
  getStaleEntityIds: getStaleEntityIdsMock,
}));

vi.mock("../provider-session-binding-service", () => ({
  clearProviderSessionBinding: clearProviderSessionBindingMock,
  getProviderSessionBinding: getProviderSessionBindingMock,
}));

vi.mock("../../../agents/analysis-agent", () => ({
  resumeDurableRun: resumeDurableRunMock,
}));

vi.mock("../workspace-db", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../workspace-db")>();
  return {
    ...actual,
    getWorkspaceDatabase: () => {
      if (!currentDatabase) {
        throw new Error("Test workspace database not initialized");
      }
      return currentDatabase;
    },
  };
});

import * as runtimeStatus from "../../../services/runtime-status";
import { resolveQuestion } from "../question-service";
import {
  _resetWorkspaceRecoveryDiagnosticsForTest,
  listWorkspaceRecoveryDiagnostics,
} from "../runtime-recovery-diagnostics";
import {
  _resetRuntimeRecoveryForTest,
  waitForRuntimeRecovery,
} from "../runtime-recovery-service";
import { createWorkspaceDatabase } from "../workspace-db";

function getDatabase(): WorkspaceDatabase {
  if (!currentDatabase) {
    throw new Error("Test workspace database not initialized");
  }
  return currentDatabase;
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
    templateIdentity: `${DEFAULT_PROMPT_PACK_ID}:${phase}:initial`,
    templateHash: `${phase}-template-hash`,
    effectivePromptHash: `${phase}-effective-hash`,
    variant: "initial",
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

describe("runtime-recovery-service", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    _resetRuntimeRecoveryForTest();
    _resetWorkspaceRecoveryDiagnosticsForTest();
    runtimeStatus._resetForTest();
    clearProviderSessionBindingMock.mockReset();
    getProviderSessionBindingMock.mockReset();
    initializeFromDatabaseMock.mockReset();
    getStaleEntityIdsMock.mockReset();
    resumeDurableRunMock.mockReset();
    getStaleEntityIdsMock.mockReturnValue([]);
    getProviderSessionBindingMock.mockReturnValue(null);

    if (currentDatabase) {
      currentDatabase.close();
      currentDatabase = null;
    }

    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (!dir) continue;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    const tempDir = mkdtempSync(join(tmpdir(), "gta-runtime-recovery-"));
    tempDirs.push(tempDir);
    currentDatabase = createWorkspaceDatabase({
      databasePath: join(tempDir, "workspace-state.sqlite"),
    });
  });

  function appendRunningRun() {
    const database = getDatabase();
    const context = database.eventStore.resolveThreadContext({
      workspaceId: "workspace-1",
      producer: "test",
      occurredAt: 100,
    });

    database.eventStore.appendEvents([
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
        occurredAt: 100,
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
          phaseTurnId: "phase-turn-1",
          turnIndex: 1,
          promptProvenance: createPhasePromptProvenance(
            "situational-grounding",
          ),
        },
        occurredAt: 101,
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
          activePhase: "situational-grounding",
          progress: {
            completed: 0,
            total: 2,
          },
          summary: {
            statusMessage: "Run started",
            completedPhases: 0,
          },
          latestPhaseTurnId: "phase-turn-1",
        },
        occurredAt: 102,
        producer: "test",
      },
    ]);

    return context;
  }

  function appendPendingQuestion(questionId: string, threadId: string, runId?: string) {
    getDatabase().eventStore.appendEvents([
      {
        kind: "explicit" as const,
        type: "question.created",
        workspaceId: "workspace-1",
        threadId,
        runId,
        payload: {
          questionId,
          header: "Clarification needed",
          question: `Question ${questionId}`,
          options: [{ label: "A" }, { label: "B" }],
          multiSelect: false,
        },
        occurredAt: Date.now(),
        producer: "test",
      },
    ]);
  }

  it("fails a running run when its provider binding is missing", async () => {
    const context = appendRunningRun();
    appendPendingQuestion("q-running", context.threadId, "run-1");

    await waitForRuntimeRecovery();

    expect(getDatabase().runs.getRunState("run-1")).toMatchObject({
      status: "failed",
      activePhase: null,
      finishedAt: expect.any(Number),
      summary: {
        completedPhases: 0,
      },
    });
    expect(
      getDatabase().runs.getRunState("run-1")?.summary?.statusMessage,
    ).toContain("missing local provider session binding");
    expect(getDatabase().questions.getById("q-running")).toMatchObject({
      status: "pending",
    });
    expect(clearProviderSessionBindingMock).toHaveBeenCalledWith(
      context.threadId,
      expect.objectContaining({
        runId: "run-1",
        purpose: "analysis",
        reason: "missing_local_binding",
      }),
    );
    expect(initializeFromDatabaseMock).toHaveBeenCalledWith("workspace-1");
  });

  it("starts durable resume immediately when a running run has a valid binding", async () => {
    const context = appendRunningRun();
    getProviderSessionBindingMock.mockReturnValue({
      version: 1,
      provider: "claude",
      workspaceId: context.workspaceId,
      threadId: context.threadId,
      purpose: "analysis",
      runId: "run-1",
      phaseTurnId: "phase-turn-1",
      providerSessionId: "claude-session-1",
      claudeSessionId: "claude-session-1",
      updatedAt: 200,
    } as any);
    resumeDurableRunMock.mockResolvedValue({
      runId: "run-1",
      workspaceId: context.workspaceId,
      threadId: context.threadId,
    });

    await waitForRuntimeRecovery();

    expect(resumeDurableRunMock).toHaveBeenCalledWith({
      runId: "run-1",
    });
    expect(getDatabase().runs.getRunState("run-1")).toMatchObject({
      status: "running",
      activePhase: "situational-grounding",
    });
  });

  it("defers durable resume until a persisted pending question is answered", async () => {
    const context = appendRunningRun();
    appendPendingQuestion("q-running", context.threadId, "run-1");
    getProviderSessionBindingMock.mockReturnValue({
      version: 1,
      provider: "claude",
      workspaceId: context.workspaceId,
      threadId: context.threadId,
      purpose: "analysis",
      runId: "run-1",
      phaseTurnId: "phase-turn-1",
      providerSessionId: "claude-session-1",
      claudeSessionId: "claude-session-1",
      updatedAt: 200,
    } as any);
    resumeDurableRunMock.mockResolvedValue({
      runId: "run-1",
      workspaceId: context.workspaceId,
      threadId: context.threadId,
    });

    await waitForRuntimeRecovery();

    expect(resumeDurableRunMock).not.toHaveBeenCalled();
    expect(getDatabase().questions.getById("q-running")).toMatchObject({
      status: "pending",
    });

    const diagnostics = listWorkspaceRecoveryDiagnostics().filter(
      (diagnostic) => diagnostic.code === "resume-deferred-on-question",
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      data: expect.objectContaining({
        questionId: "q-running",
        pendingQuestionCount: 1,
      }),
    });

    resolveQuestion({
      questionId: "q-running",
      customText: "Recovered answer",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(resumeDurableRunMock).toHaveBeenCalledWith({
      runId: "run-1",
    });
  });

  it("reuses the startup recovery promise instead of re-running reconciliation", async () => {
    const context = appendRunningRun();
    appendPendingQuestion("q-once", context.threadId, "run-1");

    await waitForRuntimeRecovery();
    const diagnosticsAfterFirstRun = listWorkspaceRecoveryDiagnostics();

    await waitForRuntimeRecovery();
    const diagnosticsAfterSecondRun = listWorkspaceRecoveryDiagnostics();

    expect(diagnosticsAfterSecondRun).toEqual(diagnosticsAfterFirstRun);
    expect(
      diagnosticsAfterSecondRun.filter(
        (diagnostic) => diagnostic.code === "recovery-scan-started",
      ),
    ).toHaveLength(1);
    expect(getDatabase().questions.getById("q-once")).toMatchObject({
      status: "pending",
    });
  });
});
