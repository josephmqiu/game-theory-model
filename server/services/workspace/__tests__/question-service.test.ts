import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("nanoid", () => ({
  nanoid: () => "test-id-123",
}));

vi.mock("../../../utils/ai-logger", () => ({
  serverLog: vi.fn(),
  serverWarn: vi.fn(),
}));

const mockAppendEvents = vi.fn();
const mockGetById = vi.fn();
const mockUpdateStatus = vi.fn();
const mockListByThreadId = vi.fn();
const mockGetThreadState = vi.fn();

vi.mock("../workspace-db", () => ({
  getWorkspaceDatabase: () => ({
    eventStore: { appendEvents: mockAppendEvents },
    questions: {
      getById: mockGetById,
      updateStatus: mockUpdateStatus,
      listByThreadId: mockListByThreadId,
    },
    threads: { getThreadState: mockGetThreadState },
  }),
}));

import {
  createPendingQuestion,
  waitForAnswer,
  resolveQuestion,
  dismissQuestion,
  listPendingByThread,
  getPendingQuestion,
  hasPendingResolver,
} from "../question-service";
import type { CreateQuestionInput } from "../question-service";
import { serverLog, serverWarn } from "../../../utils/ai-logger";

function makeInput(
  overrides?: Partial<CreateQuestionInput>,
): CreateQuestionInput {
  return {
    workspaceId: "ws-1",
    threadId: "ws-1:primary-thread",
    runId: "run-1",
    phase: "player-identification",
    header: "Choose actors",
    question: "Which actors should we model?",
    options: [{ label: "USA" }, { label: "China" }, { label: "EU" }],
    multiSelect: true,
    producer: "test-agent",
    ...overrides,
  };
}

