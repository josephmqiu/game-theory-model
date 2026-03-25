import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetForTest as resetCommandBus,
  startCommand,
} from "../../../services/command-bus";

const getQueryMock = vi.fn();
const setResponseHeadersMock = vi.fn();
const setResponseStatusMock = vi.fn();

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  getQuery: (...args: unknown[]) => getQueryMock(...args),
  setResponseHeaders: (...args: unknown[]) => setResponseHeadersMock(...args),
  setResponseStatus: (...args: unknown[]) => setResponseStatusMock(...args),
}));

describe("/api/ai/command-receipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCommandBus();
  });

  it("returns 400 when no query id is provided", async () => {
    getQueryMock.mockReturnValue({});

    const route = (await import("../command-receipt.get")).default;
    const result = await route({} as never);

    expect(result).toEqual({
      error: "Missing required query parameter: commandId or receiptId",
    });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
  });

  it("returns a receipt by commandId", async () => {
    const started = await startCommand(
      {
        kind: "analysis.abort",
        commandId: "cmd-1",
        requestedBy: "test",
      },
      {
        schedule: () => {
          // leave receipt in accepted state
        },
      },
    );

    getQueryMock.mockReturnValue({ commandId: "cmd-1" });

    const route = (await import("../command-receipt.get")).default;
    const result = await route({} as never);

    expect(result).toEqual({ receipt: started.receipt });
  });

  it("returns 404 when no receipt exists", async () => {
    getQueryMock.mockReturnValue({ receiptId: "missing" });

    const route = (await import("../command-receipt.get")).default;
    const result = await route({} as never);

    expect(result).toEqual({ error: "Command receipt not found" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 404);
  });
});
