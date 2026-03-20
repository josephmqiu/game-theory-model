export const CHAT_PRODUCT_TOOL_NAMES = [
  "start_analysis",
  "get_analysis_status",
  "get_analysis_result",
  "revalidate_entities",
  "get_entities",
  "create_entity",
  "update_entity",
  "get_relationships",
  "create_relationship",
  "update_relationship",
  "layout_entities",
  "focus_entity",
  "group_entities",
] as const;

export const ANALYSIS_TOOL_NAMES = [
  "get_entity",
  "query_entities",
  "query_relationships",
  "request_loopback",
] as const;

export type ChatProductToolName = (typeof CHAT_PRODUCT_TOOL_NAMES)[number];
export type AnalysisToolName = (typeof ANALYSIS_TOOL_NAMES)[number];
