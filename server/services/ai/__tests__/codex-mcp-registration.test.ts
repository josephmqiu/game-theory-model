import { beforeEach, describe, expect, it, vi } from "vitest";

// execFile is promisified in the module under test — the mock must support
// promisify's custom symbol handling, which callback-style vi.fn does via
// util.promisify wrapping the callback signature.
const execFileMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: (
    ...args: [
      string,
      string[],
      Record<string, unknown>,
      (...cb: unknown[]) => void,
    ]
  ) => {
    const callback = args[args.length - 1] as (
      error: Error | null,
      result?: { stdout: string; stderr: string },
    ) => void;
    execFileMock(args[0], args[1])
      .then((result: { stdout: string; stderr: string }) =>
        callback(null, result),
      )
      .catch((error: Error) => callback(error));
  },
}));

const installMcpServerMock = vi.fn();
const uninstallMcpServerMock = vi.fn();
const isInstalledMock = vi.fn();

vi.mock("../codex-config", () => ({
  CODEX_MCP_SERVER_NAME: "game_theory_analyzer_mcp",
  installMcpServer: (...args: unknown[]) => installMcpServerMock(...args),
  uninstallMcpServer: (...args: unknown[]) => uninstallMcpServerMock(...args),
  isInstalled: (...args: unknown[]) => isInstalledMock(...args),
}));

vi.mock("../../../utils/mcp-server-manager", () => ({
  resolveMcpProxyScript: () => "/mock/dist/mcp-stdio-proxy.cjs",
}));

vi.mock("../../../utils/ai-logger", () => ({
  serverLog: vi.fn(),
  serverWarn: vi.fn(),
}));

function cliAvailable() {
  execFileMock.mockImplementation(async (_cmd: string, args: string[]) => {
    if (args[0] === "mcp" && args[1] === "--help") {
      return { stdout: "usage", stderr: "" };
    }
    return { stdout: "", stderr: "" };
  });
}

function cliUnavailable() {
  execFileMock.mockRejectedValue(new Error("unknown subcommand: mcp"));
}

describe("codex-mcp-registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isInstalledMock.mockReturnValue(false);
  });

  it("registers via `codex mcp add --url` when the CLI supports it", async () => {
    cliAvailable();
    const { registerCodexMcpServer } =
      await import("../codex-mcp-registration");

    const result = await registerCodexMcpServer("http://127.0.0.1:3100/mcp");

    expect(result).toEqual({ method: "cli" });
    const commands = execFileMock.mock.calls.map((call) => call[1]);
    expect(commands).toContainEqual([
      "mcp",
      "remove",
      "game_theory_analyzer_mcp",
    ]);
    expect(commands).toContainEqual([
      "mcp",
      "add",
      "game_theory_analyzer_mcp",
      "--url",
      "http://127.0.0.1:3100/mcp",
    ]);
    expect(installMcpServerMock).not.toHaveBeenCalled();
  });

  it("re-registration replaces the entry (remove precedes add)", async () => {
    cliAvailable();
    const { registerCodexMcpServer } =
      await import("../codex-mcp-registration");

    await registerCodexMcpServer("http://127.0.0.1:49152/mcp");

    const commands = execFileMock.mock.calls.map((call) => call[1]);
    const removeIndex = commands.findIndex((args) => args[1] === "remove");
    const addIndex = commands.findIndex((args) => args[1] === "add");
    expect(removeIndex).toBeGreaterThan(-1);
    expect(addIndex).toBeGreaterThan(removeIndex);
    expect(commands[addIndex]).toContain("http://127.0.0.1:49152/mcp");
  });

  it("falls back to a write-once config entry for old CLIs", async () => {
    cliUnavailable();
    const { registerCodexMcpServer } =
      await import("../codex-mcp-registration");

    const result = await registerCodexMcpServer("http://127.0.0.1:3100/mcp");

    expect(result).toEqual({ method: "config-file" });
    expect(installMcpServerMock).toHaveBeenCalledTimes(1);
    expect(installMcpServerMock).toHaveBeenCalledWith(expect.any(String), [
      "/mock/dist/mcp-stdio-proxy.cjs",
    ]);
  });

  it("fallback is write-once — never rewrites an existing entry", async () => {
    cliUnavailable();
    isInstalledMock.mockReturnValue(true);
    const { registerCodexMcpServer } =
      await import("../codex-mcp-registration");

    const result = await registerCodexMcpServer("http://127.0.0.1:3100/mcp");

    expect(result).toEqual({ method: "config-file" });
    expect(installMcpServerMock).not.toHaveBeenCalled();
  });

  it("unregisters via the CLI when available", async () => {
    cliAvailable();
    const { unregisterCodexMcpServer } =
      await import("../codex-mcp-registration");

    await unregisterCodexMcpServer();

    const commands = execFileMock.mock.calls.map((call) => call[1]);
    expect(commands).toContainEqual([
      "mcp",
      "remove",
      "game_theory_analyzer_mcp",
    ]);
    expect(uninstallMcpServerMock).not.toHaveBeenCalled();
  });

  it("unregisters via config file removal for old CLIs", async () => {
    cliUnavailable();
    const { unregisterCodexMcpServer } =
      await import("../codex-mcp-registration");

    await unregisterCodexMcpServer();

    expect(uninstallMcpServerMock).toHaveBeenCalledTimes(1);
  });
});
