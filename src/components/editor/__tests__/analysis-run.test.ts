import { describe, expect, it, vi } from "vitest";
import { abortAnalysisRun } from "@/components/editor/analysis-run";
import type { AnalysisResult } from "@/services/ai/analysis-orchestrator";
import type { RunLogger } from "@/services/ai/ai-logger";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createLogger(order: string[]): RunLogger {
  return {
    log: vi.fn(),
    warn: vi.fn(() => {
      order.push("warn");
    }),
    error: vi.fn(),
    capture: vi.fn(),
    flush: vi.fn(async () => {
      order.push("flush");
      return true;
    }),
    entries: vi.fn(() => []),
  };
}

describe("abortAnalysisRun", () => {
  it("aborts, waits for the active promise, and flushes the logger", async () => {
    const order: string[] = [];
    const deferred = createDeferred<AnalysisResult>();
    const controller = new AbortController();
    const logger = createLogger(order);

    const abortPromise = abortAnalysisRun(
      {
        controller,
        promise: deferred.promise,
        runId: "run-123",
        logger,
      },
      "new-analysis",
    );

    expect(controller.signal.aborted).toBe(true);
    await Promise.resolve();
    expect(order).toEqual(["warn"]);

    deferred.resolve({
      runId: "run-123",
      entities: [],
      relationships: [],
    });

    await abortPromise;

    expect(order).toEqual(["warn", "flush"]);
    expect(logger.warn).toHaveBeenCalledWith("ui", "abort-requested", {
      reason: "new-analysis",
    });
    expect(logger.flush).toHaveBeenCalledTimes(1);
  });
});
