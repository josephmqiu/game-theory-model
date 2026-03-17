import { afterEach, describe, expect, it } from "vitest";
import {
  completeCommand,
  getPendingCommands,
} from "../../../server/utils/mcp-command-bus";
import { enqueueCommand } from "../../../server/utils/mcp-command-bus";
import handler from "../../../server/api/mcp/commands.get.ts";
import { callGet } from "../../../server/test-support/http";

function clearQueue(): void {
  for (const command of getPendingCommands()) {
    completeCommand({ id: command.id, status: "failed", error: "test cleanup" });
  }
}

describe("/api/mcp/commands.get", () => {
  afterEach(() => {
    clearQueue();
  });

  it("returns queued command list", async () => {
    const command = enqueueCommand({
      type: "run_next_phase",
      payload: {},
    });

    const response = await callGet<{
      status: string;
      commands: Array<{ id: string; type: string }>;
    }>(handler, "/api/mcp/commands");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.commands).toEqual(expect.arrayContaining([expect.objectContaining({ id: command.id })]));
  });
});
