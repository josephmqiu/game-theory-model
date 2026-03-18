import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  Analysis,
  AnalysisFileReference,
  AnalysisStrategy,
  AnalysisValidation,
  AnalysisWorkflowState,
  GuidedWorkflowStage,
} from "@/types/analysis";
import {
  createDefaultAnalysis,
  normalizeAnalysis,
} from "@/services/analysis/analysis-normalization";
import {
  createDefaultAnalysisWorkflowState,
  normalizeAnalysisWorkflowState,
} from "@/services/analysis/analysis-workflow";
import { validateAnalysis } from "@/services/analysis/analysis-validation";

interface AnalysisStoreState extends AnalysisFileReference {
  analysis: Analysis;
  workflow: AnalysisWorkflowState;
  validation: AnalysisValidation;
  analysisRevision: number;
  workflowRevision: number;
  isDirty: boolean;
  newAnalysis: () => void;
  loadAnalysis: (
    analysis: Partial<Analysis>,
    source?: Partial<AnalysisFileReference>,
    workflow?: Partial<AnalysisWorkflowState>,
  ) => void;
  replaceAnalysis: (analysis: Partial<Analysis>) => void;
  commitAnalysisWorkflow: (payload: {
    analysis?: Analysis;
    workflow?: AnalysisWorkflowState;
  }) => void;
  setWorkflowStage: (stage: GuidedWorkflowStage) => void;
  renameAnalysis: (name: string) => void;
  renamePlayer: (playerId: string, name: string) => void;
  addStrategy: (playerId: string) => void;
  renameStrategy: (playerId: string, strategyId: string, name: string) => void;
  removeStrategy: (playerId: string, strategyId: string) => void;
  setPayoff: (
    player1StrategyId: string,
    player2StrategyId: string,
    playerId: string,
    payoff: number | null,
  ) => void;
  setAnalysisFileReference: (source: Partial<AnalysisFileReference>) => void;
  clearAnalysisFileReference: () => void;
  commitSave: (source: Partial<AnalysisFileReference>) => void;
  markDirty: () => void;
}

type WorkflowMode = "default" | "derive" | "preserve";

interface CreateStoreStateOptions {
  source?: Partial<AnalysisFileReference>;
  workflowInput?: Partial<AnalysisWorkflowState>;
  workflowMode?: WorkflowMode;
  currentWorkflow?: AnalysisWorkflowState;
  isDirty?: boolean;
  analysisRevision?: number;
  workflowRevision?: number;
}

function createAnalysisState(analysisInput?: Partial<Analysis>) {
  const analysis = analysisInput
    ? normalizeAnalysis(analysisInput)
    : createDefaultAnalysis();

  return {
    analysis,
    validation: validateAnalysis(analysis),
  };
}

function resolveWorkflowState(
  analysis: Analysis,
  validation: AnalysisValidation,
  options: CreateStoreStateOptions,
): AnalysisWorkflowState {
  if (options.workflowMode === "derive") {
    return normalizeAnalysisWorkflowState(
      analysis,
      validation,
      options.workflowInput,
    );
  }

  if (options.workflowMode === "preserve") {
    if (options.workflowInput) {
      return normalizeAnalysisWorkflowState(
        analysis,
        validation,
        options.workflowInput,
      );
    }

    return options.currentWorkflow ?? createDefaultAnalysisWorkflowState();
  }

  return createDefaultAnalysisWorkflowState();
}

function createStoreState(
  analysisInput?: Partial<Analysis>,
  options: CreateStoreStateOptions = {},
) {
  const { analysis, validation } = createAnalysisState(analysisInput);
  const workflow = resolveWorkflowState(analysis, validation, options);

  return {
    analysis,
    workflow,
    validation,
    analysisRevision: options.analysisRevision ?? 0,
    workflowRevision: options.workflowRevision ?? 0,
    fileName: options.source?.fileName ?? null,
    filePath: options.source?.filePath ?? null,
    fileHandle: options.source?.fileHandle ?? null,
    isDirty: options.isDirty ?? false,
  };
}

function createAnalysisMutationState(
  state: AnalysisStoreState,
  analysisInput: Partial<Analysis>,
) {
  return createStoreState(analysisInput, {
    source: getAnalysisSource(state),
    workflowMode: "preserve",
    currentWorkflow: state.workflow,
    isDirty: true,
    analysisRevision: state.analysisRevision + 1,
    workflowRevision: state.workflowRevision,
  });
}

function getStrategyName(strategies: AnalysisStrategy[]): string {
  return `Strategy ${strategies.length + 1}`;
}

function getPlayerIndexById(analysis: Analysis, playerId: string): number {
  return analysis.players.findIndex((player) => player.id === playerId);
}

function getAnalysisSource(
  state: Pick<AnalysisStoreState, "fileName" | "filePath" | "fileHandle">,
): AnalysisFileReference {
  return {
    fileName: state.fileName,
    filePath: state.filePath,
    fileHandle: state.fileHandle,
  };
}

