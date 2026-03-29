import { beforeEach, describe, expect, it, vi } from "vitest";
const isRunningMock = vi.fn();
const abortMock = vi.fn();

vi.mock("../../../agents/analysis-agent", () => ({
  isRunning: () => isRunningMock(),
  abort: () => abortMock(),
}));

describe("/api/ai/abort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns aborted true when a run is active", async () => {
    isRunningMock.mockReturnValue(true);

    const route = (await import("../abort")).default;
    const result = route({} as never);

    expect(result).toEqual({ aborted: true });
    expect(abortMock).toHaveBeenCalledTimes(1);
  });

  it("returns aborted false when no run is active", async () => {
    isRunningMock.mockReturnValue(false);

    const route = (await import("../abort")).default;
    const result = route({} as never);

    expect(result).toEqual({ aborted: false });
    expect(abortMock).not.toHaveBeenCalled();
  });
});
