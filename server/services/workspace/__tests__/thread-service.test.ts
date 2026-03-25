import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspaceDatabase } from "../workspace-db";
import { createThreadService } from "../thread-service";

describe("thread-service", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (!dir) {
        continue;
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createDatabase() {
    const tempDir = mkdtempSync(join(tmpdir(), "gta-thread-service-"));
    tempDirs.push(tempDir);
    return createWorkspaceDatabase({
      databasePath: join(tempDir, "workspace-state.sqlite"),
    });
  }

  it("resolves a thread, records messages in order, and keeps activities distinct", () => {
    const database = createDatabase();
    const threadService = createThreadService(database);
    const context = threadService.ensureThread({
      workspaceId: "workspace-1",
      threadTitle: "Trade war",
      producer: "test",
      occurredAt: 100,
    });

    const userMessage = threadService.recordMessage({
      workspaceId: context.workspaceId,
      threadId: context.threadId,
      role: "user",
      content: "What should we analyze?",
      producer: "test",
      occurredAt: 101,
    });
    const assistantMessage = threadService.recordMessage({
      workspaceId: context.workspaceId,
      threadId: context.threadId,
      role: "assistant",
      content: "Start with actors, incentives, and escalation options.",
      producer: "test",
      occurredAt: 102,
    });
    const activity = threadService.recordActivity({
      workspaceId: context.workspaceId,
      threadId: context.threadId,
      scope: "chat-turn",
      kind: "tool",
      message: "Used WebSearch",
      status: "completed",
      toolName: "WebSearch",
      query: "trade war retaliation ladder",
      producer: "test",
      occurredAt: 103,
    });

    expect(context.threadId).toBe("workspace-1:primary-thread");
    expect(userMessage.role).toBe("user");
    expect(assistantMessage.role).toBe("assistant");
    expect(
      threadService
        .listMessagesByThreadId(context.threadId)
        .map((message) => message.content),
    ).toEqual([
      "What should we analyze?",
      "Start with actors, incentives, and escalation options.",
    ]);
    expect(database.activities.listActivitiesByThreadId(context.threadId)).toEqual(
      [
        expect.objectContaining({
          id: activity.id,
          scope: "chat-turn",
          kind: "tool",
          status: "completed",
          toolName: "WebSearch",
          query: "trade war retaliation ladder",
        }),
      ],
    );

    database.close();
  });
});
