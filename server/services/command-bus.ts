import { nanoid } from "nanoid";
import type {
  Analysis,
  AnalysisEntity,
  AnalysisRelationship,
  EntityProvenance,
} from "../../shared/types/entity";
import type { AnalysisRuntimeOverrides } from "../../shared/types/analysis-runtime";
import { serverError, serverLog, serverWarn } from "../utils/ai-logger";

export type CommandReceiptStatus =
  | "accepted"
  | "running"
  | "completed"
  | "failed"
  | "conflicted"
  | "deduplicated";

export interface CommandMetadataInput {
  commandId?: string;
  receiptId?: string;
  correlationId?: string;
  causationId?: string;
  runId?: string;
  workspaceId?: string;
  threadId?: string;
  requestedBy?: string;
  submittedAt?: number;
}

export interface ResolvedCommandMetadata extends Omit<
  CommandMetadataInput,
  "commandId"
> {
  commandId: string;
  requestedBy: string;
  submittedAt: number;
}

export interface AnalysisStartCommandInput extends CommandMetadataInput {
  kind: "analysis.start";
  topic: string;
  provider?: string;
  model?: string;
  runtime?: AnalysisRuntimeOverrides;
}

export interface AnalysisAbortCommandInput extends CommandMetadataInput {
  kind: "analysis.abort";
}

export interface AnalysisResetCommandInput extends CommandMetadataInput {
  kind: "analysis.reset";
  topic: string;
}

export interface EntityCreateCommandInput extends CommandMetadataInput {
  kind: "entity.create";
  entity: Omit<AnalysisEntity, "id" | "provenance" | "source">;
  provenanceSource: EntityProvenance["source"];
  provenancePhase?: string;
}

export interface EntityUpdateCommandInput extends CommandMetadataInput {
  kind: "entity.update";
  id: string;
  updates: Partial<Omit<AnalysisEntity, "id" | "provenance" | "source">>;
  provenanceSource: EntityProvenance["source"];
}

export interface EntityDeleteCommandInput extends CommandMetadataInput {
  kind: "entity.delete";
  id: string;
}

export interface RelationshipCreateCommandInput extends CommandMetadataInput {
  kind: "relationship.create";
  relationship: Omit<AnalysisRelationship, "id">;
  provenanceSource?: EntityProvenance["source"];
  provenancePhase?: string;
}

export interface RelationshipDeleteCommandInput extends CommandMetadataInput {
  kind: "relationship.delete";
  id: string;
}

export interface RevalidationStartCommandInput extends CommandMetadataInput {
  kind: "revalidation.start";
  startPhase: string;
  staleEntityIds?: string[];
}

export type SubmitCommand =
  | AnalysisStartCommandInput
  | AnalysisAbortCommandInput
  | AnalysisResetCommandInput
  | EntityCreateCommandInput
  | EntityUpdateCommandInput
  | EntityDeleteCommandInput
  | RelationshipCreateCommandInput
  | RelationshipDeleteCommandInput
  | RevalidationStartCommandInput;

export type Command = SubmitCommand & ResolvedCommandMetadata;

export interface AnalysisStartResult {
  runId: string;
  workspaceId: string;
  threadId: string;
  status: "started";
  estimatedPhases: number;
}

export interface AnalysisAbortResult {
  aborted: boolean;
  runId?: string;
  status?: "idle";
}

export interface AnalysisResetResult {
  analysis: Readonly<Analysis>;
  revision: number;
}

export interface EntityMutationResult {
  created: AnalysisEntity[];
  updated: AnalysisEntity[];
  staleMarked: string[];
  revision: number;
}

export interface DeleteResult {
  deleted: true;
  id: string;
  revision: number;
}

export interface RevalidationStartResult {
  runId: string;
  status: string;
  startPhase: string;
}

export interface CommandResultMap {
  "analysis.start": AnalysisStartResult;
  "analysis.abort": AnalysisAbortResult;
  "analysis.reset": AnalysisResetResult;
  "entity.create": EntityMutationResult;
  "entity.update": EntityMutationResult;
  "entity.delete": DeleteResult;
  "relationship.create": AnalysisRelationship;
  "relationship.delete": DeleteResult;
  "revalidation.start": RevalidationStartResult;
}

export interface CommandErrorInfo {
  name: string;
  message: string;
  stack?: string;
}

export interface CommandReceipt<TResult = unknown> {
  commandId: string;
  receiptId?: string;
  correlationId?: string;
  causationId?: string;
  runId?: string;
  workspaceId?: string;
  threadId?: string;
  requestedBy: string;
  kind: Command["kind"];
  status: CommandReceiptStatus;
  payloadFingerprint: string;
  submittedAt: number;
  acceptedAt: number;
  startedAt?: number;
  finishedAt?: number;
  duplicateOfCommandId?: string;
  conflictWithCommandId?: string;
  result?: TResult;
  error?: CommandErrorInfo;
}

