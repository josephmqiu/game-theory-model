import type { AnalysisFileV2, Analysis } from "@/types/entity";
import { validateAnalysis } from "@/services/entity/entity-validation";

export class AnalysisFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisFileError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function assertString(
  value: unknown,
  fieldPath: string,
): asserts value is string {
  if (!isString(value)) {
    throw new AnalysisFileError(`${fieldPath} must be a string.`);
  }
}

function assertArray(
  value: unknown,
  fieldPath: string,
): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new AnalysisFileError(`${fieldPath} must be an array.`);
  }
}

// ── File format constants ──

const ANALYSIS_FILE_TYPE = "game-theory-analysis";
const ANALYSIS_FILE_VERSION = 2 as const;
const LEGACY_FILE_VERSION = 1;

// ── Shape validation ──

function assertAnalysisShape(
  rawAnalysis: unknown,
): asserts rawAnalysis is Analysis {
  if (!isRecord(rawAnalysis)) {
    throw new AnalysisFileError("Analysis payload must be an object.");
  }

  assertString(rawAnalysis.id, "analysis.id");
  assertString(rawAnalysis.name, "analysis.name");
  assertString(rawAnalysis.topic, "analysis.topic");
  assertArray(rawAnalysis.entities, "analysis.entities");
  assertArray(rawAnalysis.relationships, "analysis.relationships");
  assertArray(rawAnalysis.phases, "analysis.phases");
}

// ── Serialize / Parse ──

export function serializeAnalysisFile(analysis: Analysis): string {
  const file: AnalysisFileV2 = {
    type: ANALYSIS_FILE_TYPE,
    version: ANALYSIS_FILE_VERSION,
    analysis,
  };
  return JSON.stringify(file, null, 2);
}

export function parseAnalysisFileText(text: string): Analysis {
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    throw new AnalysisFileError("Analysis file is not valid JSON.");
  }

  if (!isRecord(raw)) {
    throw new AnalysisFileError("Analysis file must be a JSON object.");
  }

  if (raw.type !== ANALYSIS_FILE_TYPE) {
    throw new AnalysisFileError(
      `Unsupported analysis file type: ${String(raw.type)}.`,
    );
  }

  if (raw.version === LEGACY_FILE_VERSION) {
    throw new AnalysisFileError(
      "This file uses an older format. Please create a new analysis.",
    );
  }

  if (raw.version !== ANALYSIS_FILE_VERSION) {
    throw new AnalysisFileError(
      `Unsupported analysis file version: ${String(raw.version)}.`,
    );
  }

  assertAnalysisShape(raw.analysis);

  const validation = validateAnalysis(raw.analysis);
  if (!validation.isValid) {
    const messages = validation.issues.map((i) => i.message).join("; ");
    throw new AnalysisFileError(`Invalid entity analysis: ${messages}`);
  }

  return raw.analysis;
}

export function createDefaultAnalysisFileName(analysis: Analysis): string {
  const cleaned = analysis.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${cleaned || "untitled-analysis"}.gta`;
}
