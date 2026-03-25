import { beforeEach, describe, expect, it, vi } from "vitest";
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

    spawnMock.mockImplementation((binaryPath: string, _args: string[], options: { stdio?: string[] }) => {
      const child = new MockChildProcess();
      queueMicrotask(() => {
        child.stderr.emit("data", Buffer.from("startup boom"));
        child.exitCode = 1;
        child.emit("exit", 1);
      });
      expect(binaryPath).toBe("/resolved/codex");
      expect(options.stdio).toEqual(["pipe", "pipe", "pipe"]);
      return child;
    });

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

    spawnMock.mockImplementation((binaryPath: string, _args: string[], options: { stdio?: string[] }) => {
      expect(binaryPath).toBe("/resolved/codex");
      expect(options.stdio).toEqual(["pipe", "pipe", "pipe"]);
      return new MockChildProcess();
    });

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
