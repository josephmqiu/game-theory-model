import type { RuntimeError } from "../../../shared/types/runtime-error";

export type RuntimeAdapterChatContentKind = "output" | "reasoning";

export interface RuntimeAdapterTextDeltaEvent {
  type: "text_delta";
  content: string;
  content_kind?: RuntimeAdapterChatContentKind;
}

export interface RuntimeAdapterToolCallStartEvent {
  type: "tool_call_start";
  toolName: string;
  input: unknown;
}

export interface RuntimeAdapterToolCallResultEvent {
  type: "tool_call_result";
  toolName: string;
  output: unknown;
}

export interface RuntimeAdapterToolCallErrorEvent {
  type: "tool_call_error";
  toolName: string;
  error: string;
}

export interface RuntimeAdapterTurnCompleteEvent {
  type: "turn_complete";
}

export interface RuntimeAdapterErrorEvent {
  type: "error";
  error: RuntimeError;
}

export type RuntimeAdapterChatEvent =
  | RuntimeAdapterTextDeltaEvent
  | RuntimeAdapterToolCallStartEvent
  | RuntimeAdapterToolCallResultEvent
  | RuntimeAdapterToolCallErrorEvent
  | RuntimeAdapterTurnCompleteEvent
  | RuntimeAdapterErrorEvent;

export function isRuntimeAdapterTerminalChatEvent(
  event: RuntimeAdapterChatEvent,
): boolean {
  return event.type === "turn_complete" || event.type === "error";
}
