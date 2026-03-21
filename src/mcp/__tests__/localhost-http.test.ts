import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const serverPath = join(process.cwd(), "src/mcp/server.ts");

describe("MCP HTTP localhost binding", () => {
  it("binds the standalone MCP HTTP server to localhost", () => {
    const source = readFileSync(serverPath, "utf8");

    expect(source).toContain('export const MCP_HTTP_HOST = "127.0.0.1"');
    expect(source).toContain("httpServer.listen(port, MCP_HTTP_HOST");
    expect(source).toContain("http://${MCP_HTTP_HOST}:${port}/mcp");
    expect(source).not.toContain('httpServer.listen(port, "0.0.0.0"');
    expect(source).not.toContain("http://0.0.0.0:${port}/mcp");
  });
});
