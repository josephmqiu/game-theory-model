import { beforeEach, describe, expect, it, vi } from "vitest";

const existsSyncMock = vi.fn((filePath: string) =>
  filePath.endsWith("mcp-stdio-proxy.cjs"),
);
const getMcpServerStatusMock = vi.fn(() => ({
  available: true,
  port: 3100,
}));

vi.mock("node:fs", () => ({
  existsSync: (filePath: string) => existsSyncMock(filePath),
}));

vi.mock("../../mcp/mcp-server", () => ({
  MCP_HTTP_HOST: "127.0.0.1",
  getMcpServerStatus: () => getMcpServerStatusMock(),
}));

describe("mcp-server-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports the in-process MCP status", async () => {
    const { getStatus } = await import("../mcp-server-manager");

    expect(getStatus()).toEqual({
      running: true,
      port: 3100,
      localIp: "127.0.0.1",
      available: true,
      mcpAvailable: true,
    });
  });

  it("resolves the stdio proxy script path", async () => {
    const { resolveMcpProxyScript } = await import("../mcp-server-manager");

    expect(resolveMcpProxyScript()).toContain("dist/mcp-stdio-proxy.cjs");
  });
});
