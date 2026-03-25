import { nanoid } from "nanoid";
import type {
  Analysis,
  AnalysisEntity,
  AnalysisRelationship,
  EntityProvenance,
} from "../../shared/types/entity";
import type { AnalysisRuntimeOverrides } from "../../shared/types/analysis-runtime";
import * as analysisOrchestrator from "../agents/analysis-agent";
import * as entityGraphService from "./entity-graph-service";
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

interface ResolvedCommandMetadata extends Omit<CommandMetadataInput, "commandId"> {
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

export type SubmitCommand =
  | AnalysisStartCommandInput
  | AnalysisAbortCommandInput
  | AnalysisResetCommandInput
  | EntityCreateCommandInput
  | EntityUpdateCommandInput
  | EntityDeleteCommandInput
  | RelationshipCreateCommandInput
  | RelationshipDeleteCommandInput;

export type Command =
  | (Omit<AnalysisStartCommandInput, keyof CommandMetadataInput> &
      ResolvedCommandMetadata)
  | (Omit<AnalysisAbortCommandInput, keyof CommandMetadataInput> &
      ResolvedCommandMetadata)
  | (Omit<AnalysisResetCommandInput, keyof CommandMetadataInput> &
      ResolvedCommandMetadata)
  | (Omit<EntityCreateCommandInput, keyof CommandMetadataInput> &
      ResolvedCommandMetadata)
  | (Omit<EntityUpdateCommandInput, keyof CommandMetadataInput> &
      ResolvedCommandMetadata)
  | (Omit<EntityDeleteCommandInput, keyof CommandMetadataInput> &
      ResolvedCommandMetadata)
  | (Omit<RelationshipCreateCommandInput, keyof CommandMetadataInput> &
      ResolvedCommandMetadata)
  | (Omit<RelationshipDeleteCommandInput, keyof CommandMetadataInput> &
      ResolvedCommandMetadata);

export interface AnalysisStartResult {
  runId: string;
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
  grouped: never[];
  revision: number;
}

export interface DeleteResult {
  deleted: true;
  id: string;
  revision: number;
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
type CommandHandlerMap = {
  [K in CommandKind]: (
    command: Extract<Command, { kind: K }>,
  ) => Promise<CommandResultMap[K]>;
};

interface CreateCommandBusOptions {
  handlers?: Partial<CommandHandlerMap>;
  receiptStore?: CommandReceiptStore;
}

interface CommandBus {
  submitCommand(command: SubmitCommand): Promise<CommandReceipt>;
  getReceipt(commandId: string): CommandReceipt | undefined;
  getReceiptByReceiptId(receiptId: string): CommandReceipt | undefined;
  listReceipts(): CommandReceipt[];
  resetForTest(): void;
}

const DEFAULT_ESTIMATED_PHASES = 3;

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
  } as Command;
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

const defaultHandlers: CommandHandlerMap = {
  async "analysis.start"(command) {
    const { runId } = await analysisOrchestrator.runFull(
      command.topic,
      command.provider,
      command.model,
      undefined,
      command.runtime,
    );
    return {
      runId,
      status: "started",
      estimatedPhases: DEFAULT_ESTIMATED_PHASES,
    };
  },
  async "analysis.abort"() {
    const activeStatus = analysisOrchestrator.getActiveStatus();
    if (!activeStatus) {
      return { aborted: false, status: "idle" };
    }

    analysisOrchestrator.abort();
    return { aborted: true, runId: activeStatus.runId };
  },
  async "analysis.reset"(command) {
    entityGraphService.newAnalysis(command.topic);
    return {
      analysis: entityGraphService.getAnalysis(),
      revision: entityGraphService.getRevision(),
    };
  },
  async "entity.create"(command) {
    const created = entityGraphService.createEntity(command.entity, {
      source: command.provenanceSource,
      ...(command.runId ? { runId: command.runId } : {}),
      ...(command.provenancePhase ? { phase: command.provenancePhase } : {}),
    });
    return {
      created: [created],
      updated: [],
      staleMarked: [],
      grouped: [],
      revision: entityGraphService.getRevision(),
    };
  },
  async "entity.update"(command) {
    const staleBefore = new Set(entityGraphService.getStaleEntityIds());
    const updated = entityGraphService.updateEntity(command.id, command.updates, {
      source: command.provenanceSource,
      ...(command.runId ? { runId: command.runId } : {}),
    });

    if (!updated) {
      throw new Error(`Entity "${command.id}" not found`);
    }

    const staleMarked = entityGraphService
      .getStaleEntityIds()
      .filter((id) => !staleBefore.has(id));

    return {
      created: [],
      updated: [updated],
      staleMarked,
      grouped: [],
      revision: entityGraphService.getRevision(),
    };
  },
  async "entity.delete"(command) {
    const deleted = entityGraphService.removeEntity(command.id);
    if (!deleted) {
      throw new Error(`Entity "${command.id}" not found`);
    }
    return {
      deleted: true,
      id: command.id,
      revision: entityGraphService.getRevision(),
    };
  },
  async "relationship.create"(command) {
    return entityGraphService.createRelationship(command.relationship, {
      source: command.provenanceSource ?? "ai-edited",
      ...(command.runId ? { runId: command.runId } : {}),
      ...(command.provenancePhase ? { phase: command.provenancePhase } : {}),
    });
  },
  async "relationship.delete"(command) {
    const deleted = entityGraphService.removeRelationship(command.id);
    if (!deleted) {
      throw new Error(`Relationship "${command.id}" not found`);
    }
    return {
      deleted: true,
      id: command.id,
      revision: entityGraphService.getRevision(),
    };
  },
};

export function createCommandBus(
  options: CreateCommandBusOptions = {},
): CommandBus {
  const receiptStore =
    options.receiptStore ?? createInMemoryReceiptStore();
  const handlers = {
    ...defaultHandlers,
    ...(options.handlers ?? {}),
  } as CommandHandlerMap;
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

  return {
    async submitCommand(commandInput) {
      const command = normalizeCommand(commandInput);
      const payloadFingerprint = fingerprintCommand(command);
      const existing =
        command.receiptId && receiptStore.getByReceiptId(command.receiptId);

      if (existing) {
        if (existing.payloadFingerprint !== payloadFingerprint) {
          const conflicted = createReceipt(
            command,
            "conflicted",
            payloadFingerprint,
          );
          conflicted.finishedAt = Date.now();
          conflicted.conflictWithCommandId = existing.commandId;
          conflicted.error = {
            name: "CommandReceiptConflict",
            message: `Receipt "${command.receiptId}" was already used for a different command`,
          };
          receiptStore.save(conflicted);
          logReceiptEvent(command.runId ? "warn" : "error", command, conflicted, "conflicted");
          return cloneReceipt(conflicted);
        }

        const existingCompletion = completions.get(existing.commandId);
        const settledExisting = existingCompletion
          ? await existingCompletion
          : existing;
        const deduplicated = createReceipt(
          command,
          "deduplicated",
          payloadFingerprint,
        );
        deduplicated.startedAt = deduplicated.acceptedAt;
        deduplicated.finishedAt = Date.now();
        deduplicated.duplicateOfCommandId = existing.commandId;
        if (settledExisting.result !== undefined) {
          deduplicated.result = settledExisting.result;
        }
        if (settledExisting.error) {
          deduplicated.error = { ...settledExisting.error };
        }
        receiptStore.save(deduplicated);
        logReceiptEvent("log", command, deduplicated, "deduplicated");
        return cloneReceipt(deduplicated);
      }

      const accepted = createReceipt(command, "accepted", payloadFingerprint);
      receiptStore.save(accepted);
      logReceiptEvent("log", command, accepted, "accepted");

      const completion = enqueue(async () => {
        accepted.status = "running";
        accepted.startedAt = Date.now();
        receiptStore.save(accepted);
        logReceiptEvent("log", command, accepted, "started");

        try {
          const handler = handlers[command.kind] as (
            current: Command,
          ) => Promise<unknown>;
          const result = await handler(command);
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
      });

      completions.set(command.commandId, completion);
      const settled = await completion;
      if (settled.status !== "accepted" && settled.status !== "running") {
        completions.delete(command.commandId);
      }
      return settled;
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

const commandBus = createCommandBus();

export async function submitCommand(
  command: SubmitCommand,
): Promise<CommandReceipt> {
  return commandBus.submitCommand(command);
}

export function getCommandReceipt(
  commandId: string,
): CommandReceipt | undefined {
  return commandBus.getReceipt(commandId);
}

export function getCommandReceiptByReceiptId(
  receiptId: string,
): CommandReceipt | undefined {
  return commandBus.getReceiptByReceiptId(receiptId);
}

export function listCommandReceipts(): CommandReceipt[] {
  return commandBus.listReceipts();
}

export function _resetForTest(): void {
  commandBus.resetForTest();
}
