// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveAnalysis } from "@/services/analysis/analysis-persistence";
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
});
