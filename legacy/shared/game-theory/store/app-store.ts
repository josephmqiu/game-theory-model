// Test-compatible in-memory AppStore stub for pipeline orchestrator tests.
// Production code uses src/stores/analysis-store.ts (Zustand) instead.
//
// This provides the minimal surface the orchestrator.test.ts createTestHarness()
// exercises: getState().canonical, .dispatch(), .fileMeta.meta, .eventLog,
// and .resetAnalysisSession().

import type { CanonicalStore, EntityRef } from "../types/canonical.ts";
import { emptyCanonicalStore } from "../types/canonical.ts";
import type { AnalysisFileMeta } from "../types/file.ts";
import type { Command } from "../engine/commands.ts";
import type { EventLog, ModelEvent } from "../engine/events.ts";
import { createEventLog } from "../engine/events.ts";
import {
  dispatch as engineDispatch,
  type DispatchResult,
} from "../engine/dispatch.ts";
import type { InverseIndex } from "../engine/inverse-index.ts";
import { resetDerivedState } from "./derived.ts";

export type ViewType = "welcome" | "overview" | string;

export interface AppStore {
  canonical: CanonicalStore;

  viewState: {
    activeView: ViewType;
    activeGameId: string | null;
    activeFormalizationId: string | null;
    inspectedRefs: EntityRef[];
    sidebarCollapsed: boolean;
    manualMode: boolean;
    inspectorState: {
      inspectedEntity: EntityRef | null;
      breadcrumb: string[];
    };
    phaseStatuses: Record<
      number,
      | "pending"
      | "active"
      | "complete"
      | "needs_rerun"
      | "partial"
      | "review_needed"
    >;
  };

  eventLog: EventLog;
  inverseIndex: InverseIndex;
  fileMeta: {
    path: string | null;
    meta: AnalysisFileMeta | null;
    lastSaved: number | null;
    dirty: boolean;
    error: string | null;
  };

  dispatch: (
    command: Command,
    opts?: {
      dryRun?: boolean;
      source?: ModelEvent["source"];
    },
  ) => DispatchResult;

  resetAnalysisSession: () => void;
}

function createInitialState() {
  const analysisId = crypto.randomUUID();
  return {
    canonical: emptyCanonicalStore(),
    viewState: {
      activeView: "welcome" as ViewType,
      activeGameId: null as string | null,
      activeFormalizationId: null as string | null,
      inspectedRefs: [] as EntityRef[],
      sidebarCollapsed: false,
      manualMode: false,
      inspectorState: {
        inspectedEntity: null as EntityRef | null,
        breadcrumb: [] as string[],
      },
      phaseStatuses: {} as Record<
        number,
        | "pending"
        | "active"
        | "complete"
        | "needs_rerun"
        | "partial"
        | "review_needed"
      >,
    },
    eventLog: createEventLog(analysisId),
    inverseIndex: {} as InverseIndex,
    fileMeta: {
      path: null as string | null,
      meta: null as AnalysisFileMeta | null,
      lastSaved: null as number | null,
      dirty: false,
      error: null as string | null,
    },
  };
}

/**
 * Creates a minimal in-memory Zustand-like store for pipeline orchestrator tests.
 * Returns an object with `getState()` and `setState()` matching the Zustand
 * vanilla store API that the test harness uses.
 */
export function createAppStore() {
  let currentState: AppStore;

  function buildState(base: ReturnType<typeof createInitialState>): AppStore {
    return {
      ...base,

      dispatch: (command, opts) => {
        const state = currentState;

        const result = engineDispatch(
          state.canonical,
          state.eventLog,
          command,
          opts,
        );

        if (result.status === "committed") {
          currentState = {
            ...currentState,
            canonical: result.store,
            eventLog: result.event_log,
            inverseIndex: result.inverse_index,
            fileMeta: {
              ...currentState.fileMeta,
              dirty: true,
              error: null,
            },
          };
        }

        return result;
      },

      resetAnalysisSession: () => {
        resetDerivedState();
        const nextBase = createInitialState();
        currentState = buildState(nextBase);
      },
    };
  }

  currentState = buildState(createInitialState());

  return {
    getState: (): AppStore => currentState,
    setState: (
      updater: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>),
    ): void => {
      const partial =
        typeof updater === "function" ? updater(currentState) : updater;
      currentState = { ...currentState, ...partial };
    },
  };
}
