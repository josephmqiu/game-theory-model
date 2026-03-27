// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAnalysisSavePayload,
  loadAnalysisFromText,
  saveAnalysis,
} from "@/services/analysis/analysis-persistence";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { useThreadStore } from "@/stores/thread-store";

function mockFetchForPersistence(
  exportSnapshotAnalysis?: Record<string, unknown> | null,
) {
  return vi.fn().mockImplementation((url: string) => {
    if (
      typeof url === "string" &&
      url.includes("/api/workspace/export-snapshot")
    ) {
      if (exportSnapshotAnalysis) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ analysis: exportSnapshotAnalysis }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    }
    // Default: workspace sync endpoint
    return Promise.resolve({ ok: true, status: 200 });
  });
}

describe("analysis-persistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useEntityGraphStore.setState(useEntityGraphStore.getInitialState(), true);
    useEntityGraphStore.getState().newAnalysis("rock vs paper vs scissors");
    useEntityGraphStore.getState().markDirty();
    // Mock hydrateWorkspace to avoid WebSocket call in jsdom tests
    vi.spyOn(useThreadStore.getState(), "hydrateWorkspace").mockResolvedValue();

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
    // Default: export-snapshot returns null (server unavailable), sync succeeds
    vi.stubGlobal("fetch", mockFetchForPersistence(null));
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
      createWritable: vi
        .fn()
        .mockRejectedValue(
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
    const showSaveFilePicker = vi
      .fn()
      .mockRejectedValue(
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

  it("creates a v4 workspace save payload", async () => {
    const payload = await createAnalysisSavePayload();
    const parsed = JSON.parse(payload.text);

    expect(parsed.type).toBe("game-theory-workspace");
    expect(parsed.version).toBe(4);
    expect(parsed.workspace.id).toBeTypeOf("string");
    expect(parsed.workspace.analysis).toBeDefined();
    expect(parsed.workspace.layout).toBeDefined();
  });

  it("uses server entities when export-snapshot is available", async () => {
    const serverAnalysis = {
      id: "server-analysis",
      name: "Server Analysis",
      topic: "server topic",
      entities: [
        {
          id: "se1",
          type: "fact",
          phase: "situational-grounding",
          data: { type: "fact", content: "server fact", category: "action" },
          confidence: "high",
          source: "ai",
          rationale: "from server",
          revision: 1,
          stale: false,
        },
      ],
      relationships: [],
      phases: [],
    };
    vi.stubGlobal("fetch", mockFetchForPersistence(serverAnalysis));

    const payload = await createAnalysisSavePayload();
    const parsed = JSON.parse(payload.text);

    expect(parsed.workspace.analysis.id).toBe("server-analysis");
    expect(parsed.workspace.analysis.entities).toHaveLength(1);
    expect(parsed.workspace.analysis.entities[0].id).toBe("se1");
  });

  it("falls back to local state when server is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    const state = useEntityGraphStore.getState();
    const payload = await createAnalysisSavePayload();
    const parsed = JSON.parse(payload.text);

    // Should use local state from Zustand store
    expect(parsed.workspace.analysis.topic).toBe("rock vs paper vs scissors");
    expect(parsed.workspace.analysis.id).toBe(state.analysis.id);
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

  it("sends import flag when loading a .gta file", async () => {
    const fetchMock = mockFetchForPersistence(null);
    vi.stubGlobal("fetch", fetchMock);

    await loadAnalysisFromText(
      JSON.stringify({
        type: "game-theory-workspace",
        version: 4,
        workspace: {
          id: "workspace-1",
          name: "Import Test",
          analysisType: "game-theory",
          createdAt: 100,
          updatedAt: 200,
          analysis: {
            id: "a1",
            name: "Test",
            topic: "test",
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
      { fileName: "test.gta", filePath: null, fileHandle: null },
    );

    // Find the sync call (POST to /api/workspace/state)
    const syncCall = fetchMock.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" && call[0].includes("/api/workspace/state"),
    );
    expect(syncCall).toBeDefined();
    const body = JSON.parse((syncCall![1] as { body: string }).body);
    expect(body.import).toBe(true);
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

    const payload = await createAnalysisSavePayload();
    const parsed = JSON.parse(payload.text);

    expect(parsed.workspace.id).toBe("workspace-1");
    expect(parsed.workspace.createdAt).toBe(123);
    expect(parsed.workspace.updatedAt).toBeGreaterThanOrEqual(456);
  });
});