describe("question-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── createPendingQuestion ──

  describe("createPendingQuestion", () => {
    it("returns a PendingQuestionState with status pending and a generated question id", () => {
      const result = createPendingQuestion(makeInput());

      expect(result.status).toBe("pending");
      expect(result.question.id).toBe("uiq-test-id-123");
      expect(result.question.threadId).toBe("ws-1:primary-thread");
      expect(result.question.runId).toBe("run-1");
      expect(result.question.phase).toBe("player-identification");
      expect(result.question.header).toBe("Choose actors");
      expect(result.question.question).toBe("Which actors should we model?");
      expect(result.question.options).toHaveLength(3);
      expect(result.question.multiSelect).toBe(true);
      expect(result.question.createdAt).toEqual(expect.any(Number));
    });

    it("appends a question.created and thread.activity.recorded domain event", () => {
      createPendingQuestion(makeInput());

      expect(mockAppendEvents).toHaveBeenCalledTimes(1);
      const events = mockAppendEvents.mock.calls[0][0];
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("question.created");
      expect(events[0].workspaceId).toBe("ws-1");
      expect(events[0].threadId).toBe("ws-1:primary-thread");
      expect(events[0].runId).toBe("run-1");
      expect(events[0].payload.questionId).toBe("uiq-test-id-123");
      expect(events[0].payload.header).toBe("Choose actors");

      expect(events[1].type).toBe("thread.activity.recorded");
      expect(events[1].payload.scope).toBe("analysis-phase");
      expect(events[1].payload.kind).toBe("note");
    });

    it("uses chat-turn scope when runId is absent", () => {
      createPendingQuestion(makeInput({ runId: undefined }));

      const events = mockAppendEvents.mock.calls[0][0];
      expect(events[1].payload.scope).toBe("chat-turn");
    });

    it("logs the question creation", () => {
      createPendingQuestion(makeInput());
      expect(serverLog).toHaveBeenCalledWith(
        "run-1",
        "question-service",
        expect.stringContaining("uiq-test-id-123"),
      );
    });
  });

  // ── waitForAnswer ──

  describe("waitForAnswer", () => {
    it("registers a pending resolver that blocks until resolveQuestion is called", async () => {
      const state = createPendingQuestion(makeInput());
      const questionId = state.question.id;

      const answerPromise = waitForAnswer(questionId);
      expect(hasPendingResolver(questionId)).toBe(true);

      // Simulate the question existing in the database
      mockGetById.mockReturnValue(state);
      mockGetThreadState.mockReturnValue({ workspaceId: "ws-1" });

      resolveQuestion({
        questionId,
        selectedOptions: [0, 1],
        customText: "Both major powers",
      });

      const answer = await answerPromise;
      expect(answer.questionId).toBe(questionId);
      expect(answer.selectedOptions).toEqual([0, 1]);
      expect(answer.customText).toBe("Both major powers");
      expect(answer.resolvedAt).toEqual(expect.any(Number));

      expect(hasPendingResolver(questionId)).toBe(false);
    });

    it("rejects immediately if the abort signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        waitForAnswer("uiq-already-aborted", controller.signal),
      ).rejects.toThrow("Question wait aborted before starting");
    });

    it("rejects when the abort signal fires after waiting has started", async () => {
      const controller = new AbortController();
      const promise = waitForAnswer("uiq-will-abort", controller.signal);

      expect(hasPendingResolver("uiq-will-abort")).toBe(true);

      // Mock dismissQuestion's DB call
      mockUpdateStatus.mockReturnValue(undefined);

      controller.abort();

      await expect(promise).rejects.toThrow("Question wait aborted");
      expect(hasPendingResolver("uiq-will-abort")).toBe(false);
    });
  });

  // ── resolveQuestion ──

  describe("resolveQuestion", () => {
    it("appends question.resolved and thread.activity.recorded events and resolves the waiting promise", async () => {
      const state = createPendingQuestion(makeInput());
      const questionId = state.question.id;
      const answerPromise = waitForAnswer(questionId);

      mockGetById.mockReturnValue(state);
      mockGetThreadState.mockReturnValue({ workspaceId: "ws-1" });
      mockAppendEvents.mockClear();

      resolveQuestion({
        questionId,
        selectedOptions: [2],
      });

      const answer = await answerPromise;
      expect(answer.selectedOptions).toEqual([2]);

      expect(mockAppendEvents).toHaveBeenCalledTimes(1);
      const events = mockAppendEvents.mock.calls[0][0];
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("question.resolved");
      expect(events[0].payload.questionId).toBe(questionId);
      expect(events[0].payload.selectedOptions).toEqual([2]);
      expect(events[0].workspaceId).toBe("ws-1");

      expect(events[1].type).toBe("thread.activity.recorded");
      expect(events[1].payload.status).toBe("completed");
    });

    it("warns and returns early when the question does not exist in the database", () => {
      mockGetById.mockReturnValue(undefined);

      resolveQuestion({ questionId: "uiq-nonexistent" });

      expect(serverWarn).toHaveBeenCalledWith(
        undefined,
        "question-service",
        expect.stringContaining("uiq-nonexistent"),
      );
      expect(mockAppendEvents).not.toHaveBeenCalled();
    });

    it("formats the activity message with option labels and custom text", async () => {
      const state = createPendingQuestion(makeInput());
      const questionId = state.question.id;
      const answerPromise = waitForAnswer(questionId);

      mockGetById.mockReturnValue(state);
      mockGetThreadState.mockReturnValue({ workspaceId: "ws-1" });
      mockAppendEvents.mockClear();

      resolveQuestion({
        questionId,
        selectedOptions: [0, 2],
        customText: "Focus on trade dynamics",
      });

      await answerPromise;

      const events = mockAppendEvents.mock.calls[0][0];
      const activityMessage = events[1].payload.message;
      expect(activityMessage).toContain("USA");
      expect(activityMessage).toContain("EU");
      expect(activityMessage).toContain("Focus on trade dynamics");
    });

    it("still appends events even when no resolver is waiting", () => {
      const state = createPendingQuestion(makeInput());
      mockGetById.mockReturnValue(state);
      mockGetThreadState.mockReturnValue({ workspaceId: "ws-1" });
      mockAppendEvents.mockClear();

      // resolveQuestion without calling waitForAnswer first
      resolveQuestion({
        questionId: state.question.id,
        customText: "Late answer",
      });

      expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    });
  });

  // ── dismissQuestion ──

  describe("dismissQuestion", () => {
    it("updates the database status and rejects the waiting promise", async () => {
      const state = createPendingQuestion(makeInput());
      const questionId = state.question.id;
      const answerPromise = waitForAnswer(questionId);

      dismissQuestion(questionId);

      await expect(answerPromise).rejects.toThrow(
        `Question "${questionId}" was dismissed`,
      );
      expect(mockUpdateStatus).toHaveBeenCalledWith(questionId, "dismissed");
      expect(hasPendingResolver(questionId)).toBe(false);
    });

    it("updates the database even when no resolver is waiting", () => {
      dismissQuestion("uiq-orphan");

      expect(mockUpdateStatus).toHaveBeenCalledWith("uiq-orphan", "dismissed");
      expect(serverLog).toHaveBeenCalledWith(
        undefined,
        "question-service",
        expect.stringContaining("uiq-orphan"),
      );
    });
  });

  // ── listPendingByThread ──

  describe("listPendingByThread", () => {
    it("delegates to questions.listByThreadId with pending status", () => {
      const fakeList = [{ question: { id: "q1" }, status: "pending" }];
      mockListByThreadId.mockReturnValue(fakeList);

      const result = listPendingByThread("ws-1:primary-thread");

      expect(mockListByThreadId).toHaveBeenCalledWith(
        "ws-1:primary-thread",
        "pending",
      );
      expect(result).toBe(fakeList);
    });
  });

  // ── getPendingQuestion ──

  describe("getPendingQuestion", () => {
    it("delegates to questions.getById", () => {
      const fakeState = {
        question: { id: "q1" },
        status: "pending" as const,
      };
      mockGetById.mockReturnValue(fakeState);

      const result = getPendingQuestion("q1");

      expect(mockGetById).toHaveBeenCalledWith("q1");
      expect(result).toBe(fakeState);
    });

    it("returns undefined when the question does not exist", () => {
      mockGetById.mockReturnValue(undefined);

      expect(getPendingQuestion("q-missing")).toBeUndefined();
    });
  });

  // ── hasPendingResolver ──

  describe("hasPendingResolver", () => {
    it("returns false when no resolver has been registered", () => {
      expect(hasPendingResolver("uiq-unknown")).toBe(false);
    });

    it("returns true after waitForAnswer registers a resolver", () => {
      const state = createPendingQuestion(makeInput());
      waitForAnswer(state.question.id);

      expect(hasPendingResolver(state.question.id)).toBe(true);
    });
  });
});
