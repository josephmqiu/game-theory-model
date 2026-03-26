/**
 * Typed interfaces for the Claude Agent SDK's loosely-typed message shapes.
 * These replace `as any` casts with runtime-checked narrowing.
 */

// ── SDK result message (yielded when message.type === "result") ──

export interface SdkResultMessage {
  type: "result";
  subtype?: string;
  is_error?: boolean;
  errors?: string[];
  result?: string;
  structured_output?: unknown;
}

export function narrowSdkResult(message: unknown): SdkResultMessage {
  const m = message as Record<string, unknown>;
  return {
    type: "result",
    subtype: typeof m.subtype === "string" ? m.subtype : undefined,
    is_error: typeof m.is_error === "boolean" ? m.is_error : undefined,
    errors: Array.isArray(m.errors) ? (m.errors as string[]) : undefined,
    result: typeof m.result === "string" ? m.result : undefined,
    structured_output: m.structured_output,
  };
}

// ── SDK content block (from stream_event content_block_start) ──

export interface SdkContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
  content?: Array<{ type: string; text?: string }>;
}

export function narrowContentBlock(block: unknown): SdkContentBlock {
  if (!block || typeof block !== "object") {
    return { type: "unknown" };
  }
  const b = block as Record<string, unknown>;
  return {
    type: typeof b.type === "string" ? b.type : "unknown",
    text: typeof b.text === "string" ? b.text : undefined,
    name: typeof b.name === "string" ? b.name : undefined,
    input: b.input,
    content: Array.isArray(b.content)
      ? (b.content as Array<{ type: string; text?: string }>)
      : undefined,
  };
}

// ── SDK stream message (yielded by query() iterable) ──

export interface SdkStreamMessage {
  type: string;
  subtype?: string;
  event?: Record<string, unknown> & {
    type?: string;
    content_block?: unknown;
    delta?: Record<string, unknown>;
    index?: number;
  };
}

// ── SDK assistant message content extraction ──

export function extractMessageContent(message: unknown): unknown[] | undefined {
  if (!message || typeof message !== "object") return undefined;
  const m = message as Record<string, unknown>;
  // Content may be at message.message.content (nested) or message.content (direct)
  const nested =
    m.message && typeof m.message === "object"
      ? (m.message as Record<string, unknown>).content
      : undefined;
  const content = nested ?? m.content;
  return Array.isArray(content) ? content : undefined;
}
