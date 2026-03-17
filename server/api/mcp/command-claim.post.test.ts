import { afterEach, describe, expect, it } from "vitest";
import { completeCommand, enqueueCommand, getPendingCommands } from "../../utils/mcp-command-bus";
import handler from "./command-claim.post.ts";
import { callPost } from "../../test-support/http";

type MockedCommandPayload = {
  status: "claimed" | "missing" | "busy";
  command?: {
    id: string;
    type: string;
    ownerClientId: string | null;
    status: "queued";
  };
  error?: string;
};

function clearQueue(): void {
  for (const command of getPendingCommands()) {
    completeCommand({
      id: command.id,
      status: "failed",
      error: "test cleanup",
      sourceClientId: command.ownerClientId ?? undefined,
    });
  }
}

describe("/api/mcp/command-claim", () => {
  afterEach(() => {
    clearQueue();
  });

  it("claims an unowned queued command", async () => {
    const command = enqueueCommand({
      type: "play_turn",
      payload: {
        sessionId: "session-1",
        playerId: "p1",
        action: "attack",
      },
    });

    const response = await callPost<MockedCommandPayload>(
      handler,
      "/api/mcp/command-claim",
      {
        id: command.id,
        ownerClientId: "renderer-a",
      },
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("claimed");
    expect(response.body.command?.ownerClientId).toBe("renderer-a");
  });

  it("returns busy when another owner has already claimed the command", async () => {
    const command = enqueueCommand({
      type: "play_turn",
      payload: {
        sessionId: "session-1",
        playerId: "p1",
        action: "attack",
      },
      sourceClientId: "renderer-a",
    });

    const firstClaim = await callPost<MockedCommandPayload>(
      handler,
      "/api/mcp/command-claim",
      {
        id: command.id,
        ownerClientId: "renderer-a",
      },
    );

    const response = await callPost<MockedCommandPayload>(
      handler,
      "/api/mcp/command-claim",
      {
        id: command.id,
        ownerClientId: "renderer-b",
      },
    );

    expect(firstClaim.status).toBe(200);
    expect(firstClaim.body.status).toBe("claimed");
    expect(response.status).toBe(409);
    expect(response.body.status).toBe("busy");
    expect(response.body.error).toContain("already claimed");
  });

  it("returns missing for completed commands and unknown ids", async () => {
    const command = enqueueCommand({
      type: "run_next_phase",
      payload: {},
    });

    completeCommand({
      id: command.id,
      status: "completed",
      result: { done: true },
    });

    const response = await callPost<MockedCommandPayload>(
      handler,
      "/api/mcp/command-claim",
      {
        id: command.id,
        ownerClientId: "renderer-a",
      },
    );

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("missing");
    expect(response.body.error).toContain("not found");
  });

  it("rejects invalid claim payloads", async () => {
    const response = await callPost<{ status: string; error: string }>(
      handler,
      "/api/mcp/command-claim",
      {
        id: "",
        ownerClientId: "",
      },
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.error).toContain("Invalid command claim payload");
  });
});