export const useAnalysisStore = create<AnalysisStoreState>((set) => ({
  ...createStoreState(),

  newAnalysis: () =>
    set((state) =>
      createStoreState(undefined, {
        workflowMode: "default",
        isDirty: false,
        analysisRevision: state.analysisRevision + 1,
        workflowRevision: state.workflowRevision + 1,
      }),
    ),

  loadAnalysis: (analysis, source, workflow) =>
    set((state) =>
      createStoreState(analysis, {
        source,
        workflowInput: workflow,
        workflowMode: "derive",
        isDirty: false,
        analysisRevision: state.analysisRevision + 1,
        workflowRevision: state.workflowRevision + 1,
      }),
    ),

  replaceAnalysis: (analysis) =>
    set((state) =>
      createAnalysisMutationState(state, {
        ...state.analysis,
        ...analysis,
      }),
    ),

  commitAnalysisWorkflow: (payload) =>
    set((state) => {
      const hasAnalysisChange = payload.analysis !== undefined;
      const hasWorkflowChange =
        payload.workflow !== undefined &&
        payload.workflow.currentStage !== state.workflow.currentStage;

      if (!hasAnalysisChange && !hasWorkflowChange) {
        return state;
      }

      return createStoreState(payload.analysis ?? state.analysis, {
        source: getAnalysisSource(state),
        workflowInput: payload.workflow ?? state.workflow,
        workflowMode: "preserve",
        currentWorkflow: state.workflow,
        isDirty: true,
        analysisRevision:
          state.analysisRevision + (hasAnalysisChange ? 1 : 0),
        workflowRevision:
          state.workflowRevision + (hasWorkflowChange ? 1 : 0),
      });
    }),

  setWorkflowStage: (stage) =>
    set((state) => {
      if (state.workflow.currentStage === stage) {
        return state;
      }

      return {
        ...state,
        workflow: {
          currentStage: stage,
        },
        workflowRevision: state.workflowRevision + 1,
        isDirty: true,
      };
    }),

  renameAnalysis: (name) =>
    set((state) =>
      createAnalysisMutationState(state, {
        ...state.analysis,
        name,
      }),
    ),

  renamePlayer: (playerId, name) =>
    set((state) =>
      createAnalysisMutationState(state, {
        ...state.analysis,
        players: state.analysis.players.map((player) =>
          player.id === playerId ? { ...player, name } : player,
        ) as Analysis["players"],
      }),
    ),

  addStrategy: (playerId) =>
    set((state) =>
      createAnalysisMutationState(state, {
        ...state.analysis,
        players: state.analysis.players.map((player) =>
          player.id === playerId
            ? {
                ...player,
                strategies: [
                  ...player.strategies,
                  {
                    id: nanoid(),
                    name: getStrategyName(player.strategies),
                  },
                ],
              }
            : player,
        ) as Analysis["players"],
      }),
    ),

  renameStrategy: (playerId, strategyId, name) =>
    set((state) =>
      createAnalysisMutationState(state, {
        ...state.analysis,
        players: state.analysis.players.map((player) =>
          player.id === playerId
            ? {
                ...player,
                strategies: player.strategies.map((strategy) =>
                  strategy.id === strategyId ? { ...strategy, name } : strategy,
                ),
              }
            : player,
        ) as Analysis["players"],
      }),
    ),

  removeStrategy: (playerId, strategyId) =>
    set((state) => {
      const nextPlayers = state.analysis.players.map((player) => {
        if (player.id !== playerId || player.strategies.length <= 1) {
          return player;
        }

        return {
          ...player,
          strategies: player.strategies.filter(
            (strategy) => strategy.id !== strategyId,
          ),
        };
      }) as Analysis["players"];

      return createAnalysisMutationState(state, {
        ...state.analysis,
        players: nextPlayers,
      });
    }),

  setPayoff: (player1StrategyId, player2StrategyId, playerId, payoff) =>
    set((state) => {
      const playerIndex = getPlayerIndexById(state.analysis, playerId);
      if (playerIndex === -1) {
        return state;
      }

      return createAnalysisMutationState(state, {
        ...state.analysis,
        profiles: state.analysis.profiles.map((profile) => {
          if (
            profile.player1StrategyId !== player1StrategyId ||
            profile.player2StrategyId !== player2StrategyId
          ) {
            return profile;
          }

          const payoffs: [number | null, number | null] =
            playerIndex === 0
              ? [payoff, profile.payoffs[1]]
              : [profile.payoffs[0], payoff];

          return {
            ...profile,
            payoffs,
          };
        }),
      });
    }),

  setAnalysisFileReference: (source) =>
    set((state) => ({
      ...state,
      fileName:
        source.fileName === undefined ? state.fileName : source.fileName,
      filePath:
        source.filePath === undefined ? state.filePath : source.filePath,
      fileHandle:
        source.fileHandle === undefined ? state.fileHandle : source.fileHandle,
    })),

  clearAnalysisFileReference: () =>
    set({
      fileName: null,
      filePath: null,
      fileHandle: null,
    }),

  commitSave: (source) =>
    set((state) => ({
      ...state,
      fileName:
        source.fileName === undefined ? state.fileName : source.fileName,
      filePath:
        source.filePath === undefined ? state.filePath : source.filePath,
      fileHandle:
        source.fileHandle === undefined ? state.fileHandle : source.fileHandle,
      isDirty: false,
    })),

  markDirty: () => set({ isDirty: true }),
}));
