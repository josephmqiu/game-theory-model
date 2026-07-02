import { createServer } from "node:http";
import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import {
  getMcpServerStatus,
  startMcpServer,
  type InProcessMcpServerHandle,
} from "../mcp-server";

async function occupyFreePort(): Promise<{
  port: number;
  release: () => Promise<void>;
}> {
  const blocker = createServer();
  blocker.listen(0, "127.0.0.1");
  await once(blocker, "listening");
  const address = blocker.address();
  if (!address || typeof address !== "object") {
    throw new Error("Failed to bind blocker server");
  }
  return {
    port: address.port,
    release: async () => {
      blocker.close();
      await once(blocker, "close");
    },
  };
}

describe("startMcpServer dynamic port (decision 10)", () => {
  let handle: InProcessMcpServerHandle | null = null;
  let release: (() => Promise<void>) | null = null;

  afterEach(async () => {
    await handle?.close();
    handle = null;
    await release?.();
    release = null;
  });

  it("falls back to an OS-assigned port when the preferred port is taken", async () => {
    const blocked = await occupyFreePort();
    release = blocked.release;

    handle = await startMcpServer(blocked.port);

    expect(handle.available).toBe(true);
    expect(handle.port).not.toBe(blocked.port);
    expect(handle.port).toBeGreaterThan(0);

    // Status reports the ACTUAL bound port — this is what the UI and the
    // codex/claude registrations consume.
    expect(getMcpServerStatus()).toEqual({
      available: true,
      port: handle.port,
    });

    // The server actually answers on the dynamic port (404 for non-/mcp).
    const res = await fetch(`http://127.0.0.1:${handle.port}/not-mcp`);
    expect(res.status).toBe(404);
  });
});
