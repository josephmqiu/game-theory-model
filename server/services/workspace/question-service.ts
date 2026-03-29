import { nanoid } from "nanoid";
import type {
  PendingQuestionState,
  UserInputAnswer,
  UserInputOption,
  UserInputQuestion,
  UserInputQuestionStatus,
} from "../../../shared/types/user-input";
import { getWorkspaceDatabase } from "./workspace-db";
import { serverLog, serverWarn } from "../../utils/ai-logger";

export interface CreateQuestionInput {
  workspaceId: string;
  threadId: string;
  runId?: string;
  phase?: string;
  header: string;
  question: string;
  options?: UserInputOption[];
  multiSelect?: boolean;
  producer: string;
}

export interface ResolveQuestionInput {
  questionId: string;
  selectedOptions?: number[];
  customText?: string;
}

interface PendingResolver {
  resolve: (answer: UserInputAnswer) => void;
  reject: (reason: Error) => void;
}

const pendingResolvers = new Map<string, PendingResolver>();

function questionsMatch(
  existing: UserInputQuestion,
  input: CreateQuestionInput,
): boolean {
  if (existing.threadId !== input.threadId) {
    return false;
  }
  if ((existing.runId ?? null) !== (input.runId ?? null)) {
    return false;
  }
  if ((existing.phase ?? null) !== (input.phase ?? null)) {
    return false;
  }
  if (existing.header !== input.header || existing.question !== input.question) {
    return false;
  }
  if ((existing.multiSelect ?? false) !== (input.multiSelect ?? false)) {
    return false;
  }

  const existingOptions = existing.options ?? [];
  const inputOptions = input.options ?? [];
  if (existingOptions.length !== inputOptions.length) {
    return false;
  }

  return existingOptions.every(
    (option, index) =>
      option.label === inputOptions[index]?.label &&
      option.description === inputOptions[index]?.description,
  );
}

function findReusableQuestion(
  input: CreateQuestionInput,
): PendingQuestionState | undefined {
  const db = getWorkspaceDatabase();
  const candidates = input.runId
    ? db.questions.listByRunId(input.runId)
    : db.questions.listByThreadId(input.threadId);

  return candidates.find(
    (candidate) =>
      candidate.status !== "dismissed" &&
      questionsMatch(candidate.question, input),
  );
}

export function createPendingQuestion(
  input: CreateQuestionInput,
): PendingQuestionState {
  const now = Date.now();
  const questionId = `uiq-${nanoid()}`;
  const question: UserInputQuestion = {
    id: questionId,
    threadId: input.threadId,
    runId: input.runId,
    phase: input.phase,
    header: input.header,
    question: input.question,
    options: input.options,
    multiSelect: input.multiSelect,
    createdAt: now,
  };

  const db = getWorkspaceDatabase();
  db.eventStore.appendEvents([
    {
      kind: "explicit" as const,
      type: "question.created",
      workspaceId: input.workspaceId,
      threadId: input.threadId,
      runId: input.runId,
      payload: {
        questionId,
        header: input.header,
        question: input.question,
        options: input.options,
        multiSelect: input.multiSelect,
      },
      producer: input.producer,
      occurredAt: now,
    },
    {
      kind: "explicit" as const,
      type: "thread.activity.recorded",
      workspaceId: input.workspaceId,
      threadId: input.threadId,
      runId: input.runId,
      payload: {
        activityId: `act-${nanoid()}`,
        scope: input.runId ? "analysis-phase" : "chat-turn",
        kind: "note",
        message: `Question: ${input.header} — ${input.question}`,
        occurredAt: now,
      },
      producer: input.producer,
      occurredAt: now,
    },
  ]);

  serverLog(
    input.runId,
    "question-service",
    `Created pending question "${questionId}" in thread ${input.threadId}`,
  );

  return {
    kind: "question",
    question,
    status: "pending",
  };
}

export function getOrCreatePendingQuestion(
  input: CreateQuestionInput,
): PendingQuestionState {
  const existing = findReusableQuestion(input);
  if (existing) {
    serverLog(
      existing.question.runId,
      "question-service",
      `Reused persisted question "${existing.question.id}" in thread ${existing.question.threadId}`,
    );
    return existing;
  }

  return createPendingQuestion(input);
}

