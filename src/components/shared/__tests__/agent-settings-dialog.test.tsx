// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dialogPath = join(
  process.cwd(),
  "src/components/shared/agent-settings-dialog.tsx",
);

describe("agent settings dialog MCP config", () => {
  it("keeps copied and displayed MCP HTTP config pinned to localhost", () => {
    const source = readFileSync(dialogPath, "utf8");

    expect(source).toContain('http://127.0.0.1:${mcpHttpPort}/mcp');
    expect(source).not.toContain('http://${mcpServerLocalIp}:${mcpHttpPort}/mcp');
  });
});
