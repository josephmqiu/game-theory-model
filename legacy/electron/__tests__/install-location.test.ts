import { describe, expect, it } from "vitest";

import { isRunningFromMountedDiskImage } from "../install-location";

describe("isRunningFromMountedDiskImage", () => {
  it("detects packaged macOS apps launched from a mounted disk image", () => {
    expect(
      isRunningFromMountedDiskImage(
        "darwin",
        true,
        "/Volumes/Game Theory Analyzer/Game Theory Analyzer.app/Contents/MacOS/Game Theory Analyzer",
      ),
    ).toBe(true);
  });

  it("does not flag installed macOS apps", () => {
    expect(
      isRunningFromMountedDiskImage(
        "darwin",
        true,
        "/Applications/Game Theory Analyzer.app/Contents/MacOS/Game Theory Analyzer",
      ),
    ).toBe(false);
  });

  it("does not flag unpackaged or non-macOS executables", () => {
    expect(
      isRunningFromMountedDiskImage(
        "darwin",
        false,
        "/Volumes/Game Theory Analyzer/Game Theory Analyzer.app/Contents/MacOS/Game Theory Analyzer",
      ),
    ).toBe(false);

    expect(
      isRunningFromMountedDiskImage(
        "linux",
        true,
        "/Volumes/Game Theory Analyzer/Game Theory Analyzer.app/Contents/MacOS/Game Theory Analyzer",
      ),
    ).toBe(false);
  });
});
