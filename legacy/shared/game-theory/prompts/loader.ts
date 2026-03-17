import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const promptsDir = resolve(dirname(fileURLToPath(import.meta.url)));

export function loadSystemPrompt(): string {
  const filePath = resolve(promptsDir, "system.md");
  if (!existsSync(filePath)) {
    throw new Error(`System prompt not found at: ${filePath}`);
  }
  return readFileSync(filePath, "utf-8");
}

export function loadPhaseMethodology(phase: number): string {
  const filePath = resolve(promptsDir, "phases", `phase-${phase}.md`);
  if (!existsSync(filePath)) {
    return `Phase ${phase} methodology not available`;
  }
  return readFileSync(filePath, "utf-8");
}

export function loadToolDescription(toolName: string): string {
  const filePath = resolve(promptsDir, "tools", `${toolName}.md`);
  if (!existsSync(filePath)) {
    return `Tool: ${toolName}`;
  }
  return readFileSync(filePath, "utf-8");
}