export interface CommandReceiptStore {
  getByCommandId(commandId: string): CommandReceipt | undefined;
  getByReceiptId(receiptId: string): CommandReceipt | undefined;
  save(receipt: CommandReceipt): void;
  list(): CommandReceipt[];
  clear(): void;
}

type CommandKind = Command["kind"];
export type CommandHandlerMap = {
  [K in CommandKind]: (
    command: Extract<Command, { kind: K }>,
  ) => Promise<CommandResultMap[K]>;
};

interface CreateCommandBusOptions {
  handlers?: Partial<CommandHandlerMap>;
  receiptStore?: CommandReceiptStore;
}

export interface StartCommandOptions {
  schedule?: (run: () => void) => void;
}

export interface StartedCommand {
  receipt: CommandReceipt;
  completion: Promise<CommandReceipt>;
}

export interface CommandBus {
  startCommand(
    command: SubmitCommand,
    options?: StartCommandOptions,
  ): Promise<StartedCommand>;
  submitCommand(command: SubmitCommand): Promise<CommandReceipt>;
  getReceipt(commandId: string): CommandReceipt | undefined;
  getReceiptByReceiptId(receiptId: string): CommandReceipt | undefined;
  listReceipts(): CommandReceipt[];
  resetForTest(): void;
}

function createInMemoryReceiptStore(): CommandReceiptStore {
  const receiptsByCommandId = new Map<string, CommandReceipt>();
  const receiptsByReceiptId = new Map<string, CommandReceipt>();

  return {
    getByCommandId(commandId) {
      return receiptsByCommandId.get(commandId);
    },
    getByReceiptId(receiptId) {
      return receiptsByReceiptId.get(receiptId);
    },
    save(receipt) {
      receiptsByCommandId.set(receipt.commandId, receipt);
      if (receipt.receiptId) {
        const current = receiptsByReceiptId.get(receipt.receiptId);
        if (!current || current.commandId === receipt.commandId) {
          receiptsByReceiptId.set(receipt.receiptId, receipt);
        }
      }
    },
    list() {
      return Array.from(receiptsByCommandId.values());
    },
    clear() {
      receiptsByCommandId.clear();
      receiptsByReceiptId.clear();
    },
  };
}

function normalizeMetadata(command: SubmitCommand): ResolvedCommandMetadata {
  return {
    commandId: command.commandId?.trim() || `cmd-${nanoid()}`,
    receiptId: command.receiptId?.trim() || undefined,
    correlationId: command.correlationId?.trim() || undefined,
    causationId: command.causationId?.trim() || undefined,
    runId: command.runId?.trim() || undefined,
    workspaceId: command.workspaceId?.trim() || undefined,
    threadId: command.threadId?.trim() || undefined,
    requestedBy: command.requestedBy?.trim() || "server",
    submittedAt: command.submittedAt ?? Date.now(),
  };
}

function normalizeCommand(command: SubmitCommand): Command {
  return {
    ...command,
    ...normalizeMetadata(command),
  };
}

function normalizeForFingerprint(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForFingerprint(item));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, normalizeForFingerprint(record[key])]),
    );
  }
  return value;
}

function fingerprintCommand(command: Command): string {
  const stablePayload = { ...command } as Record<string, unknown>;
  delete stablePayload.commandId;
  delete stablePayload.receiptId;
  delete stablePayload.correlationId;
  delete stablePayload.causationId;
  delete stablePayload.requestedBy;
  delete stablePayload.submittedAt;
  return JSON.stringify(normalizeForFingerprint(stablePayload));
}

function serializeError(error: unknown): CommandErrorInfo {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  return {
    name: "Error",
    message: String(error),
  };
}

function cloneReceipt<TResult>(
  receipt: CommandReceipt<TResult>,
): CommandReceipt<TResult> {
  return {
    ...receipt,
    ...(receipt.error ? { error: { ...receipt.error } } : {}),
  };
}

function createReceipt<TResult>(
  command: Command,
  status: CommandReceiptStatus,
  payloadFingerprint: string,
): CommandReceipt<TResult> {
  return {
    commandId: command.commandId,
    receiptId: command.receiptId,
    correlationId: command.correlationId,
    causationId: command.causationId,
    runId: command.runId,
    workspaceId: command.workspaceId,
    threadId: command.threadId,
    requestedBy: command.requestedBy,
    kind: command.kind,
    status,
    payloadFingerprint,
    submittedAt: command.submittedAt,
    acceptedAt: Date.now(),
  };
}

