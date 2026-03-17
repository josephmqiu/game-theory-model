import fjp from "fast-json-patch";
import type { Operation } from "fast-json-patch";
const { applyPatch, compare } = fjp;

import type { CanonicalStore, EntityRef, EntityType } from "../types";
import { createEntityRef } from "../types/canonical";

import type { Command } from "./commands";
import { isDeleteCommand } from "./commands";
import { computeImpact, expandCascadeFromImpact } from "./cascade";
import { incrementRevisionSync, persistEventSync } from "./event-persistence";
import { createEventLog, type EventLog, type ModelEvent } from "./events";
import {
  validateStoreInvariants,
  type ImpactReport,
  type IntegrityAction,
} from "./integrity";
import { buildInverseIndex, type InverseIndex } from "./inverse-index";
import { reduce, reduceStore, CommandError } from "./reducer";
import { clearStale, propagateStale } from "./stale";
import { findEntityRefById } from "./store-utils";

export type DispatchResult =
  | {
      status: "committed";
      event: ModelEvent;
      new_cursor: number;
      store: CanonicalStore;
      event_log: EventLog;
      inverse_index: InverseIndex;
    }
  | {
      status: "dry_run";
      event: ModelEvent;
      impact_report?: ImpactReport;
      store: CanonicalStore;
      event_log: EventLog;
      inverse_index: InverseIndex;
    }
  | {
      status: "rejected";
      reason:
        | "validation_failed"
        | "revision_conflict"
        | "invariant_violated"
        | "error";
      errors: string[];
      revision_diff?: { expected: number; actual: number };
    };

interface StaleCommandRoot {
  kind: "mark_stale" | "clear_stale";
  target: EntityRef;
  cause: EntityRef;
  reason?: string;
}

interface PreprocessResult {
  command: Command;
  impactReport?: ImpactReport;
  integrityActions: IntegrityAction[];
}

function createModelEvent(
  command: Command,
  patches: ReadonlyArray<Operation>,
  inversePatches: ReadonlyArray<Operation>,
  integrityActions: ReadonlyArray<IntegrityAction>,
  source: ModelEvent["source"],
  metadata?: Record<string, unknown>,
): ModelEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    command,
    patches,
    inverse_patches: inversePatches,
    integrity_actions: integrityActions,
    source,
    metadata,
  };
}

function applyPatches(
  store: CanonicalStore,
  patches: ReadonlyArray<Operation>,
): CanonicalStore {
  return applyPatch(structuredClone(store), patches as Operation[], true, true)
    .newDocument;
}

function retryPendingPersistence(eventLog: EventLog): EventLog {
  let nextRevision = eventLog.persisted_revision;
  const remaining: ModelEvent[] = [];
  let lastError = eventLog.last_persist_error;

  for (const event of eventLog.pending_persisted_events) {
    try {
      persistEventSync(event, eventLog.analysis_id);
      nextRevision = incrementRevisionSync(eventLog.analysis_id, event.id);
      lastError = undefined;
    } catch (error) {
      remaining.push(event);
      lastError =
        error instanceof Error ? error.message : "Failed to persist event.";
    }
  }

  return {
    ...eventLog,
    persisted_revision: nextRevision,
    pending_persisted_events: remaining,
    last_persist_error: lastError,
  };
}

function preprocessCommand(
  store: CanonicalStore,
  index: InverseIndex,
  command: Command,
): PreprocessResult {
  if (command.kind === "batch") {
    let nextStore = store;
    let nextIndex = index;
    const commands: Command[] = [];
    const integrityActions: IntegrityAction[] = [];
    let impactReport: ImpactReport | undefined;

    for (const nested of command.commands) {
      const result = preprocessCommand(nextStore, nextIndex, nested);
      commands.push(result.command);
      integrityActions.push(...result.integrityActions);
      impactReport ??= result.impactReport;
      nextStore = reduceStore(nextStore, result.command);
      nextIndex = buildInverseIndex(nextStore);
    }

    return {
      command: {
        ...command,
        commands,
      },
      impactReport,
      integrityActions,
    };
  }

  if (!isDeleteCommand(command)) {
    return { command, integrityActions: [] };
  }

  const target = createEntityRef(
    command.kind.slice("delete_".length) as EntityType,
    command.payload.id,
  );
  const impactReport = computeImpact(store, index, target);

  if (impactReport.proposed_actions.some((action) => action.kind === "block")) {
    return {
      command,
      impactReport,
      integrityActions: impactReport.proposed_actions,
    };
  }

  return {
    command: expandCascadeFromImpact(store, command, impactReport),
    impactReport,
    integrityActions: impactReport.proposed_actions,
  };
}

function collectCommandStaleRoots(
  store: CanonicalStore,
  command: Command,
): StaleCommandRoot[] {
  if (command.kind === "batch") {
    return command.commands.flatMap((nested) =>
      collectCommandStaleRoots(store, nested),
    );
  }

  if (command.kind !== "mark_stale" && command.kind !== "clear_stale") {
    return [];
  }

  const target = findEntityRefById(store, command.payload.id);
  return target
    ? [
        {
          kind: command.kind,
          target,
          cause: target,
          reason:
            command.kind === "mark_stale" ? command.payload.reason : undefined,
        },
      ]
    : [];
}

function collectIntegrityStaleRoots(
  integrityActions: ReadonlyArray<IntegrityAction>,
): StaleCommandRoot[] {
  return integrityActions.flatMap((action) =>
    action.kind === "mark_stale"
      ? [
          {
            kind: "mark_stale" as const,
            target: action.entity,
            cause: action.caused_by,
            reason: action.reason,
          },
        ]
      : [],
  );
}

