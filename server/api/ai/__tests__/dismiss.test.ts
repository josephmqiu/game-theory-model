import { beforeEach, describe, expect, it, vi } from "vitest";

const readBodyMock = vi.fn();
const dismissMock = vi.fn();

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  readBody: (...args: unknown[]) => readBodyMock(...args),
}));

vi.mock("../../../services/runtime-status", () => ({
  dismiss: (...args: unknown[]) => dismissMock(...args),
}));

describe("/api/ai/dismiss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dismissMock.mockReturnValue({
      dismissed: true,
      deferredRevalidationPending: false,
    });
  });

  it("resets a terminal run to idle through runtime-status dismiss", async () => {
    readBodyMock.mockResolvedValue({ runId: "run-cancelled" });

    const route = (await import("../dismiss.post")).default;
    const result = await route({} as never);

    expect(dismissMock).toHaveBeenCalledWith("run-cancelled");
    expect(result).toEqual({
      dismissed: true,
      deferredRevalidationPending: false,
    });
  });
});
