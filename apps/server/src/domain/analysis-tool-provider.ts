/**
 * Analysis tool provider — bridges MCP tool definitions to T3's provider
 * adapter system.
 *
 * This module provides a tool registry that can be consumed by the Claude
 * adapter's `canUseTool` callback or by MCP server registration. It does
 * NOT modify the adapter itself — it provides the tool definitions and a
 * call handler that routes to the domain services.
 *
 * Usage:
 *   - In analysis mode: call `createToolProvider("analysis", runId)`
 *   - In chat mode: call `createToolProvider("chat")`
 *
 * The returned provider exposes:
 *   - `tools` — tool definitions for registration with the AI
 *   - `isAllowed(name)` — whether a tool name is permitted in this mode
 *   - `callTool(name, args)` — execute a tool and return the result
 *
 * @module analysis-tool-provider
 */
import {
  getToolDefinitions,
  isToolAllowed,
  handleToolCall,
  type ToolDefinition,
  type ToolMode,
} from "./mcp-tools";

// ── Tool Provider Interface ──

export interface AnalysisToolProvider {
  /** All tool definitions available in this mode. */
  readonly tools: readonly ToolDefinition[];

  /** The mode this provider was created for. */
  readonly mode: ToolMode;

  /** Check if a tool name is allowed in this mode. */
  readonly isAllowed: (name: string) => boolean;

  /**
   * Execute a tool call and return the result.
   * Returns { text, isError } for MCP/SDK compatibility.
   */
  readonly callTool: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ text: string; isError: boolean }>;
}

// ── Factory ──

/**
 * Create a tool provider bound to a specific mode and optional run context.
 *
 * @param mode - "analysis" or "chat"
 * @param runId - Optional analysis run ID for provenance tracking
 */
export function createToolProvider(
  mode: ToolMode,
  runId?: string,
): AnalysisToolProvider {
  const tools = getToolDefinitions(mode);

  return {
    tools,
    mode,
    isAllowed: (name: string) => isToolAllowed(name, mode),
    callTool: (name: string, args?: Record<string, unknown>) => {
      // Enforce mode-level access control
      if (!isToolAllowed(name, mode)) {
        return Promise.resolve({
          text: JSON.stringify({
            error: `Tool "${name}" is not available in ${mode} mode.`,
          }),
          isError: true,
        });
      }

      const context: { runId?: string } = {};
      if (runId !== undefined) context.runId = runId;
      return handleToolCall(name, args, context);
    },
  };
}

// ── Claude Adapter Integration Helpers ──

/**
 * Build the `canUseTool` callback compatible with the Claude Agent SDK.
 *
 * The Claude adapter calls `canUseTool(toolName)` before presenting a tool
 * to the AI. This function returns a predicate that filters tools by mode.
 */
export function buildCanUseToolFilter(
  mode: ToolMode,
): (toolName: string) => boolean {
  return (toolName: string) => isToolAllowed(toolName, mode);
}

/**
 * Convert tool definitions to the format expected by Claude Agent SDK's
 * tool registration. The SDK expects { name, description, input_schema }.
 */
export function toClaudeToolFormat(tools: readonly ToolDefinition[]): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}
