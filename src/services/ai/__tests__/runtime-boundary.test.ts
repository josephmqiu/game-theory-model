import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

// Renderer directories — these run in the browser
const RENDERER_DIRS = ["src/components", "src/stores", "src/hooks"];

// Specific renderer-side service files
const RENDERER_FILES = ["src/services/ai/analysis-client.ts"];

// Server-only modules — importing these from renderer code causes runtime crashes
const FORBIDDEN_MODULES = [
  "analysis-orchestrator",
  "analysis-service",
  "claude-adapter",
  "codex-adapter",
  "codex-config",
  "entity-graph-service",
  "revalidation-service",
  "canvas-service",
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
      // Find non-type imports only (type imports are erased at compile time)
      const importLines = content
        .split("\n")
        .filter((l) => l.match(/^import\s/) && !l.includes("import type"));
      for (const forbidden of FORBIDDEN_MODULES) {
        const violation = importLines.find((l) => l.includes(forbidden));
        expect(
          violation,
          `Renderer file imports server-only module "${forbidden}". ` +
            `This will crash in the browser. Use analysis-client instead.`,
        ).toBeUndefined();
      }
    });
  }
});
