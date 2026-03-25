// DEPRECATED: Being replaced by WebSocket transport in transport/
//
// Normalized event schema consumed by the chat panel.
// Both Claude and Codex adapters emit these; the UI never sees provider internals.

export type ChatEvent =
  | { type: "text_delta"; content: string }
  | { type: "tool_call_start"; toolName: string; input: unknown }
  | { type: "tool_call_result"; toolName: string; output: unknown }
  | { type: "tool_call_error"; toolName: string; error: string }
  | { type: "turn_complete" }
  | { type: "error"; message: string; recoverable: boolean };

const CHAT_EVENT_TYPES = new Set([
  "text_delta",
  "tool_call_start",
  "tool_call_result",
  "tool_call_error",
  "turn_complete",
  "error",
]);

export function isChatEvent(event: unknown): event is ChatEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "type" in event &&
    CHAT_EVENT_TYPES.has((event as { type: string }).type)
  );
}

export function isTerminalEvent(event: ChatEvent): boolean {
  return event.type === "turn_complete" || event.type === "error";
}
