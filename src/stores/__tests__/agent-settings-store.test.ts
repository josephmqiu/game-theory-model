import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageState = vi.hoisted(() => ({
  data: {} as Record<string, string>,
}));

const pushSearchConfigMock = vi.hoisted(() => vi.fn());
const getSecretMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/services/ai/search-config-client", () => ({
  pushSearchConfig: (...args: unknown[]) => pushSearchConfigMock(...args),
}));

vi.mock("@/utils/secret-storage", () => ({
  getSecret: (...args: unknown[]) => getSecretMock(...args),
}));

import { RUNNABLE_PHASES } from "@/types/methodology";
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
    useAgentSettingsStore.setState(
      useAgentSettingsStore.getInitialState(),
      true,
    );
  });

  afterEach(() => {
    useAgentSettingsStore.setState(
      useAgentSettingsStore.getInitialState(),
      true,
    );
  });

  it("omits analysis runtime overrides until the user sets them", () => {
    expect(
      buildAnalysisRuntimeOverrides({
        analysisWebSearch: undefined,
        analysisEffortLevel: undefined,
        analysisPhaseMode: "all",
        analysisCustomPhases: RUNNABLE_PHASES,
      }),
    ).toBeUndefined();
  });

  it("persists and hydrates canonicalized analysis runtime preferences", () => {
    useAgentSettingsStore.setState({
      analysisWebSearch: false,
      analysisEffortLevel: "thorough",
      analysisPhaseMode: "custom",
      analysisCustomPhases: ["scenarios", "situational-grounding"],
    });

    useAgentSettingsStore.getState().persist();
    useAgentSettingsStore.setState(
      useAgentSettingsStore.getInitialState(),
      true,
    );
    useAgentSettingsStore.getState().hydrate();

    expect(useAgentSettingsStore.getState()).toMatchObject({
      analysisWebSearch: false,
      analysisEffortLevel: "thorough",
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
      analysisCustomPhases: RUNNABLE_PHASES,
      mcpHttpPort: 3456,
      isHydrated: true,
    });
  });

  it("persists and hydrates custom provider settings and search provider", () => {
    useAgentSettingsStore.setState({
      customProvider: {
        preset: "deepseek",
        baseURL: "https://api.deepseek.com",
        modelIds: ["deepseek-chat", "deepseek-reasoner"],
        hasNativeWebSearch: true,
      },
      searchProvider: "brave",
    });

    useAgentSettingsStore.getState().persist();
    useAgentSettingsStore.setState(
      useAgentSettingsStore.getInitialState(),
      true,
    );
    // Persisted JSON must not contain any API key material.
    expect(storageState.data[STORAGE_KEY]).not.toContain("apiKey");

    useAgentSettingsStore.getState().hydrate();

    expect(useAgentSettingsStore.getState().customProvider).toEqual({
      preset: "deepseek",
      baseURL: "https://api.deepseek.com",
      modelIds: ["deepseek-chat", "deepseek-reasoner"],
      hasNativeWebSearch: true,
    });
    expect(useAgentSettingsStore.getState().searchProvider).toBe("brave");
  });

  it("defaults custom provider settings when absent from persisted state", () => {
    appStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ providers: {}, mcpIntegrations: [] }),
    );

    useAgentSettingsStore.getState().hydrate();

    expect(useAgentSettingsStore.getState().customProvider).toEqual({
      preset: "custom-url",
      baseURL: "",
      modelIds: [],
      hasNativeWebSearch: false,
    });
    expect(useAgentSettingsStore.getState().searchProvider).toBeNull();
  });

  it("re-pushes the search config on boot when a provider and key exist", async () => {
    getSecretMock.mockResolvedValue("sk-search-key");
    pushSearchConfigMock.mockResolvedValue({ ok: true, configured: true });

    useAgentSettingsStore.setState({ searchProvider: "tavily" });
    useAgentSettingsStore.getState().persist();
    useAgentSettingsStore.setState(
      useAgentSettingsStore.getInitialState(),
      true,
    );
    useAgentSettingsStore.getState().hydrate();

    await vi.waitFor(() =>
      expect(pushSearchConfigMock).toHaveBeenCalledWith({
        provider: "tavily",
        apiKey: "sk-search-key",
      }),
    );
    expect(getSecretMock).toHaveBeenCalledWith("search.apiKey");
  });

  it("does not push a search config on boot when no provider is set", async () => {
    getSecretMock.mockResolvedValue("sk-search-key");

    useAgentSettingsStore.getState().hydrate();
    await Promise.resolve();

    expect(pushSearchConfigMock).not.toHaveBeenCalled();
    expect(getSecretMock).not.toHaveBeenCalled();
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
