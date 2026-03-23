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

    expect(source).toContain('http://127.0.0.1:${mcpServerPort}/mcp');
    expect(source).not.toContain('http://${mcpServerLocalIp}:${mcpHttpPort}/mcp');
    expect(source).toContain("callMcpInstall(");
    expect(source).toContain("mcpServerPort");
  });

  it("exposes analysis runtime controls in the existing dialog", () => {
    const source = readFileSync(dialogPath, "utf8");

    expect(source).toContain('t("agents.analysisRuntime")');
    expect(source).toContain("setAnalysisWebSearch");
    expect(source).toContain("setAnalysisEffortLevel");
    expect(source).toContain("setAnalysisPhaseMode");
    expect(source).toContain("toggleAnalysisPhase");
    expect(source).toContain("V3_PHASES.map");
    expect(source).not.toContain("analysis settings page");
  });
});
