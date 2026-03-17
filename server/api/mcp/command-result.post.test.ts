import { afterEach, describe, expect, it } from "vitest";
import {
  claimCommand,
  completeCommand,
  enqueueCommand,
  getPendingCommands,
} from "../../utils/mcp-command-bus";
import handler from "./command-result.post.ts";
import { callPost } from "../../test-support/http";

function clearQueue(): void {
  for (const command of getPendingCommands()) {
    completeCommand({ id: command.id, status: "failed", error: "test cleanup" });
  }
}

describe("/api/mcp/command-result.post", () => {
  afterEach(() => {
    clearQueue();
  });

  it("rejects invalid completion payloads", async () => {
    const response = await callPost<{
      status: "error";
      error: string;
    }>(handler, "/api/mcp/command-result", {});

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
  });

  it("returns 404 for unknown command ids", async () => {
    const response = await callPost<{
      status: string;
      error: string;
    }>(handler, "/api/mcp/command-result", {
      id: "does-not-exist",
      status: "completed",
    });

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("error");
    expect(response.body.error).toContain("Command not found");
  });

  it("applies completion updates and returns the command", async () => {
    const queued = enqueueCommand({
      type: "approve_revalidation",
      payload: { eventId: "evt-1" },
      sourceClientId: "source",
    });

    const response = await callPost<{
      status: "ok";
      command: { id: string; status: "completed"; result: { done: boolean } };
    }>(handler, "/api/mcp/command-result", {
      id: queued.id,
      status: "completed",
      sourceClientId: "runner",
      result: { done: true },
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.command.id).toBe(queued.id);
    expect(response.body.command.status).toBe("completed");
    expect(response.body.command.result).toEqual({ done: true });
  });

  it("returns 409 when another renderer owns the command", async () => {
    const queued = enqueueCommand({
      type: "play_turn",
      payload: {
        sessionId: "session-1",
        playerId: "p1",
        action: "fold",
      },
      sourceClientId: "renderer-owner",
    });

    claimCommand({ id: queued.id, ownerClientId: "renderer-owner" });

    const response = await callPost<{
      status: string;
      error: string;
    }>(
      handler,
      "/api/mcp/command-result",
      {
        id: queued.id,
        status: "completed",
        sourceClientId: "renderer-visitor",
      },
    );

    expect(response.status).toBe(409);
    expect(response.body.status).toBe("error");
    expect(response.body.error).toContain("owned by a different renderer");
  });
});
