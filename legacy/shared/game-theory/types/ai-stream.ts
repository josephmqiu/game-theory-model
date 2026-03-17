export type AIStreamChunk =
  | { type: "text"; content: string }
  | { type: "thinking"; content: string }
  | { type: "ping"; content: string }
  | { type: "done"; content: string }
  | { type: "error"; content: string };
