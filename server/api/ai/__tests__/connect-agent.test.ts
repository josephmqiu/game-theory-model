import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

const spawnSyncMock = vi.fn();
const spawnMock = vi.fn();
const execSyncMock = vi.fn();
const readFileMock = vi.fn();

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  exitCode: number | null = null;

  kill = vi.fn((signal: NodeJS.Signals = "SIGTERM") => {
    this.exitCode = signal === "SIGKILL" ? 137 : 0;
    queueMicrotask(() => {
      this.emit("exit", this.exitCode);
      this.emit("close", this.exitCode);
    });
    return true;
  });
}

vi.mock("node:child_process", () => ({
  execSync: (...args: unknown[]) => execSyncMock(...args),
  spawnSync: (...args: unknown[]) => spawnSyncMock(...args),
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => readFileMock(...args),
  mkdtemp: vi.fn(),
  rm: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: () => "/tmp/connect-agent-home",
  platform: () => process.platform,
  tmpdir: () => "/tmp",
}));

describe("connect-agent codex checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("returns notInstalled when the Codex binary is missing", async () => {
    spawnSyncMock.mockReturnValue({ stdout: "", status: 1 });

    const { connectCodexCli } = await import("../connect-agent");
    const result = await connectCodexCli();

    expect(result).toEqual({
      connected: false,
      models: [],
      notInstalled: true,
      error: "Codex CLI not found",
    });
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
  });

  it("reports failure when app-server exits during the startup probe", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ stdout: "/resolved/codex\n", status: 0 })
      .mockReturnValueOnce({ stdout: "codex-cli 0.116.0\n", status: 0 });

    spawnMock.mockImplementation(
      (binaryPath: string, _args: string[], options: { stdio?: string[] }) => {
        const child = new MockChildProcess();
        queueMicrotask(() => {
          child.stderr.emit("data", Buffer.from("startup boom"));
          child.exitCode = 1;
          child.emit("exit", 1);
        });
        expect(binaryPath).toBe("/resolved/codex");
        expect(options.stdio).toEqual(["pipe", "pipe", "pipe"]);
        return child;
      },
    );

    const { connectCodexCli } = await import("../connect-agent");
    const result = await connectCodexCli();

    expect(result.connected).toBe(false);
    expect(result.error).toContain("startup boom");
    expect(spawnSyncMock.mock.calls[1][0]).toBe("/resolved/codex");
    expect(spawnMock.mock.calls[0][0]).toBe("/resolved/codex");
  });

  it("uses the resolved binary path for version checks and a healthy startup probe", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ stdout: "/resolved/codex\n", status: 0 })
      .mockReturnValueOnce({ stdout: "codex-cli 0.116.0\n", status: 0 });
    readFileMock.mockResolvedValue(
      JSON.stringify({
        models: [
          {
            slug: "gpt-5.4",
            display_name: "GPT-5.4",
            description: "Test model",
            visibility: "list",
            priority: 1,
          },
        ],
      }),
    );

    spawnMock.mockImplementation(
      (binaryPath: string, _args: string[], options: { stdio?: string[] }) => {
        expect(binaryPath).toBe("/resolved/codex");
        expect(options.stdio).toEqual(["pipe", "pipe", "pipe"]);
        return new MockChildProcess();
      },
    );

    const { connectCodexCli } = await import("../connect-agent");
    const result = await connectCodexCli();

    expect(result).toEqual({
      connected: true,
      models: [
        {
          value: "gpt-5.4",
          displayName: "GPT-5.4",
          description: "Test model",
          provider: "openai",
        },
      ],
    });
    expect(spawnSyncMock.mock.calls[1][0]).toBe("/resolved/codex");
    expect(spawnMock.mock.calls[0][0]).toBe("/resolved/codex");
  });
});

function fakeResponse(init: {
  status: number;
  ok?: boolean;
  json?: () => Promise<unknown>;
}): Response {
  return {
    status: init.status,
    ok: init.ok ?? (init.status >= 200 && init.status < 300),
    json: init.json ?? (async () => ({})),
  } as unknown as Response;
}

