// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultAnalysis } from "@/services/analysis/analysis-normalization";
import {
  newAnalysis,
  openAnalysis,
  openAnalysisFromFilePath,
  saveAnalysis,
} from "@/services/analysis/analysis-persistence";
import { serializeAnalysisFile } from "@/services/analysis/analysis-file";
import { useAnalysisStore } from "@/stores/analysis-store";

function createElectronApiMock(
  overrides: Partial<ElectronAPI> = {},
): ElectronAPI {
  return {
    isElectron: true,
    openFile: vi.fn().mockResolvedValue(null),
    saveFile: vi.fn().mockResolvedValue(null),
    saveToPath: vi.fn().mockResolvedValue("/tmp/pricing-game.gta"),
    onMenuAction: vi.fn(() => () => {}),
    onOpenFile: vi.fn(() => () => {}),
    readFile: vi.fn().mockResolvedValue(null),
    getPendingFile: vi.fn().mockResolvedValue(null),
    getLogDir: vi.fn().mockResolvedValue("/tmp"),
    setTheme: vi.fn(),
    getPreferences: vi.fn().mockResolvedValue({}),
    setPreference: vi.fn().mockResolvedValue(undefined),
    removePreference: vi.fn().mockResolvedValue(undefined),
    updater: {
      getState: vi.fn(),
      checkForUpdates: vi.fn(),
      quitAndInstall: vi.fn(),
      getAutoCheck: vi.fn(),
      setAutoCheck: vi.fn(),
      onStateChange: vi.fn(() => () => {}),
    },
    ...overrides,
  };
}

describe("analysis persistence controller", () => {
  beforeEach(() => {
    useAnalysisStore.setState(useAnalysisStore.getInitialState(), true);
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.electronAPI = createElectronApiMock();
  });

  it("routes save through saveAs until a writable target exists", async () => {
    const saveFile = vi.fn().mockResolvedValue("/tmp/pricing-game.gta");
    window.electronAPI = createElectronApiMock({ saveFile });

    useAnalysisStore.getState().renameAnalysis("Pricing Game");
    useAnalysisStore.getState().setWorkflowStage("strategies");

    await expect(saveAnalysis()).resolves.toBe(true);
    expect(saveFile).toHaveBeenCalledTimes(1);
    expect(String(saveFile.mock.calls[0]?.[0])).toContain('"currentStage": "strategies"');
    expect(useAnalysisStore.getState().fileName).toBe("pricing-game.gta");
    expect(useAnalysisStore.getState().filePath).toBe("/tmp/pricing-game.gta");
    expect(useAnalysisStore.getState().isDirty).toBe(false);
  });

  it("prompts before discarding dirty work for new and open", async () => {
    const openFile = vi.fn().mockResolvedValue(null);
    window.confirm = vi.fn(() => false);
    window.electronAPI = createElectronApiMock({ openFile });

    useAnalysisStore.getState().renameAnalysis("Pricing Game");

    await expect(newAnalysis()).resolves.toBe(false);
    await expect(openAnalysis()).resolves.toBe(false);
    expect(window.confirm).toHaveBeenCalledTimes(2);
    expect(openFile).not.toHaveBeenCalled();
    expect(useAnalysisStore.getState().analysis.name).toBe("Pricing Game");
    expect(useAnalysisStore.getState().isDirty).toBe(true);
  });

  it("loads saved analysis text, clears dirty state, and tracks the source file", async () => {
    const analysis = createDefaultAnalysis();
    analysis.name = "Pricing Game";
    analysis.players[0].name = "Incumbent";
    analysis.profiles[0].payoffs = [5, null];

    const readFile = vi.fn().mockResolvedValue({
      filePath: "/tmp/pricing-game.gta",
      content: serializeAnalysisFile(analysis),
    });

    window.electronAPI = createElectronApiMock({ readFile });

    await expect(
      openAnalysisFromFilePath("/tmp/pricing-game.gta"),
    ).resolves.toBe(true);

    expect(useAnalysisStore.getState().analysis).toEqual(analysis);
    expect(useAnalysisStore.getState().workflow.currentStage).toBe("payoffs");
    expect(useAnalysisStore.getState().fileName).toBe("pricing-game.gta");
    expect(useAnalysisStore.getState().filePath).toBe("/tmp/pricing-game.gta");
    expect(useAnalysisStore.getState().isDirty).toBe(false);
  });

  it("saves in place through a File System API handle without showing a dialog", async () => {
    const writtenChunks: string[] = [];
    const mockWritable = {
      write: vi.fn((text: string) => {
        writtenChunks.push(text);
      }),
      close: vi.fn(),
    };
    const mockHandle = {
      name: "pricing-game.gta",
      getFile: vi.fn(),
      createWritable: vi.fn().mockResolvedValue(mockWritable),
    } as unknown as FileSystemFileHandle;

    // Disable Electron so the File System API path is tested
    window.electronAPI = undefined as unknown as ElectronAPI;

    useAnalysisStore.getState().renameAnalysis("Pricing Game");
    useAnalysisStore.getState().setAnalysisFileReference({
      fileName: "pricing-game.gta",
      fileHandle: mockHandle,
    });

    await expect(saveAnalysis()).resolves.toBe(true);
    expect(mockWritable.write).toHaveBeenCalledTimes(1);
    expect(mockWritable.close).toHaveBeenCalledTimes(1);
    expect(writtenChunks[0]).toContain('"Pricing Game"');
    expect(useAnalysisStore.getState().isDirty).toBe(false);
    expect(useAnalysisStore.getState().fileHandle).toBe(mockHandle);
  });

  it("keeps the current analysis untouched when open fails to parse", async () => {
    const readFile = vi.fn().mockResolvedValue({
      filePath: "/tmp/broken.gta",
      content: "{",
    });

    window.electronAPI = createElectronApiMock({ readFile });
    useAnalysisStore.getState().renameAnalysis("Pricing Game");

    await expect(openAnalysisFromFilePath("/tmp/broken.gta")).resolves.toBe(
      false,
    );
    expect(useAnalysisStore.getState().analysis.name).toBe("Pricing Game");
    expect(useAnalysisStore.getState().isDirty).toBe(true);
    expect(window.alert).toHaveBeenCalledTimes(1);
  });
});
