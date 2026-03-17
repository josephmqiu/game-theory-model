import { afterEach, describe, expect, it } from "vitest";
import {
  completeCommand,
  getPendingCommands,
} from "../../../server/utils/mcp-command-bus";
import handler from "../../../server/api/mcp/commands.post.ts";
import { callPost } from "../../../server/test-support/http";

function clearQueue(): void {
  for (const command of getPendingCommands()) {
    completeCommand({
      id: command.id,
      status: "failed",
      error: "test cleanup",
    });
  }
}

describe("/api/mcp/commands.post", () => {
  afterEach(() => {
    clearQueue();
  });

  it("enqueues a command when waitForResult is not set", async () => {
    const response = await callPost<{
      status: string;
      command: {
        id: string;
        type: string;
      };
    }>(handler, "/api/mcp/commands", {
      type: "run_phase",
      payload: { phase: 2, input: {} },
      sourceClientId: "ui-test",
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("queued");
    expect(response.body.command.type).toBe("run_phase");
    expect(response.body.command.id).toBeTruthy();
  });

  it("returns queued status when no renderer consumes the command", async () => {
    const response = await callPost<{
      status: string;
      error: string;
      command?: { id: string };
    }>(handler, "/api/mcp/commands", {
      type: "send_chat",
      payload: {
        system: "test",
        provider: "anthropic",
        model: "claude-3-opus",
        messages: [{ role: "user", content: "hello" }],
      },
      waitForResult: true,
      timeoutMs: 5,
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("queued");
    expect(response.body.command?.id).toBeTruthy();
  });

  it("returns completed state when command resolves", async () => {
    const pending = callPost<{
      status: "completed" | "failed";
      command: { id: string; status: "completed" | "failed" };
    }>(handler, "/api/mcp/commands", {
      type: "start_analysis",
      payload: { description: "Warmup", manual: true },
      waitForResult: true,
      timeoutMs: 250,
    });

    await new Promise((resolve) => setTimeout(resolve, 1));
    const [queued] = getPendingCommands().filter(
      (command) => command.type === "start_analysis",
    );
    expect(queued).toBeTruthy();

    completeCommand({
      id: queued.id,
      status: "completed",
      result: { done: true },
      sourceClientId: "runner",
    });

    const response = await pending;
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
    expect(response.body.command.status).toBe("completed");
    expect(response.body.command).toMatchObject({ id: queued.id });
  });

  it("maps execution failures to HTTP 500", async () => {
    const queued = callPost<{
      status: string;
      command: { id: string; status: "failed" };
    }>(handler, "/api/mcp/commands", {
      type: "apply_proposal",
      payload: { proposalId: "proposal-1" },
      waitForResult: true,
      timeoutMs: 250,
    });

    await new Promise((resolve) => setTimeout(resolve, 1));
    const [command] = getPendingCommands().filter(
      (entry) => entry.type === "apply_proposal",
    );
    completeCommand({
      id: command.id,
      status: "failed",
      error: "proposal failed",
    });

    const response = await queued;
    expect(response.status).toBe(500);
    expect(response.body.status).toBe("failed");
    expect(response.body.command.status).toBe("failed");
  });

  it("rejects excessively long wait timeouts", async () => {
    const response = await callPost<{ status: string; error: string }>(
      handler,
      "/api/mcp/commands",
      {
        type: "start_analysis",
        payload: { description: "Validation timeout", manual: false },
        waitForResult: true,
        timeoutMs: 120_001,
      },
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
  });

  it("rejects invalid command envelopes", async () => {
    const response = await callPost<{
      status: "error";
      error: string;
    }>(handler, "/api/mcp/commands", { type: "unsupported", payload: {} });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
  });
});
