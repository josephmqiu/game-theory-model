import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCommandBus } from "../command-bus";

describe("command-bus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serializes command execution in FIFO order", async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const bus = createCommandBus({
      handlers: {
        "analysis.reset": async (command) => {
          order.push(`start:${command.topic}`);
          if (command.topic === "first") {
            await firstGate;
          }
          order.push(`finish:${command.topic}`);
          return {
            analysis: {} as never,
            revision: order.length,
          };
        },
      },
    });

    const first = bus.submitCommand({
      kind: "analysis.reset",
      topic: "first",
      requestedBy: "test",
    });
    const second = bus.submitCommand({
      kind: "analysis.reset",
      topic: "second",
      requestedBy: "test",
    });

    await Promise.resolve();
    expect(order).toEqual(["start:first"]);

    releaseFirst();

    await first;
    await second;

    expect(order).toEqual([
      "start:first",
      "finish:first",
      "start:second",
      "finish:second",
    ]);
  });

  it("deduplicates repeated receipt ids for the same command fingerprint", async () => {
    const handler = vi.fn(async () => ({
      analysis: {} as never,
      revision: 1,
    }));
    const bus = createCommandBus({
      handlers: {
        "analysis.reset": handler,
      },
    });

    const first = await bus.submitCommand({
      kind: "analysis.reset",
      topic: "same-topic",
      receiptId: "receipt-1",
      requestedBy: "test",
    });
    const second = await bus.submitCommand({
      kind: "analysis.reset",
      topic: "same-topic",
      receiptId: "receipt-1",
      requestedBy: "test",
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(first.status).toBe("completed");
    expect(second.status).toBe("deduplicated");
    expect(second.duplicateOfCommandId).toBe(first.commandId);
    expect(second.result).toEqual(first.result);
  });

  it("marks receipt reuse with a different payload as conflicted", async () => {
    const bus = createCommandBus({
      handlers: {
        "analysis.reset": async () => ({
          analysis: {} as never,
          revision: 1,
        }),
      },
    });

    await bus.submitCommand({
      kind: "analysis.reset",
      topic: "topic-a",
      receiptId: "receipt-1",
      requestedBy: "test",
    });

    const conflict = await bus.submitCommand({
      kind: "analysis.reset",
      topic: "topic-b",
      receiptId: "receipt-1",
      requestedBy: "test",
    });

    expect(conflict.status).toBe("conflicted");
    expect(conflict.error?.message).toContain('Receipt "receipt-1"');
  });

  it("records failed receipts with metadata", async () => {
    const bus = createCommandBus({
      handlers: {
        "analysis.reset": async () => {
          throw new Error("boom");
        },
      },
    });

    const receipt = await bus.submitCommand({
      kind: "analysis.reset",
      topic: "bad-topic",
      runId: "run-1",
      correlationId: "corr-1",
      causationId: "cause-1",
      requestedBy: "test",
    });

    expect(receipt.status).toBe("failed");
    expect(receipt.runId).toBe("run-1");
    expect(receipt.correlationId).toBe("corr-1");
    expect(receipt.causationId).toBe("cause-1");
    expect(receipt.error?.message).toBe("boom");
    expect(receipt.finishedAt).toBeTypeOf("number");
  });
});
