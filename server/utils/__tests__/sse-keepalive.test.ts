import { afterEach, describe, expect, it, vi } from "vitest";
import { startSSEKeepAlive } from "../sse-keepalive";

describe("startSSEKeepAlive", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits immediately and keeps emitting until cleared", () => {
    vi.useFakeTimers();

    const send = vi.fn();
    const timer = startSSEKeepAlive(send, 3_000);

    expect(send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(9_000);
    expect(send).toHaveBeenCalledTimes(4);

    clearInterval(timer);
    vi.advanceTimersByTime(9_000);
    expect(send).toHaveBeenCalledTimes(4);
  });

  it("swallows send failures so cleanup can clear the interval", () => {
    vi.useFakeTimers();

    const send = vi.fn(() => {
      throw new Error("closed");
    });
    const timer = startSSEKeepAlive(send, 5_000);

    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5_000);
    expect(send).toHaveBeenCalledTimes(2);

    clearInterval(timer);
  });
});
