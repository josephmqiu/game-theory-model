import { describe, expect, it } from "vitest";
import { afterEach } from "vitest";
import { completeCommand, getPendingCommands } from "../../utils/mcp-command-bus";
import handler from "./run-phase.ts";
import { callPost } from "../../test-support/http";

describe("/api/analysis/run-phase", () => {
  afterEach(() => {
    for (const command of getPendingCommands()) {
      completeCommand({ id: command.id, status: "failed", error: "test cleanup" });
    }
  });

  it("validates request payloads", async () => {
    const response = await callPost<{ success: boolean; phase: number; summary: string }>(
      handler,
      "/api/analysis/run-phase",
      { phase: "bad" },
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.summary).toBe("Invalid request body");
  });

  it("returns completed results when execution finishes", async () => {
    const pending = callPost<{
      success: true;
      phase: number;
      summary: string;
      result: { ok: boolean };
    }>(handler, "/api/analysis/run-phase", {
      phase: 4,
      input: {},
    });

    await new Promise((resolve) => setTimeout(resolve, 1));
    const [queued] = getPendingCommands().filter(
      (command) => command.type === "run_phase",
    );
    expect(queued).toBeTruthy();

    completeCommand({
      id: queued.id,
      status: "completed",
      result: { ok: true },
    });

    const response = await pending;
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.phase).toBe(4);
    expect(response.body.result).toEqual({ ok: true });
  });

  it("maps execution failures to HTTP 500", async () => {
    const pending = callPost<{
      success: false;
      phase: number;
      summary: string;
      error: string;
    }>(handler, "/api/analysis/run-phase", {
      phase: 2,
      input: {},
    });

    await new Promise((resolve) => setTimeout(resolve, 1));
    const [queued] = getPendingCommands().filter(
      (command) => command.type === "run_phase",
    );
    expect(queued).toBeTruthy();

    completeCommand({
      id: queued.id,
      status: "failed",
      error: "phase failure",
    });

    const response = await pending;
    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.summary).toContain("failed");
    expect(response.body.error).toBe("phase failure");
  });
});
