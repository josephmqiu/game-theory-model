import * as analysisOrchestrator from "../agents/analysis-agent";
import * as entityGraphService from "./entity-graph-service";
import {
  createCommandBus,
  type CommandHandlerMap,
  type CommandReceipt,
  type StartCommandOptions,
  type StartedCommand,
  type SubmitCommand,
} from "./command-bus";
import {
  createCommandReceiptStoreProxy,
  createWorkspaceRecordFromSnapshot,
  getWorkspaceDatabase,
  resetWorkspaceDatabaseForTest,
} from "./workspace";

const DEFAULT_ESTIMATED_PHASES = 3;
const workspaceReceiptStore = createCommandReceiptStoreProxy(
  () => getWorkspaceDatabase().commandReceipts,
);

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
    const analysis = entityGraphService.getAnalysis();
    const now = Date.now();
    getWorkspaceDatabase().workspaces.upsertWorkspace(
      createWorkspaceRecordFromSnapshot({
        id: command.workspaceId ?? analysis.id,
        name: analysis.name,
        analysisType: "game-theory",
        snapshot: {
          analysis,
          layout: {},
        },
        createdAt: now,
        updatedAt: now,
      }),
    );
    return {
      analysis,
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
      revision: entityGraphService.getRevision(),
    };
  },
  async "entity.update"(command) {
    const staleBefore = new Set(entityGraphService.getStaleEntityIds());
    const updated = entityGraphService.updateEntity(
      command.id,
      command.updates,
      {
        source: command.provenanceSource,
        ...(command.runId ? { runId: command.runId } : {}),
      },
    );

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

const commandBus = createCommandBus({
  handlers: defaultHandlers,
  receiptStore: workspaceReceiptStore,
});

export async function startCommand(
  command: SubmitCommand,
  options?: StartCommandOptions,
): Promise<StartedCommand> {
  return commandBus.startCommand(command, options);
}

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
  resetWorkspaceDatabaseForTest();
}
