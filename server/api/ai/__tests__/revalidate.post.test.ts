import { beforeEach, describe, expect, it, vi } from "vitest";

const readBodyMock = vi.fn();
const setResponseStatusMock = vi.fn();
const revalidateMock = vi.fn();

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  readBody: (...args: unknown[]) => readBodyMock(...args),
  setResponseStatus: (...args: unknown[]) => setResponseStatusMock(...args),
}));

vi.mock("../../../services/revalidation-service", () => ({
  revalidate: (...args: unknown[]) => revalidateMock(...args),
}));

describe("/api/ai/revalidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revalidateMock.mockReturnValue({ runId: "reval-1" });
  });

  it("starts revalidation from a valid runnable phase", async () => {
    readBodyMock.mockResolvedValue({ phase: "baseline-model" });

    const route = (await import("../revalidate.post")).default;
    const result = await route({} as never);

    expect(revalidateMock).toHaveBeenCalledWith(undefined, "baseline-model");
    expect(result).toEqual({ runId: "reval-1" });
  });

  it("rejects an invalid phase with 400", async () => {
    readBodyMock.mockResolvedValue({ phase: "revalidation" });

    const route = (await import("../revalidate.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({ error: "Invalid phase" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});