function createConflictReceipt(
  command: Command,
  payloadFingerprint: string,
  message: string,
  conflictWithCommandId?: string,
): CommandReceipt {
  const conflicted = createReceipt(command, "conflicted", payloadFingerprint);
  conflicted.finishedAt = Date.now();
  conflicted.conflictWithCommandId = conflictWithCommandId;
  conflicted.error = {
    name: "CommandReceiptConflict",
    message,
  };
  return conflicted;
}

function createDeduplicatedReceipt(
  command: Command,
  payloadFingerprint: string,
  existing: CommandReceipt,
): CommandReceipt {
  const deduplicated = createReceipt(
    command,
    "deduplicated",
    payloadFingerprint,
  );
  deduplicated.startedAt = deduplicated.acceptedAt;
  deduplicated.duplicateOfCommandId = existing.commandId;
  if (existing.finishedAt !== undefined) {
    deduplicated.finishedAt = Date.now();
  }
  if (existing.result !== undefined) {
    deduplicated.result = existing.result;
  }
  if (existing.error) {
    deduplicated.error = { ...existing.error };
  }
  return deduplicated;
}

function resolveExistingReceipt(
  command: Command,
  receiptStore: CommandReceiptStore,
  payloadFingerprint: string,
): {
  source?: "commandId" | "receiptId" | "both";
  existing?: CommandReceipt;
  conflict?: CommandReceipt;
} {
  const existingByCommandId = receiptStore.getByCommandId(command.commandId);
  const existingByReceiptId = command.receiptId
    ? receiptStore.getByReceiptId(command.receiptId)
    : undefined;

  if (
    existingByCommandId &&
    existingByReceiptId &&
    existingByCommandId.commandId !== existingByReceiptId.commandId
  ) {
    return {
      source: "both",
      conflict: createConflictReceipt(
        command,
        payloadFingerprint,
        `commandId "${command.commandId}" and receiptId "${command.receiptId}" refer to different existing commands`,
        existingByReceiptId.commandId,
      ),
    };
  }

  const existing = existingByCommandId ?? existingByReceiptId;
  if (!existing) {
    return {};
  }

  if (existing.payloadFingerprint !== payloadFingerprint) {
    return {
      source: existingByCommandId ? "commandId" : "receiptId",
      conflict: createConflictReceipt(
        command,
        payloadFingerprint,
        existingByCommandId
          ? `Command "${command.commandId}" was already used for a different command`
          : `Receipt "${command.receiptId}" was already used for a different command`,
        existing.commandId,
      ),
    };
  }

  return {
    source: existingByCommandId ? "commandId" : "receiptId",
    existing,
  };
}

function resolveLogRunId(
  command: Command,
  receipt: CommandReceipt,
): string | undefined {
  if (receipt.runId) {
    return receipt.runId;
  }
  if (command.kind === "analysis.start" && receipt.result) {
    return (receipt.result as AnalysisStartResult).runId;
  }
  if (command.kind === "analysis.abort" && receipt.result) {
    return (receipt.result as AnalysisAbortResult).runId;
  }
  return command.runId;
}

function hydrateReceiptFromResult(
  command: Command,
  receipt: CommandReceipt,
  result: unknown,
): void {
  if (command.kind === "analysis.start" && result) {
    const analysisStart = result as AnalysisStartResult;
    receipt.runId = analysisStart.runId;
    receipt.workspaceId = analysisStart.workspaceId;
    receipt.threadId = analysisStart.threadId;
    return;
  }

  if (command.kind === "analysis.abort" && result) {
    const abortResult = result as AnalysisAbortResult;
    if (abortResult.runId) {
      receipt.runId = abortResult.runId;
    }
  }
}

function logReceiptEvent(
  level: "log" | "warn" | "error",
  command: Command,
  receipt: CommandReceipt,
  event: string,
  data?: Record<string, unknown>,
): void {
  const runId = resolveLogRunId(command, receipt);
  const payload = {
    commandId: receipt.commandId,
    receiptId: receipt.receiptId,
    correlationId: receipt.correlationId,
    causationId: receipt.causationId,
    requestedBy: receipt.requestedBy,
    kind: receipt.kind,
    status: receipt.status,
    duplicateOfCommandId: receipt.duplicateOfCommandId,
    conflictWithCommandId: receipt.conflictWithCommandId,
    ...(data ?? {}),
  };

  if (level === "warn") {
    serverWarn(runId, "command-bus", event, payload);
    return;
  }
  if (level === "error") {
    serverError(runId, "command-bus", event, payload);
    return;
  }
  serverLog(runId, "command-bus", event, payload);
}

