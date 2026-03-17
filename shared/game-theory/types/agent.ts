import type { CanonicalStore } from "./canonical";
import type { Command } from "../engine/commands";
import type { DispatchResult } from "../engine/dispatch";
import type { AnalysisState } from "./analysis-pipeline";

// ── SSE event protocol ──

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "thinking"; content: string }
  | {
      type: "tool_call";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | { type: "tool_result"; id: string; result: unknown; duration_ms: number }
  | { type: "status"; analysis_status: AnalysisStatus }
  | { type: "compaction"; summary: string }
  | { type: "error"; content: string }
  | { type: "done"; content: string }
  | { type: "ping"; content: string };

// ── Analysis status (returned by get_analysis_status tool) ──

export interface PhaseProgress {
  phase: number;
  name: string;
  has_entities: boolean;
  entity_counts: Record<string, number>;
  coverage_warnings: string[];
}

export interface AnalysisStatus {
  has_analysis: boolean;
  description: string | null;
  phases: PhaseProgress[];
  total_entities: number;
  solver_ready_formalizations: string[];
  warnings: string[];
}

// ── Derived state (minimal shape for tool context) ──

export interface DerivedState {
  readinessReportsByFormalization: Record<string, unknown>;
  solverResultsByFormalization: Record<string, unknown>;
  sensitivityByFormalizationAndSolver: Record<string, unknown>;
  dirtyFormalizations: Record<string, boolean>;
}

// ── Tool system ──

export type ToolResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

export interface ToolContext {
  canonical: CanonicalStore;
  dispatch: (command: Command) => DispatchResult;
  getAnalysisState: () => AnalysisState | null;
  getDerivedState: () => DerivedState;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (
    input: Record<string, unknown>,
    context: ToolContext,
  ) => Promise<ToolResult>;
}

// ── Normalized message format ──

export interface NormalizedContentBlock {
  type: "text" | "tool_use" | "tool_result" | "thinking";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface NormalizedMessage {
  role: "user" | "assistant" | "tool_result";
  content: string | NormalizedContentBlock[];
}

export interface NormalizedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// ── Context management ──

export interface ContextManagementConfig {
  enabled: boolean;
}

// ── Provider adapter ──

export interface ProviderCapabilities {
  toolUse: boolean;
  webSearch: boolean;
  compaction: boolean;
}

export interface FormatRequestParams {
  system: string;
  messages: NormalizedMessage[];
  tools: ToolDefinition[];
  contextManagement?: ContextManagementConfig;
  enableWebSearch?: boolean;
}

export interface ProviderAdapter {
  name: string;
  capabilities: ProviderCapabilities;
  formatRequest: (params: FormatRequestParams) => Record<string, unknown>;
  parseStreamChunk: (chunk: unknown) => AgentEvent[];
  formatToolResult: (
    toolUseId: string,
    result: ToolResult,
  ) => NormalizedMessage;
}

// ── Agent loop configuration ──

export interface AgentLoopConfig {
  maxIterations: number;
  inactivityTimeoutMs: number;
  enableWebSearch: boolean;
}

export const DEFAULT_AGENT_LOOP_CONFIG: AgentLoopConfig = {
  maxIterations: 100,
  inactivityTimeoutMs: 60_000,
  enableWebSearch: true,
};
