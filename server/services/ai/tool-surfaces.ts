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
  "web_search",
] as const;

export const ANALYSIS_TOOL_NAMES = [
  "get_entity",
  "query_entities",
  "query_relationships",
  "request_loopback",
  "web_search",
] as const;

export type ChatToolName = (typeof CHAT_TOOL_NAMES)[number];
export type AnalysisToolName = (typeof ANALYSIS_TOOL_NAMES)[number];