export function waitForAnswer(
  questionId: string,
  signal?: AbortSignal,
): Promise<UserInputAnswer> {
  const existing = getWorkspaceDatabase().questions.getById(questionId);
  if (existing?.status === "resolved" && existing.answer) {
    return Promise.resolve(existing.answer);
  }
  if (existing?.status === "dismissed") {
    return Promise.reject(new Error(`Question "${questionId}" was dismissed`));
  }

  return new Promise<UserInputAnswer>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Question wait aborted before starting"));
      return;
    }

    pendingResolvers.set(questionId, { resolve, reject });

    if (signal) {
      const onAbort = () => {
        const resolver = pendingResolvers.get(questionId);
        if (resolver) {
          pendingResolvers.delete(questionId);
          dismissQuestion(questionId);
          resolver.reject(new Error("Question wait aborted"));
        }
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

export function reattachPendingQuestionWait(
  questionId: string,
  signal?: AbortSignal,
): Promise<UserInputAnswer> {
  return waitForAnswer(questionId, signal);
}

export function resolveQuestion(input: ResolveQuestionInput): void {
  const now = Date.now();
  const answer: UserInputAnswer = {
    questionId: input.questionId,
    selectedOptions: input.selectedOptions,
    customText: input.customText,
    resolvedAt: now,
  };

  const db = getWorkspaceDatabase();
  const existing = db.questions.getById(input.questionId);
  if (!existing) {
    serverWarn(
      undefined,
      "question-service",
      `Cannot resolve unknown question "${input.questionId}"`,
    );
    return;
  }

  const thread = db.threads.getThreadState(existing.question.threadId);
  if (!thread) {
    serverWarn(
      undefined,
      "question-service",
      `Thread "${existing.question.threadId}" not found for question "${input.questionId}"`,
    );
    return;
  }
  const workspaceId = thread.workspaceId;

  db.eventStore.appendEvents([
    {
      kind: "explicit" as const,
      type: "question.resolved",
      workspaceId,
      threadId: existing.question.threadId,
      runId: existing.question.runId,
      payload: {
        questionId: input.questionId,
        selectedOptions: input.selectedOptions,
        customText: input.customText,
        resolvedAt: now,
      },
      producer: "question-service",
      occurredAt: now,
    },
    {
      kind: "explicit" as const,
      type: "thread.activity.recorded",
      workspaceId,
      threadId: existing.question.threadId,
      runId: existing.question.runId,
      payload: {
        activityId: `act-${nanoid()}`,
        scope: existing.question.runId ? "analysis-phase" : "chat-turn",
        kind: "note",
        message: `Answered: ${formatAnswer(input, existing.question)}`,
        status: "completed",
        occurredAt: now,
      },
      producer: "question-service",
      occurredAt: now,
    },
  ]);

  serverLog(
    existing.question.runId,
    "question-service",
    `Resolved question "${input.questionId}"`,
  );

  const resolver = pendingResolvers.get(input.questionId);
  if (resolver) {
    pendingResolvers.delete(input.questionId);
    resolver.resolve(answer);
  }
}

export function dismissQuestion(questionId: string): void {
  const db = getWorkspaceDatabase();
  db.questions.updateStatus(questionId, "dismissed");

  const resolver = pendingResolvers.get(questionId);
  if (resolver) {
    pendingResolvers.delete(questionId);
    resolver.reject(new Error(`Question "${questionId}" was dismissed`));
  }

  serverLog(
    undefined,
    "question-service",
    `Dismissed question "${questionId}"`,
  );
}

export function listPendingByThread(threadId: string): PendingQuestionState[] {
  return getWorkspaceDatabase().questions.listByThreadId(threadId, "pending");
}

export function listPendingByRun(runId: string): PendingQuestionState[] {
  return getWorkspaceDatabase().questions.listByRunId(runId, "pending");
}

export function getPendingQuestion(
  questionId: string,
): PendingQuestionState | undefined {
  return getWorkspaceDatabase().questions.getById(questionId);
}

export function getQuestionAnswer(
  questionId: string,
): UserInputAnswer | undefined {
  const question = getWorkspaceDatabase().questions.getById(questionId);
  return question?.status === "resolved" ? question.answer : undefined;
}

export function getQuestionStatus(
  questionId: string,
): UserInputQuestionStatus | undefined {
  return getWorkspaceDatabase().questions.getById(questionId)?.status;
}

export function hasPendingResolver(questionId: string): boolean {
  return pendingResolvers.has(questionId);
}

function formatAnswer(
  input: ResolveQuestionInput,
  question: UserInputQuestion,
): string {
  const parts: string[] = [];
  if (input.selectedOptions?.length && question.options) {
    const labels = input.selectedOptions
      .map((i) => question.options![i]?.label)
      .filter(Boolean);
    parts.push(labels.join(", "));
  }
  if (input.customText) {
    parts.push(input.customText);
  }
  return parts.join(" — ") || "(no answer)";
}
