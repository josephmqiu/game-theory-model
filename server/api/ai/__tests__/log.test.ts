import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "h3";
import { toNodeListener } from "h3/node";

const appendRunLogEntriesMock = vi.fn();

vi.mock("../../../utils/ai-logger", () => ({
  appendRunLogEntries: (...args: unknown[]) => appendRunLogEntriesMock(...args),
}));

import handler from "../log";

describe("/api/ai/log", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl = "";

  beforeEach(async () => {
    appendRunLogEntriesMock.mockReset();
    appendRunLogEntriesMock.mockReturnValue(true);

    const app = createApp();
    app.use("/api/ai/log", handler);

    server = createServer(toNodeListener(app));
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test server.");
    }

    baseUrl = `http://127.0.0.1:${address.port}/api/ai/log`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it("accepts JSON fetch payloads and appends a batched entry list", async () => {
    const entries = [
      {
        ts: "2026-03-18T12:00:00.000Z",
        side: "client",
        level: "log",
        sub: "orchestrator",
        event: "analysis-start",
        run: "run-fetch",
      },
      {
        ts: "2026-03-18T12:00:01.000Z",
        side: "client",
        level: "warn",
        sub: "completion",
        event: "request-timeout",
        run: "run-fetch",
      },
    ];

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "run-fetch",
        entries,
      }),
    });

    expect(response.ok).toBe(true);
    expect(appendRunLogEntriesMock).toHaveBeenCalledTimes(1);
    expect(appendRunLogEntriesMock).toHaveBeenCalledWith("run-fetch", entries);
  });

  it("accepts beacon-style text payloads", async () => {
    const payload = JSON.stringify({
      runId: "run-beacon",
      entries: [
        {
          ts: "2026-03-18T12:05:00.000Z",
          side: "client",
          level: "capture",
          sub: "orchestrator",
          event: "raw-response",
          run: "run-beacon",
          raw: "{\"bad\":true}",
        },
      ],
    });

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: payload,
    });

    expect(response.ok).toBe(true);
    expect(appendRunLogEntriesMock).toHaveBeenCalledTimes(1);
    expect(appendRunLogEntriesMock).toHaveBeenCalledWith("run-beacon", [
      expect.objectContaining({
        event: "raw-response",
        run: "run-beacon",
      }),
    ]);
  });
});
