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
    expect(
      database.activities.listActivitiesByThreadId(context.threadId),
    ).toEqual([
      expect.objectContaining({
        id: activity.id,
        scope: "chat-turn",
        kind: "tool",
        status: "completed",
        toolName: "WebSearch",
        query: "trade war retaliation ladder",
      }),
    ]);

    database.close();
  });

  it("persists analysis message metadata on durable thread turns", () => {
    const database = createDatabase();
    const threadService = createThreadService(database);
    const context = threadService.ensureThread({
      workspaceId: "workspace-1",
      threadTitle: "Durable analysis",
      producer: "test",
      occurredAt: 100,
    });

    const message = threadService.recordMessage({
      workspaceId: context.workspaceId,
      threadId: context.threadId,
      role: "assistant",
      content: "Completed Situational Grounding.",
      runId: "run-1",
      phaseTurnId: "phase-turn-1",
      phase: "situational-grounding",
      runKind: "analysis",
      source: "analysis",
      kind: "assistant-turn",
      producer: "test",
      occurredAt: 101,
    });

    expect(message).toMatchObject({
      runId: "run-1",
      phaseTurnId: "phase-turn-1",
      phase: "situational-grounding",
      runKind: "analysis",
      source: "analysis",
      kind: "assistant-turn",
    });

    database.close();
  });

  it("persists analysis activity metadata on durable phase activities", () => {
    const database = createDatabase();
    const threadService = createThreadService(database);
    const context = threadService.ensureThread({
      workspaceId: "workspace-1",
      threadTitle: "Durable analysis",
      producer: "test",
      occurredAt: 100,
    });

    const activity = threadService.recordActivity({
      workspaceId: context.workspaceId,
      threadId: context.threadId,
      runId: "run-1",
      phase: "situational-grounding",
      phaseTurnId: "phase-turn-1",
      scope: "analysis-phase",
      kind: "tool",
      message: "Used query_entities",
      status: "completed",
      toolName: "query_entities",
      producer: "test",
      occurredAt: 101,
    });

    expect(activity).toMatchObject({
      runId: "run-1",
      phase: "situational-grounding",
      phaseTurnId: "phase-turn-1",
      scope: "analysis-phase",
      kind: "tool",
      toolName: "query_entities",
    });

    database.close();
  });

  describe("createThread", () => {
    it("generates threadId in workspaceId:thread-{nanoid} format", () => {
      const database = createDatabase();
      const threadService = createThreadService(database);
      const thread = threadService.createThread({
        workspaceId: "ws-1",
        producer: "test",
        occurredAt: 200,
      });
      expect(thread.id).toMatch(/^ws-1:thread-.+$/);
      database.close();
    });

    it('defaults title to "New Chat" when not provided', () => {
      const database = createDatabase();
      const threadService = createThreadService(database);
      const thread = threadService.createThread({
        workspaceId: "ws-1",
        producer: "test",
        occurredAt: 200,
      });
      expect(thread.title).toBe("New Chat");
      database.close();
    });

    it("uses provided title", () => {
      const database = createDatabase();
      const threadService = createThreadService(database);
      const thread = threadService.createThread({
        workspaceId: "ws-1",
        title: "My analysis",
        producer: "test",
        occurredAt: 200,
      });
      expect(thread.title).toBe("My analysis");
      database.close();
    });
  });

  describe("renameThread", () => {
    it("updates thread title in projection", () => {
      const database = createDatabase();
      const threadService = createThreadService(database);
      const thread = threadService.createThread({
        workspaceId: "ws-1",
        title: "Original",
        producer: "test",
        occurredAt: 200,
      });
      const renamed = threadService.renameThread({
        workspaceId: "ws-1",
        threadId: thread.id,
        title: "Renamed",
        producer: "test",
        occurredAt: 300,
      });
      expect(renamed.title).toBe("Renamed");
      expect(database.threads.getThreadState(thread.id)?.title).toBe("Renamed");
      database.close();
    });

    it('defaults blank title to "Untitled"', () => {
      const database = createDatabase();
      const threadService = createThreadService(database);
      const thread = threadService.createThread({
        workspaceId: "ws-1",
        title: "Original",
        producer: "test",
        occurredAt: 200,
      });
      const renamed = threadService.renameThread({
        workspaceId: "ws-1",
        threadId: thread.id,
        title: "   ",
        producer: "test",
        occurredAt: 300,
      });
      expect(renamed.title).toBe("Untitled");
      database.close();
    });
  });

  describe("deleteThread", () => {
    it("removes non-primary thread from listings", () => {
      const database = createDatabase();
      const threadService = createThreadService(database);
      // First ensure a primary thread exists
      threadService.ensureThread({
        workspaceId: "ws-1",
        producer: "test",
        occurredAt: 100,
      });
      // Create a secondary thread
      const secondary = threadService.createThread({
        workspaceId: "ws-1",
        title: "Secondary",
        producer: "test",
        occurredAt: 200,
      });
      // Delete it
      threadService.deleteThread({
        workspaceId: "ws-1",
        threadId: secondary.id,
        producer: "test",
        occurredAt: 300,
      });
      expect(database.threads.getThreadState(secondary.id)).toBeUndefined();
      database.close();
    });

    it("throws when deleting primary thread", () => {
      const database = createDatabase();
      const threadService = createThreadService(database);
      const context = threadService.ensureThread({
        workspaceId: "ws-1",
        producer: "test",
        occurredAt: 100,
      });
      expect(() =>
        threadService.deleteThread({
          workspaceId: "ws-1",
          threadId: context.threadId,
          producer: "test",
          occurredAt: 200,
        }),
      ).toThrow("Cannot delete the primary thread.");
      database.close();
    });

    it("throws when deleting nonexistent thread", () => {
      const database = createDatabase();
      const threadService = createThreadService(database);
      expect(() =>
        threadService.deleteThread({
          workspaceId: "ws-1",
          threadId: "nonexistent",
          producer: "test",
          occurredAt: 200,
        }),
      ).toThrow("not found");
      database.close();
    });
  });

  describe("listMessagesByThreadId", () => {
    it("returns messages in insertion order", () => {
      const database = createDatabase();
      const threadService = createThreadService(database);
      const context = threadService.ensureThread({
        workspaceId: "ws-1",
        producer: "test",
        occurredAt: 100,
      });
      threadService.recordMessage({
        workspaceId: "ws-1",
        threadId: context.threadId,
        role: "user",
        content: "First",
        producer: "test",
        occurredAt: 101,
      });
      threadService.recordMessage({
        workspaceId: "ws-1",
        threadId: context.threadId,
        role: "assistant",
        content: "Second",
        producer: "test",
        occurredAt: 102,
      });
      threadService.recordMessage({
        workspaceId: "ws-1",
        threadId: context.threadId,
        role: "user",
        content: "Third",
        producer: "test",
        occurredAt: 103,
      });
      const messages = threadService.listMessagesByThreadId(context.threadId);
      expect(messages.map((m) => m.content)).toEqual([
        "First",
        "Second",
        "Third",
      ]);
      database.close();
    });

    it("returns empty array for thread with no messages", () => {
      const database = createDatabase();
      const threadService = createThreadService(database);
      const context = threadService.ensureThread({
        workspaceId: "ws-1",
        producer: "test",
        occurredAt: 100,
      });
      const messages = threadService.listMessagesByThreadId(context.threadId);
      expect(messages).toEqual([]);
      database.close();
    });
  });
});
