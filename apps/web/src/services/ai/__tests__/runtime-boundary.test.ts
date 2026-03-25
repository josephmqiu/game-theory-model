import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

// Renderer directories — these run in the browser
const RENDERER_DIRS = [
  "src/components",
  "src/stores",
  "src/hooks",
  "src/routes",
];

// Specific renderer-side service files
const RENDERER_FILES = ["src/router.tsx", "src/services/ai/ai-service.ts"];

// Server-only modules — importing these from renderer code causes runtime crashes
const FORBIDDEN_PATTERNS = [
  "analysis-agent",
  "claude-adapter",
  "codex-adapter",
  "codex-config",
  "entity-graph-service",
  "revalidation-service",
  "canvas-service",
  "/server/agents/",
  "/server/services/",
  "/server/utils/",
  "@/mcp/",
  "mcp/server",
  "/server/",
  "node:child_process",
  "node:fs",
  "@anthropic-ai/claude-agent-sdk",
];

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (entry === "__tests__" || entry === "node_modules") continue;
      if (statSync(full).isDirectory()) results.push(...findTsFiles(full));
      else if (/\.(ts|tsx)$/.test(entry)) results.push(full);
    }
  } catch {
    /* dir doesn't exist */
  }
  return results;
}

describe("runtime boundary — renderer must not import server-only modules", () => {
  const rendererFiles = [
    ...RENDERER_DIRS.flatMap((d) => findTsFiles(resolve(d))),
    ...RENDERER_FILES.map((f) => resolve(f)),
  ];

  for (const file of rendererFiles) {
    it(`${file.replace(resolve(".") + "/", "")} has no server-only imports`, () => {
      const content = readFileSync(file, "utf-8");
      const importLines = content
        .split("\n")
        .filter(
          (line) =>
            (line.match(/^import\s/) && !line.includes("import type")) ||
            line.includes("import("),
        );
      for (const forbidden of FORBIDDEN_PATTERNS) {
        const violation = importLines.find((line) => line.includes(forbidden));
        expect(
          violation,
          `Renderer file imports server-only module "${forbidden}". ` +
            `This will crash in the browser. Use the transport layer instead.`,
        ).toBeUndefined();
      }
    });
  }
});