function applyStaleEffects(
  store: CanonicalStore,
  index: InverseIndex,
  roots: ReadonlyArray<StaleCommandRoot>,
): CanonicalStore {
  let nextStore = store;

  for (const root of roots) {
    if (root.kind === "mark_stale") {
      nextStore = propagateStale(
        nextStore,
        index,
        root.target,
        root.reason ?? "Marked stale",
        root.cause,
      ).store;
      continue;
    }

    nextStore = clearStale(nextStore, index, root.target, root.cause).store;
  }

  return nextStore;
}

export function dispatch(
  store: CanonicalStore,
  eventLog: EventLog,
  command: Command,
  opts?: { dryRun?: boolean; source?: ModelEvent["source"] },
): DispatchResult {
  const hydratedEventLog = retryPendingPersistence(eventLog);
  const actualRevision =
    hydratedEventLog.persisted_revision ?? hydratedEventLog.cursor;
  if (
    typeof command.base_revision === "number" &&
    command.base_revision !== actualRevision
  ) {
    return {
      status: "rejected",
      reason: "revision_conflict",
      errors: [
        "Command base_revision does not match the current persisted revision.",
      ],
      revision_diff: {
        expected: command.base_revision,
        actual: actualRevision,
      },
    };
  }

  try {
    const initialIndex = buildInverseIndex(store);
    const {
      command: effectiveCommand,
      impactReport,
      integrityActions,
    } = preprocessCommand(store, initialIndex, command);
    const blockingActions = integrityActions.filter(
      (action): action is Extract<IntegrityAction, { kind: "block" }> =>
        action.kind === "block",
    );

    if (blockingActions.length > 0) {
      return {
        status: "rejected",
        reason: "invariant_violated",
        errors: blockingActions.map((action) => action.reason),
      };
    }

    const reduced = reduce(store, effectiveCommand);
    const reducedIndex = buildInverseIndex(reduced.newStore);
    const staleAppliedStore = applyStaleEffects(
      reduced.newStore,
      reducedIndex,
      [
        ...collectCommandStaleRoots(reduced.newStore, effectiveCommand),
        ...collectIntegrityStaleRoots(integrityActions),
      ],
    );
    const invariantResult = validateStoreInvariants(staleAppliedStore);
    if (invariantResult.errors.length > 0) {
      return {
        status: "rejected",
        reason: "invariant_violated",
        errors: invariantResult.errors,
      };
    }

    const patches =
      staleAppliedStore === reduced.newStore
        ? reduced.patches
        : compare(store, staleAppliedStore);
    const inversePatches =
      staleAppliedStore === reduced.newStore
        ? reduced.inversePatches
        : compare(staleAppliedStore, store);
    const inverseIndex = buildInverseIndex(staleAppliedStore);
    const event = createModelEvent(
      effectiveCommand,
      patches,
      inversePatches,
      integrityActions,
      opts?.source ?? "user",
      invariantResult.warnings.length > 0
        ? { integrity_warnings: invariantResult.warnings }
        : undefined,
    );

    if (opts?.dryRun) {
      return {
        status: "dry_run",
        event,
        impact_report: impactReport,
        store: staleAppliedStore,
        event_log: hydratedEventLog,
        inverse_index: inverseIndex,
      };
    }

    const truncatedEvents = hydratedEventLog.events.slice(
      0,
      hydratedEventLog.cursor,
    );
    let nextEventLog: EventLog = {
      ...hydratedEventLog,
      events: [...truncatedEvents, event],
      cursor: truncatedEvents.length + 1,
    };

    try {
      persistEventSync(event, nextEventLog.analysis_id);
      nextEventLog = {
        ...nextEventLog,
        persisted_revision: incrementRevisionSync(
          nextEventLog.analysis_id,
          event.id,
        ),
        last_persist_error: undefined,
      };
    } catch (error) {
      nextEventLog = {
        ...nextEventLog,
        pending_persisted_events: [
          ...nextEventLog.pending_persisted_events,
          event,
        ],
        last_persist_error:
          error instanceof Error
            ? error.message
            : "Failed to persist canonical event.",
      };
    }

    return {
      status: "committed",
      event,
      new_cursor: nextEventLog.cursor,
      store: staleAppliedStore,
      event_log: nextEventLog,
      inverse_index: inverseIndex,
    };
  } catch (error) {
    if (error instanceof CommandError) {
      return {
        status: "rejected",
        reason: error.reason,
        errors: [error.message],
      };
    }

    return {
      status: "rejected",
      reason: "error",
      errors: [
        error instanceof Error ? error.message : "Unexpected dispatch error.",
      ],
    };
  }
}

export function undo(
  store: CanonicalStore,
  eventLog: EventLog,
): { store: CanonicalStore; eventLog: EventLog } | null {
  if (eventLog.cursor === 0) {
    return null;
  }

  const event = eventLog.events[eventLog.cursor - 1];
  const nextStore = applyPatches(store, event.inverse_patches);
  return {
    store: nextStore,
    eventLog: {
      ...eventLog,
      cursor: eventLog.cursor - 1,
    },
  };
}

export function redo(
  store: CanonicalStore,
  eventLog: EventLog,
): { store: CanonicalStore; eventLog: EventLog } | null {
  if (eventLog.cursor >= eventLog.events.length) {
    return null;
  }

  const event = eventLog.events[eventLog.cursor];
  const nextStore = applyPatches(store, event.patches);
  return {
    store: nextStore,
    eventLog: {
      ...eventLog,
      cursor: eventLog.cursor + 1,
    },
  };
}

export { createEventLog };