describe("connect-agent custom provider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists models from the endpoint on success", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({
        status: 200,
        json: async () => ({
          data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini", name: "GPT-4o mini" }],
        }),
      }),
    );

    const { connectCustom } = await import("../connect-agent");
    const result = await connectCustom({
      baseURL: "https://api.example.com/v1/",
      apiKey: "sk-secret",
      modelIds: [],
    });

    expect(result.connected).toBe(true);
    expect(result.modelListSource).toBe("endpoint");
    expect(result.models).toEqual([
      {
        value: "gpt-4o",
        displayName: "gpt-4o",
        description: "",
        provider: "custom",
      },
      {
        value: "gpt-4o-mini",
        displayName: "GPT-4o mini",
        description: "",
        provider: "custom",
      },
    ]);
    // Bearer sent, trailing slash trimmed before /models.
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://api.example.com/v1/models");
    expect(
      (calledInit as { headers: Record<string, string> }).headers.Authorization,
    ).toBe("Bearer sk-secret");
  });

  it("falls back to manual model IDs when the endpoint 404s", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ status: 404, ok: false }));

    const { connectCustom } = await import("../connect-agent");
    const result = await connectCustom({
      baseURL: "https://api.example.com",
      apiKey: "",
      modelIds: ["deepseek-chat", " deepseek-reasoner "],
    });

    expect(result.connected).toBe(true);
    expect(result.modelListSource).toBe("manual");
    expect(result.models.map((m) => m.value)).toEqual([
      "deepseek-chat",
      "deepseek-reasoner",
    ]);
    // No key → no Authorization header.
    const [, calledInit] = fetchMock.mock.calls[0];
    expect(
      (calledInit as { headers: Record<string, string> }).headers.Authorization,
    ).toBeUndefined();
  });

  it("does not report connected from manual IDs when model listing returns 500", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ status: 500, ok: false }));

    const { connectCustom } = await import("../connect-agent");
    const result = await connectCustom({
      baseURL: "https://api.example.com",
      apiKey: "",
      modelIds: ["manual-model"],
    });

    expect(result.connected).toBe(false);
    expect(result.models).toEqual([]);
    expect(result.error).toMatch(/HTTP 500/);
  });

  it("reports an auth failure on 401 without falling back", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ status: 401, ok: false }));

    const { connectCustom } = await import("../connect-agent");
    const result = await connectCustom({
      baseURL: "https://api.example.com/v1",
      apiKey: "bad-key",
      modelIds: ["fallback-model"],
    });

    expect(result.connected).toBe(false);
    expect(result.models).toEqual([]);
    expect(result.error).toMatch(/authentication failed/i);
  });

  it("reports a timeout when the request aborts and no manual IDs exist", async () => {
    fetchMock.mockImplementation(async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    });

    const { connectCustom } = await import("../connect-agent");
    const result = await connectCustom({
      baseURL: "https://api.example.com/v1",
      apiKey: "sk-secret",
      modelIds: [],
    });

    expect(result.connected).toBe(false);
    expect(result.models).toEqual([]);
    expect(result.error).toMatch(/timed out/i);
  });

  it("returns an error without fetching when baseURL is missing", async () => {
    const { connectCustom } = await import("../connect-agent");
    const result = await connectCustom({
      baseURL: "",
      apiKey: "k",
      modelIds: ["m"],
    });

    expect(result.connected).toBe(false);
    expect(result.error).toMatch(/base url/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to manual IDs when /models returns an empty list", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({ status: 200, json: async () => ({ data: [] }) }),
    );

    const { connectCustom } = await import("../connect-agent");
    const result = await connectCustom({
      baseURL: "https://api.example.com/v1",
      apiKey: "k",
      modelIds: ["only-model"],
    });

    expect(result.connected).toBe(true);
    expect(result.modelListSource).toBe("manual");
    expect(result.models.map((m) => m.value)).toEqual(["only-model"]);
  });

  it("reports connect failure on an empty /models list with no manual IDs", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({ status: 200, json: async () => ({ data: [] }) }),
    );

    const { connectCustom } = await import("../connect-agent");
    const result = await connectCustom({
      baseURL: "https://api.example.com/v1",
      apiKey: "k",
      modelIds: [],
    });

    expect(result.connected).toBe(false);
    expect(result.models).toEqual([]);
    expect(result.error).toMatch(/no models/i);
  });
});
