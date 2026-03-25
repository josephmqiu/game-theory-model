import type { Analysis, LayoutState } from "@/types/entity";
import type { Workspace, WorkspaceEnvelopeV4 } from "@/types/workspace";
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

const LEGACY_ANALYSIS_FILE_TYPE = "game-theory-analysis";
const LEGACY_ANALYSIS_FILE_VERSION = 3 as const;
const WORKSPACE_FILE_TYPE = "game-theory-workspace";
const WORKSPACE_FILE_VERSION = 4 as const;
const LEGACY_FILE_VERSION = 2;
const NON_PORTABLE_WORKSPACE_FIELDS = [
  "providerSessionBindings",
  "commandReceipts",
  "runtimeLogs",
  "logs",
] as const;

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

function assertLayoutShape(
  rawLayout: unknown,
): asserts rawLayout is LayoutState {
  if (!isRecord(rawLayout)) {
    throw new AnalysisFileError("layout must be an object.");
  }

  for (const [entityId, value] of Object.entries(rawLayout)) {
    if (!isRecord(value)) {
      throw new AnalysisFileError(`layout.${entityId} must be an object.`);
    }
    if (typeof value.x !== "number") {
      throw new AnalysisFileError(`layout.${entityId}.x must be a number.`);
    }
    if (typeof value.y !== "number") {
      throw new AnalysisFileError(`layout.${entityId}.y must be a number.`);
    }
    if (typeof value.pinned !== "boolean") {
      throw new AnalysisFileError(
        `layout.${entityId}.pinned must be a boolean.`,
      );
    }
  }
}

function assertNumber(
  value: unknown,
  fieldPath: string,
): asserts value is number {
  if (typeof value !== "number") {
    throw new AnalysisFileError(`${fieldPath} must be a number.`);
  }
}

function assertWorkspaceShape(
  rawWorkspace: unknown,
): asserts rawWorkspace is Workspace {
  if (!isRecord(rawWorkspace)) {
    throw new AnalysisFileError("workspace must be an object.");
  }

  for (const fieldName of NON_PORTABLE_WORKSPACE_FIELDS) {
    if (fieldName in rawWorkspace) {
      throw new AnalysisFileError(
        `workspace.${fieldName} is not portable and must not be stored in .gta files.`,
      );
    }
  }

  assertString(rawWorkspace.id, "workspace.id");
  assertString(rawWorkspace.name, "workspace.name");
  assertString(rawWorkspace.analysisType, "workspace.analysisType");
  if (rawWorkspace.analysisType !== "game-theory") {
    throw new AnalysisFileError(
      `workspace.analysisType must be "game-theory".`,
    );
  }
  assertNumber(rawWorkspace.createdAt, "workspace.createdAt");
  assertNumber(rawWorkspace.updatedAt, "workspace.updatedAt");
  assertAnalysisShape(rawWorkspace.analysis);
  assertLayoutShape(rawWorkspace.layout);
  assertArray(rawWorkspace.threads, "workspace.threads");
  assertArray(rawWorkspace.artifacts, "workspace.artifacts");
  assertArray(rawWorkspace.checkpointHeaders, "workspace.checkpointHeaders");
  assertArray(rawWorkspace.pendingQuestions, "workspace.pendingQuestions");
}

