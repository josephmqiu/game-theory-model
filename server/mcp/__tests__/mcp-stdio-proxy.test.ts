import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("mcp-stdio-proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails fast when Nitro is unreachable", async () => {
    const { runProxy } = await import("../mcp-stdio-proxy");
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    let stderrText = "";
    stderr.on("data", (chunk) => {
      stderrText += chunk.toString("utf-8");
    });

    await expect(
      runProxy({
        stdin,
        stdout,
        stderr,
        fetchImpl: vi
          .fn()
          .mockRejectedValue(new Error("connect ECONNREFUSED")) as typeof fetch,
      }),
    ).rejects.toThrow("Nitro MCP endpoint is unreachable");

    expect(stderrText).toContain("Nitro MCP endpoint is unreachable");
  });

  it("forwards concurrent requests without interleaving stdout lines", async () => {
    const { runProxy } = await import("../mcp-stdio-proxy");
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    let stdoutText = "";

    stdout.on("data", (chunk) => {
      stdoutText += chunk.toString("utf-8");
    });

    const fetchImpl = vi.fn(
      async (input: string | URL, init?: RequestInit): Promise<Response> => {
        if (init?.method === "GET") {
          return {
            text: async () => "",
          } as Response;
        }

        const body = JSON.parse(String(init?.body)) as { id: number };
        const delay = body.id === 1 ? 20 : 5;
        await new Promise((resolve) => setTimeout(resolve, delay));

        return {
          text: async () =>
            JSON.stringify({
              jsonrpc: "2.0",
              id: body.id,
              result: { echoedFrom: String(input) },
            }),
        } as Response;
      },
    );

    const runPromise = runProxy({
      stdin,
      stdout,
      stderr,
      port: 3100,
      fetchImpl: fetchImpl as typeof fetch,
    });

    stdin.write('{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');
    stdin.write('{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n');
    stdin.end();

    await runPromise;

    const lines = stdoutText
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { id: number; result: { echoedFrom: string } });

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.id).sort()).toEqual([1, 2]);
    expect(lines.every((line) => line.result.echoedFrom === "http://127.0.0.1:3100/mcp")).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
