export const CHAT_TOOL_NAMES = [
  "get_entity",
  "query_entities",
  "query_relationships",
  "request_loopback",
  "start_analysis",
  "get_analysis_status",
  "create_entity",
  "update_entity",
  "delete_entity",
  "create_relationship",
  "delete_relationship",
  "rerun_phases",
  "abort_analysis",
] as const;

export const ANALYSIS_TOOL_NAMES = [
  "get_entity",
  "query_entities",
  "query_relationships",
  "request_loopback",
] as const;

export type ChatToolName = (typeof CHAT_TOOL_NAMES)[number];
export type AnalysisToolName = (typeof ANALYSIS_TOOL_NAMES)[number];

export interface AnalysisToolPolicy {
  allowedTools: AnalysisToolName[];
  webSearch: boolean;
}

export const DEFAULT_ANALYSIS_TOOL_POLICY: AnalysisToolPolicy = {
  allowedTools: [...ANALYSIS_TOOL_NAMES],
  webSearch: true,
};

export function resolveAnalysisToolPolicy(
  policy?: Partial<AnalysisToolPolicy>,
): AnalysisToolPolicy {
  const allowedTools = Array.from(
    new Set(policy?.allowedTools ?? DEFAULT_ANALYSIS_TOOL_POLICY.allowedTools),
  ).filter((toolName): toolName is AnalysisToolName =>
    (ANALYSIS_TOOL_NAMES as readonly string[]).includes(toolName),
  );

  return {
    allowedTools:
      allowedTools.length > 0
        ? allowedTools
        : [...DEFAULT_ANALYSIS_TOOL_POLICY.allowedTools],
    webSearch: policy?.webSearch ?? DEFAULT_ANALYSIS_TOOL_POLICY.webSearch,
  };
}