export interface WorkspaceFileMetadata {
  id?: string;
  name?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ParseWorkspaceFileResult {
  workspace: Workspace;
  analysis: Analysis;
  layout: LayoutState;
}

function createEmptyWorkspaceCollections(): Pick<
  Workspace,
  "threads" | "artifacts" | "checkpointHeaders" | "pendingQuestions"
> {
  return {
    threads: [],
    artifacts: [],
    checkpointHeaders: [],
    pendingQuestions: [],
  };
}

export function createWorkspaceFromAnalysis(
  analysis: Analysis,
  layout: LayoutState,
  metadata: WorkspaceFileMetadata = {},
): Workspace {
  const now = Date.now();
  return {
    id: metadata.id ?? analysis.id,
    name:
      metadata.name ||
      analysis.name.trim() ||
      analysis.topic.trim() ||
      "Untitled Workspace",
    analysisType: "game-theory",
    createdAt: metadata.createdAt ?? now,
    updatedAt: metadata.updatedAt ?? now,
    analysis,
    layout,
    ...createEmptyWorkspaceCollections(),
  };
}

// ── Serialize / Parse ──

export function serializeWorkspaceFile(workspace: Workspace): string {
  const portable = { ...workspace };
  for (const field of NON_PORTABLE_WORKSPACE_FIELDS) {
    delete (portable as Record<string, unknown>)[field];
  }

  const file: WorkspaceEnvelopeV4 = {
    type: WORKSPACE_FILE_TYPE,
    version: WORKSPACE_FILE_VERSION,
    workspace: portable,
  };
  return JSON.stringify(file, null, 2);
}

export function serializeAnalysisFile(
  analysis: Analysis,
  layout: LayoutState,
  metadata?: WorkspaceFileMetadata,
): string {
  return serializeWorkspaceFile(
    createWorkspaceFromAnalysis(analysis, layout, metadata),
  );
}

function parseLegacyAnalysisFile(
  raw: Record<string, unknown>,
): ParseWorkspaceFileResult {
  if (raw.type !== LEGACY_ANALYSIS_FILE_TYPE) {
    throw new AnalysisFileError(
      `Unsupported analysis file type: ${String(raw.type)}.`,
    );
  }

  if (raw.version === LEGACY_FILE_VERSION) {
    throw new AnalysisFileError(
      "This file uses an older format. Please create a new analysis.",
    );
  }

  if (raw.version !== LEGACY_ANALYSIS_FILE_VERSION) {
    throw new AnalysisFileError(
      `Unsupported analysis file version: ${String(raw.version)}.`,
    );
  }

  assertAnalysisShape(raw.analysis);
  assertLayoutShape(raw.layout);

  return {
    workspace: createWorkspaceFromAnalysis(raw.analysis, raw.layout),
    analysis: raw.analysis,
    layout: raw.layout,
  };
}

function parseWorkspaceEnvelope(
  raw: Record<string, unknown>,
): ParseWorkspaceFileResult {
  if (raw.type !== WORKSPACE_FILE_TYPE) {
    throw new AnalysisFileError(
      `Unsupported analysis file type: ${String(raw.type)}.`,
    );
  }

  if (raw.version !== WORKSPACE_FILE_VERSION) {
    throw new AnalysisFileError(
      `Unsupported analysis file version: ${String(raw.version)}.`,
    );
  }

  assertWorkspaceShape(raw.workspace);
  return {
    workspace: raw.workspace,
    analysis: raw.workspace.analysis,
    layout: raw.workspace.layout,
  };
}

export function parseWorkspaceFileText(text: string): ParseWorkspaceFileResult {
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    throw new AnalysisFileError("Analysis file is not valid JSON.");
  }

  if (!isRecord(raw)) {
    throw new AnalysisFileError("Analysis file must be a JSON object.");
  }

  const parsed =
    raw.type === WORKSPACE_FILE_TYPE
      ? parseWorkspaceEnvelope(raw)
      : parseLegacyAnalysisFile(raw);

  const validation = validateAnalysis(parsed.analysis);
  if (!validation.isValid) {
    const messages = validation.issues.map((i) => i.message).join("; ");
    throw new AnalysisFileError(`Invalid entity analysis: ${messages}`);
  }

  return parsed;
}

export function parseAnalysisFileText(text: string): {
  analysis: Analysis;
  layout: LayoutState;
} {
  const parsed = parseWorkspaceFileText(text);
  return {
    analysis: parsed.analysis,
    layout: parsed.layout,
  };
}

export function createDefaultAnalysisFileName(analysis: Analysis): string {
  const cleaned = analysis.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${cleaned || "untitled-analysis"}.gta`;
}
