/**
 * config-loader.ts — Loads analysis type configuration from disk.
 *
 * Reads manifest.yaml, instruction files, and phase prompt files for a named
 * analysis type. Default: "game-theory" (bundled in this repo). Future: user-defined
 * types from ~/.gta/analysis-types/{name}/.
 *
 * This is plain TypeScript with fs.readFileSync — no Effect needed here.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";

// ── Types ──

export interface PhaseConfig {
  id: string;
  name: string;
  number: number;
  prompt: string; // relative path to prompt file
}

export interface AnalysisTypeManifest {
  name: string;
  version: string;
  description: string;
  phases: PhaseConfig[];
}

export interface AnalysisTypeConfig {
  manifest: AnalysisTypeManifest;
  instructions: {
    analysis: string;
    chat: string;
  };
  prompts: Map<string, string>; // phaseId -> raw prompt content
}

// ── Helpers ──

/** Read a file with a descriptive error message on failure. */
function readFileOrThrow(filePath: string, description: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(
        `Missing ${description}: ${filePath}. Ensure the analysis type config is complete.`,
      );
    }
    throw new Error(
      `Failed to read ${description} at ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Validate that parsed YAML has the expected manifest structure. */
function validateManifest(
  parsed: unknown,
  manifestPath: string,
): AnalysisTypeManifest {
  if (
    parsed == null ||
    typeof parsed !== "object" ||
    !("name" in parsed) ||
    !("phases" in parsed)
  ) {
    throw new Error(
      `Invalid manifest at ${manifestPath}: expected an object with "name" and "phases" fields.`,
    );
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj["name"] !== "string" || obj["name"].length === 0) {
    throw new Error(
      `Invalid manifest at ${manifestPath}: "name" must be a non-empty string.`,
    );
  }

  if (!Array.isArray(obj["phases"]) || obj["phases"].length === 0) {
    throw new Error(
      `Invalid manifest at ${manifestPath}: "phases" must be a non-empty array.`,
    );
  }

  for (let i = 0; i < obj["phases"].length; i++) {
    const phase = obj["phases"][i] as Record<string, unknown>;
    if (!phase || typeof phase !== "object") {
      throw new Error(
        `Invalid manifest at ${manifestPath}: phases[${i}] is not an object.`,
      );
    }
    if (typeof phase["id"] !== "string" || phase["id"].length === 0) {
      throw new Error(
        `Invalid manifest at ${manifestPath}: phases[${i}].id must be a non-empty string.`,
      );
    }
    if (typeof phase["prompt"] !== "string" || phase["prompt"].length === 0) {
      throw new Error(
        `Invalid manifest at ${manifestPath}: phases[${i}].prompt must be a non-empty string.`,
      );
    }
  }

  return parsed as AnalysisTypeManifest;
}

// ── Shared output rules (appended to every phase prompt) ──

const SHARED_OUTPUT_RULES = `
OUTPUT FORMAT — respond with a single JSON object, no markdown outside the code fence:
\`\`\`json
{
  "entities": [ ... ],
  "relationships": [ ... ]
}
\`\`\`

ENTITY RULES:
- For new entities, set "id" to null.
- Every entity needs a locally-unique "ref" (e.g. "fact-1", "player-eu").
- Include "confidence" ("high" | "medium" | "low") and "rationale" (one sentence justifying the entity).
- Do not include "source", "revision", "stale", or "position" fields.

RELATIONSHIP RULES:
- Each relationship needs a unique "id" (e.g. "rel-1").
- "fromEntityId" and "toEntityId" must reference entity refs in the same output.
- Use the most specific relationship type that applies.
- Some phases further restrict which relationship types are valid; follow the phase-specific rules when they are narrower than the shared list.
- Valid types: "supports", "contradicts", "depends-on", "informed-by", "derived-from",
  "plays-in", "has-objective", "has-strategy", "conflicts-with", "produces",
  "invalidated-by", "constrains", "escalates-to", "links", "precedes".

Do NOT include any commentary outside the JSON code fence.
`.trim();

// ── Resolution ──

/** Resolve the config directory for a given analysis type name. */
function resolveConfigDir(name: string): string {
  // First check user-defined config
  const homeDir = process.env["HOME"] ?? process.env["USERPROFILE"] ?? "";
  if (homeDir) {
    const userDir = path.join(homeDir, ".gta", "analysis-types", name);
    if (fs.existsSync(userDir)) {
      return userDir;
    }
  }

  // Fall back to bundled config
  const bundledDir = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "config",
    name,
  );
  if (fs.existsSync(bundledDir)) {
    return bundledDir;
  }

  throw new Error(
    `Analysis type "${name}" not found. Searched: ~/.gta/analysis-types/${name}/ and bundled config.`,
  );
}

// ── Loader ──

const configCache = new Map<string, AnalysisTypeConfig>();

/**
 * Load an analysis type configuration by name.
 * Caches the result — config files are read once per process.
 */
export function loadAnalysisType(
  name: string = "game-theory",
): AnalysisTypeConfig {
  const cached = configCache.get(name);
  if (cached) return cached;

  const configDir = resolveConfigDir(name);

  // Parse and validate manifest
  const manifestPath = path.join(configDir, "manifest.yaml");
  const manifestRaw = readFileOrThrow(manifestPath, "manifest file");
  let parsed: unknown;
  try {
    parsed = parseYaml(manifestRaw);
  } catch (err) {
    throw new Error(
      `Failed to parse YAML in ${manifestPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const manifest = validateManifest(parsed, manifestPath);

  // Read instruction files
  const analysisInstructions = readFileOrThrow(
    path.join(configDir, "instructions", "analysis.md"),
    "analysis instructions",
  );
  const chatInstructions = readFileOrThrow(
    path.join(configDir, "instructions", "chat.md"),
    "chat instructions",
  );

  // Read phase prompt files
  const prompts = new Map<string, string>();
  for (const phase of manifest.phases) {
    const promptPath = path.join(configDir, phase.prompt);
    const promptContent = readFileOrThrow(
      promptPath,
      `phase prompt for "${phase.id}" (${phase.prompt})`,
    );
    prompts.set(phase.id, promptContent);
  }

  const config: AnalysisTypeConfig = {
    manifest,
    instructions: {
      analysis: analysisInstructions,
      chat: chatInstructions,
    },
    prompts,
  };

  configCache.set(name, config);
  return config;
}

/**
 * Get the phase prompt for a given phase, with {{topic}} replaced and
 * shared output rules appended.
 */
export function getPhasePrompt(
  analysisType: AnalysisTypeConfig,
  phaseId: string,
  topic: string,
): string {
  const raw = analysisType.prompts.get(phaseId);
  if (!raw) {
    throw new Error(
      `Phase "${phaseId}" not found in analysis type "${analysisType.manifest.name}".`,
    );
  }

  const withTopic = raw.replace(/\{\{topic\}\}/g, topic);
  return `${withTopic}\n\n${SHARED_OUTPUT_RULES}`;
}

/**
 * Get the Layer 1 developer instructions for analysis or chat threads.
 */
export function getDeveloperInstructions(
  analysisType: AnalysisTypeConfig,
  mode: "analysis" | "chat",
): string {
  return mode === "analysis"
    ? analysisType.instructions.analysis
    : analysisType.instructions.chat;
}

/**
 * Clear the config cache (useful for tests or hot-reload).
 */
export function clearConfigCache(): void {
  configCache.clear();
}
