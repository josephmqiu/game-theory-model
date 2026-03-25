import { describe, it, expect } from "vitest";
import type { ChatEvent } from "../chat-events";
import { isChatEvent, isTerminalEvent } from "../chat-events";
import { createTransportRuntimeError } from "../../../../shared/types/runtime-error";

describe("ChatEvent", () => {
  it("recognizes text_delta events", () => {
    const event: ChatEvent = { type: "text_delta", content: "hello" };
    expect(isChatEvent(event)).toBe(true);
    expect(isTerminalEvent(event)).toBe(false);
  });

  it("recognizes turn_complete as terminal", () => {
    const event: ChatEvent = { type: "turn_complete" };
    expect(isTerminalEvent(event)).toBe(true);
  });

  it("recognizes error as terminal", () => {
    const event: ChatEvent = {
      type: "error",
      error: createTransportRuntimeError("timeout", {
        provider: "claude",
        transport: "http",
        retryable: false,
      }),
    };
    expect(isTerminalEvent(event)).toBe(true);
  });

  it("recognizes tool_call events", () => {
    const start: ChatEvent = {
      type: "tool_call_start",
      toolName: "get_entities",
      input: {},
    };
    const result: ChatEvent = {
      type: "tool_call_result",
      toolName: "get_entities",
      output: [],
    };
    const error: ChatEvent = {
      type: "tool_call_error",
      toolName: "get_entities",
      error: "not found",
    };
    expect(isChatEvent(start)).toBe(true);
    expect(isChatEvent(result)).toBe(true);
    expect(isChatEvent(error)).toBe(true);
  });

  it("rejects non-ChatEvent objects", () => {
    expect(isChatEvent(null)).toBe(false);
    expect(isChatEvent(undefined)).toBe(false);
    expect(isChatEvent({})).toBe(false);
    expect(isChatEvent({ type: "unknown_type" })).toBe(false);
    expect(isChatEvent("string")).toBe(false);
  });
});
