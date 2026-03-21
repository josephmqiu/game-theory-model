import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn((filePath: string) =>
    filePath.endsWith(".pid") || filePath.endsWith(".port"),
  ),
  readFileSync: vi.fn((filePath: string) =>
    filePath.endsWith(".pid") ? "12345" : "3100",
  ),
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe("mcp-server-manager", () => {
  it("reports localhost for the MCP HTTP status", async () => {
    const killSpy = vi.spyOn(process, "kill").mockReturnValue(true as never);

    const { getMcpServerStatus } = await import("../mcp-server-manager");
    expect(getMcpServerStatus()).toEqual({
      running: true,
      port: 3100,
      localIp: "127.0.0.1",
    });

    killSpy.mockRestore();
  });
});
