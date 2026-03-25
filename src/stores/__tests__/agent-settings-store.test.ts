import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageState = {
  data: {} as Record<string, string>,
};

vi.mock("@/utils/app-storage", () => {
  return {
    appStorage: {
      getItem: vi.fn((key: string) => storageState.data[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storageState.data[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storageState.data[key];
      }),
    },
  };
});

import { V3_PHASES } from "@/types/methodology";
import {
  buildAnalysisRuntimeOverrides,
  useAgentSettingsStore,
} from "@/stores/agent-settings-store";
import { appStorage } from "@/utils/app-storage";

const STORAGE_KEY = "game-theory-analyzer-agent-settings";

describe("agent-settings-store", () => {
  beforeEach(() => {
    storageState.data = {};
    vi.clearAllMocks();
    useAgentSettingsStore.setState(useAgentSettingsStore.getInitialState(), true);
  });

  afterEach(() => {
    useAgentSettingsStore.setState(useAgentSettingsStore.getInitialState(), true);
  });

  it("omits analysis runtime overrides until the user sets them", () => {
    expect(
      buildAnalysisRuntimeOverrides({
        analysisWebSearch: undefined,
        analysisEffortLevel: undefined,
        analysisPhaseMode: "all",
        analysisCustomPhases: V3_PHASES,
      }),
    ).toBeUndefined();
  });

  it("persists and hydrates canonicalized analysis runtime preferences", () => {
    useAgentSettingsStore.setState({
      analysisWebSearch: false,
      analysisEffortLevel: "high",
      analysisPhaseMode: "custom",
      analysisCustomPhases: ["scenarios", "situational-grounding"],
    });

    useAgentSettingsStore.getState().persist();
    useAgentSettingsStore.setState(useAgentSettingsStore.getInitialState(), true);
    useAgentSettingsStore.getState().hydrate();

    expect(useAgentSettingsStore.getState()).toMatchObject({
      analysisWebSearch: false,
      analysisEffortLevel: "high",
      analysisPhaseMode: "custom",
      analysisCustomPhases: ["situational-grounding", "scenarios"],
      isHydrated: true,
    });
  });

  it("hydrates old persisted settings without introducing undefined runtime state bugs", () => {
    appStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        providers: {},
        mcpIntegrations: [],
        mcpTransportMode: "stdio",
        mcpHttpPort: 3456,
      }),
    );

    useAgentSettingsStore.getState().hydrate();

    expect(useAgentSettingsStore.getState()).toMatchObject({
      analysisWebSearch: undefined,
      analysisEffortLevel: undefined,
      analysisPhaseMode: "all",
      analysisCustomPhases: V3_PHASES,
      mcpHttpPort: 3456,
      isHydrated: true,
    });
  });

  it("never persists an empty custom phase selection", () => {
    useAgentSettingsStore.setState({
      analysisPhaseMode: "custom",
      analysisCustomPhases: ["situational-grounding"],
    });

    useAgentSettingsStore
      .getState()
      .toggleAnalysisPhase("situational-grounding");
    useAgentSettingsStore.getState().persist();

    expect(useAgentSettingsStore.getState().analysisCustomPhases).toEqual([
      "situational-grounding",
    ]);
    expect(JSON.parse(appStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject({
      analysisPhaseMode: "custom",
      analysisCustomPhases: ["situational-grounding"],
    });
  });
});
