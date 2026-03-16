/**
 * Analysis store — L1 canonical model + command spine.
 * Wraps dispatch(), undo(), redo() and manages the EventLog + InverseIndex.
 */

import { createStore, useStore } from "zustand";
import type { CanonicalStore } from "shared/game-theory/types/canonical";
import { emptyCanonicalStore } from "shared/game-theory/types/canonical";
import type { EventLog, ModelEvent } from "shared/game-theory/engine/events";
import { createEventLog } from "shared/game-theory/engine/events";
import type { InverseIndex } from "shared/game-theory/engine/inverse-index";
import { buildInverseIndex } from "shared/game-theory/engine/inverse-index";
import type { Command } from "shared/game-theory/engine/commands";
import type { DispatchResult } from "shared/game-theory/engine/dispatch";
import { dispatch } from "shared/game-theory/engine/dispatch";
import { applyPatch } from "fast-json-patch";

export interface AnalysisFileMeta {
  filePath: string | null;
  name: string;
  description?: string;
  dirty: boolean;
}

export interface AnalysisState {
  canonical: CanonicalStore;
  eventLog: EventLog;
  inverseIndex: InverseIndex;
  fileMeta: AnalysisFileMeta;
}

interface AnalysisActions {
  dispatch: (
    command: Command,
    opts?: { dryRun?: boolean; source?: ModelEvent["source"] },
  ) => DispatchResult;
  undo: () => void;
  redo: () => void;
  newAnalysis: () => void;
  loadCanonical: (
    canonical: CanonicalStore,
    meta: Partial<AnalysisFileMeta>,
  ) => void;
  setFileMeta: (meta: Partial<AnalysisFileMeta>) => void;
}

type AnalysisStore = AnalysisState & AnalysisActions;

function createInitialState(): AnalysisState {
  const canonical = emptyCanonicalStore();
  return {
    canonical,
    eventLog: createEventLog(crypto.randomUUID()),
    inverseIndex: buildInverseIndex(canonical),
    fileMeta: {
      filePath: null,
      name: "Untitled Analysis",
      dirty: false,
    },
  };
}

export const analysisStore = createStore<AnalysisStore>((set, get) => ({
  ...createInitialState(),

  dispatch(command, opts) {
    const state = get();
    const result = dispatch(state.canonical, state.eventLog, command, opts);

    if (result.status === "committed") {
      set({
        canonical: result.store,
        eventLog: result.event_log,
        inverseIndex: result.inverse_index,
        fileMeta: { ...state.fileMeta, dirty: true },
      });
    }

    return result;
  },

  undo() {
    const state = get();
    const { cursor, events } = state.eventLog;
    if (cursor <= 0) return;

    const event = events[cursor - 1];
    if (!event) return;

    const reverted = applyPatch(
      structuredClone(state.canonical),
      event.inverse_patches,
    ).newDocument as CanonicalStore;

    set({
      canonical: reverted,
      eventLog: {
        ...state.eventLog,
        cursor: cursor - 1,
      },
      inverseIndex: buildInverseIndex(reverted),
      fileMeta: { ...state.fileMeta, dirty: true },
    });
  },

  redo() {
    const state = get();
    const { cursor, events } = state.eventLog;
    if (cursor >= events.length) return;

    const event = events[cursor];
    if (!event) return;

    const applied = applyPatch(structuredClone(state.canonical), event.patches)
      .newDocument as CanonicalStore;

    set({
      canonical: applied,
      eventLog: {
        ...state.eventLog,
        cursor: cursor + 1,
      },
      inverseIndex: buildInverseIndex(applied),
      fileMeta: { ...state.fileMeta, dirty: true },
    });
  },

  newAnalysis() {
    set(createInitialState());
  },

  loadCanonical(canonical, meta) {
    set({
      canonical,
      eventLog: createEventLog(crypto.randomUUID()),
      inverseIndex: buildInverseIndex(canonical),
      fileMeta: {
        ...get().fileMeta,
        dirty: false,
        ...meta,
      },
    });
  },

  setFileMeta(meta) {
    set({ fileMeta: { ...get().fileMeta, ...meta } });
  },
}));

export function useAnalysisStore<T>(selector: (state: AnalysisStore) => T): T {
  return useStore(analysisStore, selector);
}

export function getAnalysisState(): AnalysisState {
  return analysisStore.getState();
}
