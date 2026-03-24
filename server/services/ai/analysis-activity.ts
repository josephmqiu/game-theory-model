export type AnalysisActivityKind = "note" | "tool" | "web-search";

export interface AnalysisActivitySignal {
  kind: AnalysisActivityKind;
  message: string;
  toolName?: string;
  query?: string;
}

export type AnalysisActivityCallback = (
  activity: AnalysisActivitySignal,
) => void;
