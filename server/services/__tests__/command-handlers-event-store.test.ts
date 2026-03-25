import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkspaceDatabase } from "../workspace";
import * as analysisAgent from "../../agents/analysis-agent";
import {
  _resetForTest as resetCommandHandlers,
  submitCommand,
} from "../command-handlers";

vi.mock("../analysis-service", () => ({
  runPhase: vi.fn(async () => ({
    success: false,
    error: "stop-after-start",
  })),
}));

describe("command-handlers durable run start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCommandHandlers();
    analysisAgent._resetForTest();
  });

  it("creates or reuses the primary thread when analysis.start omits threadId", async () => {
    const receipt = await submitCommand({
      kind: "analysis.start",
      topic: "Test topic",
      requestedBy: "test",
    });

    expect(receipt.status).toBe("completed");
    const result = receipt.result as {
      runId: string;
      workspaceId: string;
      threadId: string;
    };

    expect(result.threadId).toBe(`${result.workspaceId}:primary-thread`);

    const database = getWorkspaceDatabase();
    const thread = database.threads.getThreadState(result.threadId);
    expect(thread).toMatchObject({
      id: result.threadId,
      workspaceId: result.workspaceId,
      isPrimary: true,
    });

    const run = database.runs.getRunState(result.runId);
    expect(run).toMatchObject({
      id: result.runId,
      threadId: result.threadId,
      workspaceId: result.workspaceId,
      kind: "analysis",
    });
  });
});
