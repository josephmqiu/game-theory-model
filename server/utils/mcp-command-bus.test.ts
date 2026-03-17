import { beforeEach, describe, expect, it } from "vitest";
import {
  claimCommand,
  completeCommand,
  enqueueCommand,
  getCommand,
  getPendingCommands,
  waitForCommandResult,
} from "./mcp-command-bus";

function clearQueue(): void {
  for (const command of getPendingCommands()) {
    completeCommand({
      id: command.id,
      status: "failed",
      error: "test cleanup",
    });
  }
}

describe("mcp command bus", () => {
  beforeEach(() => {
    clearQueue();
  });

  it("enqueues commands with queued status", () => {
    const command = enqueueCommand({
      type: "start_analysis",
      payload: { description: "Test analysis", manual: false },
      sourceClientId: "test-suite",
    });

    expect(command.status).toBe("queued");
    expect(command.type).toBe("start_analysis");
    expect(command.sourceClientId).toBe("test-suite");
    expect(getCommand(command.id)?.status).toBe("queued");
    expect(getPendingCommands()).toContainEqual(command);
  });

  it("completes commands and resolves pending waiters", async () => {
    const command = enqueueCommand({
      type: "send_chat",
      payload: {
        system: "Test system",
        provider: "anthropic",
        model: "claude-3-opus",
        messages: [{ role: "user", content: "hello" }],
      },
    });

    const pending = waitForCommandResult(command.id, 1_000);
    const completed = completeCommand({
      id: command.id,
      status: "completed",
      result: { content: "ok" },
    });

    expect(completed).not.toBeNull();
    await expect(pending).resolves.toEqual(expect.objectContaining({ id: command.id, status: "completed" }));
    expect(getPendingCommands().find((entry) => entry.id === command.id)).toBeUndefined();
  });

  it("returns completed entries immediately", async () => {
    const command = enqueueCommand({
      type: "run_next_phase",
      payload: {},
    });

    completeCommand({
      id: command.id,
      status: "completed",
      result: { ok: true },
    });

    const result = await waitForCommandResult(command.id, 1_000);
    expect(result).not.toBeNull();
    expect(result?.status).toBe("completed");
  });

  it("times out waiting for missing command results", async () => {
    const command = enqueueCommand({
      type: "run_phase",
      payload: { phase: 1, input: {} },
    });

    const result = await waitForCommandResult(command.id, 5);
    expect(result).not.toBeNull();
    expect(result?.status).toBe("queued");
  });

  it("marks commands as claimed and supports busy detection", () => {
    const command = enqueueCommand({
      type: "run_phase",
      payload: { phase: 3, input: {} },
    });

    const first = claimCommand({ id: command.id, ownerClientId: "owner-a" });
    const second = claimCommand({ id: command.id, ownerClientId: "owner-b" });

    expect(first.status).toBe("claimed");
    expect(first.command.ownerClientId).toBe("owner-a");
    expect(second.status).toBe("busy");
    expect(second.command.ownerClientId).toBe("owner-a");
  });

  it("does not allow completion from a non-owning source", () => {
    const command = enqueueCommand({
      type: "run_next_phase",
      payload: {},
      sourceClientId: "source-a",
    });

    claimCommand({ id: command.id, ownerClientId: "source-a" });
    const denied = completeCommand({
      id: command.id,
      status: "completed",
      result: { finished: true },
      sourceClientId: "source-b",
    });

    expect(denied).toBeNull();
    expect(getCommand(command.id)?.status).toBe("queued");
  });

  it("returns null for missing command completion", () => {
    const command = completeCommand({
      id: "does-not-exist",
      status: "completed",
    });
    expect(command).toBeNull();
  });

  it("exposes the pending command list", () => {
    const commandOne = enqueueCommand({
      type: "approve_revalidation",
      payload: { eventId: "revalidation-1" },
    });
    const commandTwo = enqueueCommand({
      type: "dismiss_revalidation",
      payload: { eventId: "revalidation-2" },
    });

    const pending = getPendingCommands();
    expect(pending).toEqual(
      expect.arrayContaining([commandOne, commandTwo]),
    );
    expect(pending.every((entry) => entry.status === "queued")).toBe(true);
  });
});