export function createCommandBus(
  options: CreateCommandBusOptions = {},
): CommandBus {
  const receiptStore = options.receiptStore ?? createInMemoryReceiptStore();
  const handlers = (options.handlers ?? {}) as CommandHandlerMap;
  const completions = new Map<string, Promise<CommandReceipt>>();
  let queueTail: Promise<void> = Promise.resolve();

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queueTail.then(task, task);
    queueTail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const scheduleTask = <T>(
    task: () => Promise<T>,
    schedule?: (run: () => void) => void,
  ): Promise<T> => {
    if (!schedule) {
      return enqueue(task);
    }

    return new Promise<T>((resolve, reject) => {
      try {
        schedule(() => {
          void enqueue(task).then(resolve, reject);
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  return {
    async startCommand(commandInput, options = {}) {
      const command = normalizeCommand(commandInput);
      const payloadFingerprint = fingerprintCommand(command);
      const resolved = resolveExistingReceipt(
        command,
        receiptStore,
        payloadFingerprint,
      );

      if (resolved.conflict) {
        if (resolved.source === "receiptId") {
          receiptStore.save(resolved.conflict);
        }
        logReceiptEvent(
          command.runId ? "warn" : "error",
          command,
          resolved.conflict,
          "conflicted",
        );
        const receipt = cloneReceipt(resolved.conflict);
        return {
          receipt,
          completion: Promise.resolve(receipt),
        };
      }

      if (resolved.existing) {
        const existingCompletion = completions.get(resolved.existing.commandId);
        if (resolved.source === "commandId") {
          const receipt = cloneReceipt(resolved.existing);
          return {
            receipt,
            completion: existingCompletion ?? Promise.resolve(receipt),
          };
        }

        const deduplicated = createDeduplicatedReceipt(
          command,
          payloadFingerprint,
          resolved.existing,
        );
        receiptStore.save(deduplicated);
        logReceiptEvent("log", command, deduplicated, "deduplicated");
        const receipt = cloneReceipt(deduplicated);
        const completion = existingCompletion
          ? existingCompletion.then((settledExisting) => {
              if (settledExisting.result !== undefined) {
                deduplicated.result = settledExisting.result;
              }
              if (settledExisting.error) {
                deduplicated.error = { ...settledExisting.error };
              }
              deduplicated.finishedAt = Date.now();
              receiptStore.save(deduplicated);
              return cloneReceipt(deduplicated);
            })
          : Promise.resolve(receipt);
        return {
          receipt,
          completion,
        };
      }

      const accepted = createReceipt(command, "accepted", payloadFingerprint);
      receiptStore.save(accepted);
      logReceiptEvent("log", command, accepted, "accepted");

      const completion = scheduleTask(async () => {
        accepted.status = "running";
        accepted.startedAt = Date.now();
        receiptStore.save(accepted);
        logReceiptEvent("log", command, accepted, "started");

        try {
          const handler = handlers[command.kind] as (
            current: Command,
          ) => Promise<unknown>;
          const result = await handler(command);
          hydrateReceiptFromResult(command, accepted, result);
          accepted.status = "completed";
          accepted.finishedAt = Date.now();
          accepted.result = result;
          receiptStore.save(accepted);
          logReceiptEvent("log", command, accepted, "completed");
          return cloneReceipt(accepted);
        } catch (error) {
          accepted.status = "failed";
          accepted.finishedAt = Date.now();
          accepted.error = serializeError(error);
          receiptStore.save(accepted);
          logReceiptEvent("error", command, accepted, "failed", {
            error: accepted.error,
          });
          return cloneReceipt(accepted);
        }
      }, options.schedule);

      completions.set(command.commandId, completion);
      void completion.finally(() => {
        completions.delete(command.commandId);
      });

      return {
        receipt: cloneReceipt(accepted),
        completion,
      };
    },

    async submitCommand(commandInput) {
      const started = await this.startCommand(commandInput);
      return started.completion;
    },

    getReceipt(commandId) {
      const receipt = receiptStore.getByCommandId(commandId);
      return receipt ? cloneReceipt(receipt) : undefined;
    },

    getReceiptByReceiptId(receiptId) {
      const receipt = receiptStore.getByReceiptId(receiptId);
      return receipt ? cloneReceipt(receipt) : undefined;
    },

    listReceipts() {
      return receiptStore.list().map((receipt) => cloneReceipt(receipt));
    },

    resetForTest() {
      receiptStore.clear();
      completions.clear();
      queueTail = Promise.resolve();
    },
  };
}
