import type {
  AppCommandEnvelope,
  AppCommandPayloadMap,
  AppCommandType,
} from "shared/game-theory/types/command-bus";
import { randomUUID } from "node:crypto";
import { broadcastEvent } from "./mcp-sync-state";

const commands = new Map<string, AppCommandEnvelope>();
const pendingResolvers = new Map<
  string,
  Array<(command: AppCommandEnvelope) => void>
>();
const MAX_HISTORY = 200;

function trimHistory(): void {
  const entries = [...commands.values()];
  if (entries.length <= MAX_HISTORY) return;

  const sorted = entries.sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  for (const entry of sorted.slice(0, sorted.length - MAX_HISTORY)) {
    if (entry.status === "queued") continue;
    commands.delete(entry.id);
  }
}

export function enqueueCommand<T extends AppCommandType>(params: {
  type: T;
  payload: AppCommandPayloadMap[T];
  sourceClientId?: string | null;
}): AppCommandEnvelope<T> {
  const command: AppCommandEnvelope<T> = {
    id: randomUUID(),
    type: params.type,
    payload: params.payload,
    sourceClientId: params.sourceClientId ?? null,
    ownerClientId: null,
    status: "queued",
    createdAt: new Date().toISOString(),
    claimedAt: null,
  };

  commands.set(command.id, command);
  trimHistory();
  broadcastEvent(
    { type: "command:queued", command },
    command.sourceClientId ?? undefined,
  );
  return command;
}

export function claimCommand(params: {
  id: string;
  ownerClientId: string;
}):
  | { status: "claimed"; command: AppCommandEnvelope }
  | { status: "busy"; command: AppCommandEnvelope }
  | { status: "missing" } {
  const current = commands.get(params.id);
  if (!current || current.status !== "queued") {
    return { status: "missing" };
  }

  if (
    current.ownerClientId &&
    current.ownerClientId !== params.ownerClientId
  ) {
    return { status: "busy", command: current };
  }

  if (current.ownerClientId === params.ownerClientId) {
    return { status: "claimed", command: current };
  }

  const updated: AppCommandEnvelope = {
    ...current,
    ownerClientId: params.ownerClientId,
    claimedAt: current.claimedAt ?? new Date().toISOString(),
  };
  commands.set(updated.id, updated);
  return { status: "claimed", command: updated };
}

export function completeCommand(params: {
  id: string;
  status: "completed" | "failed";
  result?: unknown;
  error?: string | null;
  sourceClientId?: string | null;
}): AppCommandEnvelope | null {
  const current = commands.get(params.id);
  if (!current) return null;
  if (
    current.ownerClientId &&
    current.ownerClientId !== (params.sourceClientId ?? null)
  ) {
    return null;
  }

  const updated: AppCommandEnvelope = {
    ...current,
    status: params.status,
    result: params.result,
    error: params.error ?? null,
    completedAt: new Date().toISOString(),
  };

  commands.set(updated.id, updated);
  broadcastEvent(
    { type: "command:result", command: updated },
    params.sourceClientId ?? undefined,
  );

  const resolvers = pendingResolvers.get(updated.id) ?? [];
  pendingResolvers.delete(updated.id);
  for (const resolve of resolvers) {
    resolve(updated);
  }

  trimHistory();
  return updated;
}

export function getCommand(id: string): AppCommandEnvelope | null {
  return commands.get(id) ?? null;
}

export function getPendingCommands(): AppCommandEnvelope[] {
  return [...commands.values()].filter((command) => command.status === "queued");
}

export function waitForCommandResult(
  id: string,
  timeoutMs = 30_000,
): Promise<AppCommandEnvelope | null> {
  const existing = commands.get(id);
  if (existing && existing.status !== "queued") {
    return Promise.resolve(existing);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      const resolvers = pendingResolvers.get(id) ?? [];
      pendingResolvers.set(
        id,
        resolvers.filter((entry) => entry !== handleResolve),
      );
      resolve(commands.get(id) ?? null);
    }, timeoutMs);

    const handleResolve = (command: AppCommandEnvelope) => {
      clearTimeout(timeout);
      resolve(command);
    };

    const resolvers = pendingResolvers.get(id) ?? [];
    resolvers.push(handleResolve);
    pendingResolvers.set(id, resolvers);
  });
}
