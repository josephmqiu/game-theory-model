// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAnalysisSavePayload,
  loadAnalysisFromText,
  saveAnalysis,
} from "@/services/analysis/analysis-persistence";
import { useEntityGraphStore } from "@/stores/entity-graph-store";

describe("analysis-persistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useEntityGraphStore.setState(useEntityGraphStore.getInitialState(), true);
    useEntityGraphStore.getState().newAnalysis("rock vs paper vs scissors");
    useEntityGraphStore.getState().markDirty();

    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to a browser download when picker writes are blocked", async () => {
    const createObjectURL = vi.fn(() => "blob:analysis");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    const handle = {
      name: "rps-analysis.gta",
      createWritable: vi.fn().mockRejectedValue(
        new DOMException(
          "The request is not allowed by the user agent or the platform in the current context.",
          "SecurityError",
        ),
      ),
    } as unknown as FileSystemFileHandle;

    const showSaveFilePicker = vi.fn().mockResolvedValue(handle);
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      writable: true,
      value: showSaveFilePicker,
    });

    const result = await saveAnalysis();

    expect(result).toBe(true);
    expect(showSaveFilePicker).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(alertSpy).not.toHaveBeenCalled();

    const state = useEntityGraphStore.getState();
    expect(state.isDirty).toBe(false);
    expect(state.fileHandle).toBeNull();
    expect(state.filePath).toBeNull();
    expect(state.fileName).toBe("rock-vs-paper-vs-scissors.gta");
  });

  it("treats picker cancellation as a no-op", async () => {
    const createObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });

    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const showSaveFilePicker = vi.fn().mockRejectedValue(
      new DOMException("The user aborted a request.", "AbortError"),
    );
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      writable: true,
      value: showSaveFilePicker,
    });

    const result = await saveAnalysis();

    expect(result).toBe(false);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(useEntityGraphStore.getState().isDirty).toBe(true);
  });

  it("creates a v4 workspace save payload", () => {
    const payload = createAnalysisSavePayload();
    const parsed = JSON.parse(payload.text);

    expect(parsed.type).toBe("game-theory-workspace");
    expect(parsed.version).toBe(4);
    expect(parsed.workspace.id).toBeTypeOf("string");
    expect(parsed.workspace.analysis).toBeDefined();
    expect(parsed.workspace.layout).toBeDefined();
  });

  it("loads a legacy v3 file into the current analysis store", async () => {
    const legacyFile = JSON.stringify({
      type: "game-theory-analysis",
      version: 3,
      analysis: {
        id: "analysis-1",
        name: "Trade War Analysis",
        topic: "US-China trade tensions",
        entities: [
          {
            id: "e1",
            type: "fact",
            phase: "situational-grounding",
            data: {
              type: "fact",
              date: "2025-03-01",
              source: "Reuters",
              content: "New tariffs announced",
              category: "action",
            },
            confidence: "high",
            source: "human",
            rationale: "Directly reported",
            revision: 1,
            stale: false,
          },
        ],
        relationships: [],
        phases: [
          {
            phase: "situational-grounding",
            status: "complete",
            entityIds: ["e1"],
          },
        ],
      },
      layout: {
        e1: { x: 100, y: 200, pinned: true },
      },
    });

    await loadAnalysisFromText(legacyFile, {
      fileName: "trade-war.gta",
      filePath: "/tmp/trade-war.gta",
      fileHandle: null,
    });

    const state = useEntityGraphStore.getState();
    expect(state.analysis.id).toBe("analysis-1");
    expect(state.analysis.entities).toHaveLength(1);
    expect(state.layout.e1).toEqual({ x: 100, y: 200, pinned: true });
    expect(state.fileName).toBe("trade-war.gta");
    expect(state.filePath).toBe("/tmp/trade-war.gta");
  });

  it("preserves loaded workspace metadata across later saves", async () => {
    await loadAnalysisFromText(
      JSON.stringify({
        type: "game-theory-workspace",
        version: 4,
        workspace: {
          id: "workspace-1",
          name: "Trade War Workspace",
          analysisType: "game-theory",
          createdAt: 123,
          updatedAt: 456,
          analysis: {
            id: "analysis-1",
            name: "Trade War Analysis",
            topic: "US-China trade tensions",
            entities: [],
            relationships: [],
            phases: [],
          },
          layout: {},
          threads: [],
          artifacts: [],
          checkpointHeaders: [],
          pendingQuestions: [],
        },
      }),
      {
        fileName: "trade-war.gta",
        filePath: "/tmp/trade-war.gta",
        fileHandle: null,
      },
    );

    const payload = createAnalysisSavePayload();
    const parsed = JSON.parse(payload.text);

    expect(parsed.workspace.id).toBe("workspace-1");
    expect(parsed.workspace.createdAt).toBe(123);
    expect(parsed.workspace.updatedAt).toBeGreaterThanOrEqual(456);
  });
});
