import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAppSettingsStore,
  createPreferenceStore,
} from "../persistence";

describe("electron persistence helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("retries preference writes after a failed flush without dropping dirty state", async () => {
    const mkdirMock = vi.fn().mockResolvedValue(undefined);
    const readFileMock = vi.fn().mockRejectedValue(new Error("missing"));
    const writeFileMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValueOnce(undefined);
    const logErrorMock = vi.fn();

    const store = createPreferenceStore({
      getPrefsPath: () => "/tmp/preferences.json",
      getUserDataPath: () => "/tmp",
      logError: logErrorMock,
      writeDelayMs: 10,
      fs: {
        mkdir: mkdirMock,
        readFile: readFileMock,
        writeFile: writeFileMock,
      },
    });

    await store.load();
    store.set("panelCorner", "bottom-left");

    await vi.advanceTimersByTimeAsync(10);
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(store.hasPendingWrite()).toBe(true);
    expect(logErrorMock).toHaveBeenCalledWith(
      "[prefs] Failed to write preferences: disk full",
    );

    await vi.advanceTimersByTimeAsync(10);
    expect(writeFileMock).toHaveBeenCalledTimes(2);
    expect(store.hasPendingWrite()).toBe(false);
  });

  it("serializes overlapping app settings writes so patches are not lost", async () => {
    let fileContents = JSON.stringify({ autoUpdate: false });

    const store = createAppSettingsStore<{
      autoUpdate?: boolean;
      telemetry?: boolean;
    }>({
      getSettingsPath: () => "/tmp/settings.json",
      getUserDataPath: () => "/tmp",
      fs: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        readFile: (vi.fn(async () => fileContents) as unknown) as typeof import("node:fs/promises").readFile,
        writeFile: (vi.fn(async (_path, nextContents) => {
          await Promise.resolve();
          fileContents = String(nextContents);
        }) as unknown) as typeof import("node:fs/promises").writeFile,
      },
    });

    await Promise.all([
      store.write({ autoUpdate: true }),
      store.write({ telemetry: true }),
    ]);

    expect(JSON.parse(fileContents)).toEqual({
      autoUpdate: true,
      telemetry: true,
    });
  });
});
