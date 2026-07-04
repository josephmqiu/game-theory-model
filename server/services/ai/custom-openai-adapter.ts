// Custom OpenAI-compatible adapter — the ONLY file that imports the `openai` SDK.
//
// Powers the BYOK "custom" provider: any endpoint that speaks the OpenAI
// Chat Completions API (OpenRouter, Together, vLLM, LM Studio, a local proxy…).
// Provides two profiles:
//   - streamChat: interactive, streaming, with the product tool loop
//   - runAnalysisPhase: structured single-phase analysis (non-streaming)
//
// Credentials (baseURL/apiKey/hasNativeWebSearch) are passed per-call — the
// renderer re-reads them from secret storage on every request and never caches
// them server-side (the Nitro server restarts on crash).

import OpenAI, { APIError } from "openai";
import type { ChatEvent } from "../../../shared/types/events";
import {
  CHAT_MODE_TOOL_DEFINITIONS,
  ANALYSIS_MODE_TOOL_DEFINITIONS,
  handleToolCall,
  type ToolDefinition,
  type ToolCallContext,
} from "../../mcp/product-tools";
import { isSearchConfigured } from "../search/config-cache";
import { serverLog, serverWarn } from "../../utils/ai-logger";

// ── Credentials + IO types ──

/** BYOK connection details for the custom OpenAI-compatible endpoint. */
export interface CustomProviderCredentials {
  baseURL: string;
  apiKey: string;
  hasNativeWebSearch: boolean;
}

/** Full input for a custom chat turn — carries the WHOLE multi-turn history. */
export interface CustomChatInput extends CustomProviderCredentials {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  model: string;
}

export interface CustomChatOptions {
  runId?: string;
  signal?: AbortSignal;
}

/** Analysis options carry the creds alongside the standard analysis knobs. */
export interface CustomAnalysisOptions extends CustomProviderCredentials {
  runId?: string;
  signal?: AbortSignal;
  webSearch?: boolean;
}

// ── Constants ──

/** Max assistant⇄tool round-trips before we force the turn to end. */
const MAX_TOOL_ROUNDS = 8;
/**
 * When the serialized chat history exceeds this many characters, the oldest
 * overflow turns are compacted into a single summary message (or mechanically
 * trimmed if the summarize call fails).
 */
const HISTORY_CHAR_BUDGET = 120_000;
/**
 * Per-tool-result content cap. A single tool result (e.g. a large
 * query_entities dump) is truncated to this many characters before being
 * appended to the message history, so one call can't blow the context window.
 */
const TOOL_RESULT_CHAR_CAP = 30_000;

const PLACEHOLDER_API_KEY = "sk-no-key";

// Mirror of chat.ts SENSITIVE_LOG_PATTERN — never surface keys/Authorization
// headers in error text forwarded to the client or the logs.
const SENSITIVE_LOG_PATTERN =
  /ANTHROPIC_API_KEY=|Authorization:\s*Bearer|api[_-]?key\s*[:=]/i;

/** Appended to every custom chat system prompt (canvas is the source of truth). */
const CANVAS_AUTHORITATIVE_NOTE =
  "The canvas (analysis graph) is the authoritative state and is fully re-discoverable at any time via the query_entities and get_entity tools. If earlier conversation was summarized or trimmed, re-query the canvas rather than trusting the transcript.";

// ── Client + tool helpers ──

function createClient(creds: CustomProviderCredentials): OpenAI {
  return new OpenAI({
    baseURL: creds.baseURL,
    // Some local/self-hosted endpoints require no key. The SDK refuses to
    // construct without a non-empty apiKey, so we pass a harmless placeholder;
    // such endpoints ignore the Authorization header.
    apiKey: creds.apiKey || PLACEHOLDER_API_KEY,
    // Our own AbortSignal owns timeouts/cancellation — do not let the SDK add
    // its own retry/backoff on top of that.
    maxRetries: 0,
  });
}

/**
 * web_search is excluded from the exposed tool list when the endpoint has its
 * own native web search OR when no search provider is configured (calling it
 * would only ever return the "not configured" error).
 */
function shouldExcludeWebSearch(
  hasNativeWebSearch: boolean,
  webSearchEnabled = true,
): boolean {
  return hasNativeWebSearch || !webSearchEnabled || !isSearchConfigured();
}

function toOpenAITools(
  defs: readonly ToolDefinition[],
  excludeWebSearch: boolean,
): OpenAI.ChatCompletionTool[] {
  return defs
    .filter((d) => !(excludeWebSearch && d.name === "web_search"))
    .map((d) => ({
      type: "function" as const,
      function: {
        name: d.name,
        description: d.description,
        parameters: d.inputSchema,
      },
    }));
}

function buildChatSystemPrompt(system: string): string {
  return `${system}\n\n${CANVAS_AUTHORITATIVE_NOTE}`;
}

// ── Error helpers ──

interface ExtractedError {
  status?: number;
  message: string;
}

function extractError(err: unknown): ExtractedError {
  if (err instanceof APIError) {
    const status = typeof err.status === "number" ? err.status : undefined;
    const raw = err.message || String(err);
    return { status, message: redact(raw).slice(0, 300) };
  }
  const raw = err instanceof Error ? err.message : String(err);
  return { message: redact(raw).slice(0, 300) };
}

function redact(text: string): string {
  return SENSITIVE_LOG_PATTERN.test(text)
    ? text.replace(SENSITIVE_LOG_PATTERN, "[redacted]")
    : text;
}

/** A first-request 400 that names tool/function fields — endpoint lacks tools. */
function isToolRejection(err: unknown): boolean {
  const { status, message } = extractError(err);
  return status === 400 && /tool|function|tool_choice/i.test(message);
}

/** A 400 that names response_format/schema — endpoint lacks structured output. */
function isResponseFormatRejection(err: unknown): boolean {
  const { status, message } = extractError(err);
  return status === 400 && /response_format|json.?schema|schema/i.test(message);
}

// ── JSON parsing (mirrors analysis-service trimJsonLike) ──

const JSON_FENCE_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i;

function parseJsonLoose<T>(text: string): T {
  const fenced = text.match(JSON_FENCE_PATTERN);
  const candidate = (fenced?.[1] ?? text).trim();
  return JSON.parse(candidate) as T;
}

// ── History compaction ──

function messageChars(m: { content: string }): number {
  return m.content.length;
}

function serializedLength(msgs: Array<{ content: string }>): number {
  return msgs.reduce((n, m) => n + messageChars(m), 0);
}

/**
 * Split history into { evicted (oldest overflow), kept (most recent within
 * budget) }. Always keeps at least the newest turn.
 */
function splitHistoryForCompaction(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): {
  evicted: Array<{ role: "user" | "assistant"; content: string }>;
  kept: Array<{ role: "user" | "assistant"; content: string }>;
} {
  if (serializedLength(history) <= HISTORY_CHAR_BUDGET) {
    return { evicted: [], kept: history };
  }
  const kept: Array<{ role: "user" | "assistant"; content: string }> = [];
  let acc = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const len = messageChars(history[i]);
    if (kept.length > 0 && acc + len > HISTORY_CHAR_BUDGET) {
      return { evicted: history.slice(0, i + 1), kept };
    }
    acc += len;
    kept.unshift(history[i]);
  }
  return { evicted: [], kept };
}

async function summarizeEvicted(
  client: OpenAI,
  model: string,
  evicted: Array<{ role: "user" | "assistant"; content: string }>,
  signal?: AbortSignal,
): Promise<string> {
  const transcript = evicted.map((m) => `${m.role}: ${m.content}`).join("\n\n");
  const completion = await client.chat.completions.create(
    {
      model,
      messages: [
        {
          role: "system",
          content:
            "You compress conversation history into a compact factual summary. Preserve the user's goals, decisions, constraints, and any commitments made. Do not add commentary.",
        },
        {
          role: "user",
          content: `Summarize the following earlier conversation into a factual summary:\n\n${transcript}`,
        },
      ],
    },
    { signal },
  );
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * Build the OpenAI message array for a chat turn: system prompt + (possibly
 * compacted) history. Emits a serverLog for whichever compaction path ran.
 */
async function buildChatMessages(
  client: OpenAI,
  input: CustomChatInput,
  options?: CustomChatOptions,
): Promise<OpenAI.ChatCompletionMessageParam[]> {
  const system: OpenAI.ChatCompletionMessageParam = {
    role: "system",
    content: buildChatSystemPrompt(input.system),
  };

  const { evicted, kept } = splitHistoryForCompaction(input.messages);
  if (evicted.length === 0) {
    return [system, ...input.messages];
  }

  try {
    const summary = await summarizeEvicted(
      client,
      input.model,
      evicted,
      options?.signal,
    );
    if (!summary) {
      throw new Error("Empty summary");
    }
    serverLog(options?.runId, "custom-adapter", "history-compacted", {
      evictedTurns: evicted.length,
      keptTurns: kept.length,
      mode: "summary",
    });
    return [
      system,
      { role: "user", content: `[Conversation summary]\n${summary}` },
      ...kept,
    ];
  } catch (err) {
    serverWarn(
      options?.runId,
      "custom-adapter",
      "history-compaction-fallback",
      {
        evictedTurns: evicted.length,
        keptTurns: kept.length,
        mode: "mechanical-trim",
        error: extractError(err).message,
      },
    );
    return [
      system,
      { role: "user", content: "[Earlier conversation trimmed]" },
      ...kept,
    ];
  }
}

// ── Tool-call accumulation (streaming deltas arrive fragmented) ──

interface AccumulatedToolCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
}

function accumulateToolCallDelta(
  acc: Map<number, AccumulatedToolCall>,
  delta: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall,
): void {
  const index = delta.index;
  const existing = acc.get(index) ?? {
    index,
    id: "",
    name: "",
    arguments: "",
  };
  if (delta.id) existing.id = delta.id;
  if (delta.function?.name) existing.name += delta.function.name;
  if (delta.function?.arguments) {
    existing.arguments += delta.function.arguments;
  }
  acc.set(index, existing);
}

function toAssistantToolCalls(
  calls: AccumulatedToolCall[],
): OpenAI.ChatCompletionMessageToolCall[] {
  return calls.map((c) => ({
    id: c.id,
    type: "function" as const,
    function: { name: c.name, arguments: c.arguments },
  }));
}

// ── Mid-turn context control ──

/** Truncate a tool result before it enters the message history. */
function capToolResult(text: string): string {
  if (text.length <= TOOL_RESULT_CHAR_CAP) return text;
  const dropped = text.length - TOOL_RESULT_CHAR_CAP;
  return `${text.slice(0, TOOL_RESULT_CHAR_CAP)}\n[truncated ${dropped} chars]`;
}

function serializedMessagesLength(
  messages: OpenAI.ChatCompletionMessageParam[],
): number {
  return messages.reduce(
    (n, m) => n + (typeof m.content === "string" ? m.content.length : 0),
    0,
  );
}

/** Indices of assistant messages that carry tool_calls (one per completed round). */
function toolGroupStarts(
  messages: OpenAI.ChatCompletionMessageParam[],
): number[] {
  const starts: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (
      m.role === "assistant" &&
      Array.isArray(m.tool_calls) &&
      m.tool_calls.length > 0
    ) {
      starts.push(i);
    }
  }
  return starts;
}

/**
 * Keep the running message array under budget MID-TURN by mechanically dropping
 * the OLDEST complete (assistant tool_calls + its tool responses) groups — never
 * partially, so no tool_call_id is ever orphaned, and never the most recent
 * group (the model still needs the current round). No LLM summarize call is made
 * inside the loop (no recursion). The system message + preamble are preserved.
 */
function enforceMidTurnBudget(
  messages: OpenAI.ChatCompletionMessageParam[],
  runId: string | undefined,
  sub: string,
): void {
  if (serializedMessagesLength(messages) <= HISTORY_CHAR_BUDGET) return;

  let dropped = 0;
  while (serializedMessagesLength(messages) > HISTORY_CHAR_BUDGET) {
    const starts = toolGroupStarts(messages);
    if (starts.length <= 1) break; // always keep the current round intact
    const start = starts[0];
    let end = start + 1;
    while (end < messages.length && messages[end].role === "tool") end++;
    messages.splice(start, end - start);
    dropped++;
  }

  if (dropped > 0) {
    serverWarn(runId, sub, "mid-turn-trim", {
      droppedGroups: dropped,
      remainingMessages: messages.length,
    });
  }
}

// ── Chat profile ──

/**
 * Stream a chat turn against a custom OpenAI-compatible endpoint, running the
 * product tool loop. Yields normalized ChatEvent objects (the chat route wraps
 * these into SSE). Reads the FULL multi-turn history from input.messages.
 */
export async function* streamChat(
  input: CustomChatInput,
  options?: CustomChatOptions,
): AsyncGenerator<ChatEvent> {
  const client = createClient(input);
  const excludeWebSearch = shouldExcludeWebSearch(input.hasNativeWebSearch);
  const tools = toOpenAITools(CHAT_MODE_TOOL_DEFINITIONS, excludeWebSearch);
  const toolCtx: ToolCallContext = {
    customCredentials: {
      baseURL: input.baseURL,
      apiKey: input.apiKey,
      hasNativeWebSearch: input.hasNativeWebSearch,
    },
  };

  const messages = await buildChatMessages(client, input, options);

  // Degraded mode: an endpoint that 400s on the tool definitions gets one
  // retry with no tools + a one-line warning prepended to its reply.
  let toolsDisabled = false;

  for (let round = 1; round <= MAX_TOOL_ROUNDS; round++) {
    const roundStart = Date.now();

    let openaiStream: AsyncIterable<OpenAI.ChatCompletionChunk>;
    try {
      openaiStream = await client.chat.completions.create(
        {
          model: input.model,
          messages,
          stream: true,
          ...(tools.length > 0 && !toolsDisabled
            ? { tools, tool_choice: "auto" as const }
            : {}),
        },
        { signal: options?.signal },
      );
    } catch (err) {
      if (options?.signal?.aborted) return;
      if (round === 1 && !toolsDisabled && isToolRejection(err)) {
        toolsDisabled = true;
        serverWarn(options?.runId, "custom-adapter", "tools-rejected", {
          model: input.model,
        });
        yield {
          type: "text_delta",
          content:
            "(This endpoint rejected tool definitions — canvas tools are disabled for this reply.)\n",
        };
        round--; // retry this round without tools
        continue;
      }
      const { status, message } = extractError(err);
      yield {
        type: "error",
        message: status ? `HTTP ${status}: ${message}` : message,
        recoverable: false,
      };
      return;
    }

    const toolCalls = new Map<number, AccumulatedToolCall>();
    let assistantText = "";
    let finishReason: string | null = null;

    try {
      for await (const chunk of openaiStream) {
        if (options?.signal?.aborted) return;
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta;
        if (delta?.content) {
          assistantText += delta.content;
          yield { type: "text_delta", content: delta.content };
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            accumulateToolCallDelta(toolCalls, tc);
          }
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
      }
    } catch (err) {
      if (options?.signal?.aborted) return;
      const { status, message } = extractError(err);
      yield {
        type: "error",
        message: status ? `HTTP ${status}: ${message}` : message,
        recoverable: false,
      };
      return;
    }

    serverLog(options?.runId, "custom-adapter", "chat-round", {
      model: input.model,
      round,
      toolCallCount: toolCalls.size,
      latencyMs: Date.now() - roundStart,
      finishReason,
    });

    if (finishReason === "tool_calls" && toolCalls.size > 0) {
      const calls = [...toolCalls.values()].sort((a, b) => a.index - b.index);
      messages.push({
        role: "assistant",
        content: assistantText.length > 0 ? assistantText : null,
        tool_calls: toAssistantToolCalls(calls),
      });

      for (const call of calls) {
        let args: Record<string, unknown>;
        try {
          args = call.arguments.trim()
            ? (JSON.parse(call.arguments) as Record<string, unknown>)
            : {};
        } catch {
          // Malformed args: report, feed the error back as the tool result so
          // the model can recover, and keep the loop going.
          yield {
            type: "tool_call_error",
            toolName: call.name,
            error: "Tool arguments were not valid JSON.",
          };
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content:
              "Error: the tool arguments you provided were not valid JSON. Retry the call with a valid JSON arguments object.",
          });
          continue;
        }

        yield { type: "tool_call_start", toolName: call.name, input: args };
        const result = await handleToolCall(call.name, args, toolCtx);
        if (result.isError) {
          yield {
            type: "tool_call_error",
            toolName: call.name,
            error: result.text,
          };
        } else {
          yield {
            type: "tool_call_result",
            toolName: call.name,
            output: result.text,
          };
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: capToolResult(result.text),
        });
      }
      // Tool results appended this round can grow the context past budget —
      // trim mechanically before the next request (no LLM summarize mid-turn).
      enforceMidTurnBudget(messages, options?.runId, "custom-adapter");
      continue; // re-enter the loop for the model's follow-up
    }

    // finish_reason "stop" (or any non-tool terminal): the turn is done.
    yield { type: "turn_complete" };
    return;
  }

  // Exhausted the tool-round budget without a terminal response.
  serverWarn(options?.runId, "custom-adapter", "max-tool-rounds", {
    model: input.model,
    maxRounds: MAX_TOOL_ROUNDS,
  });
  yield {
    type: "text_delta",
    content:
      "\n(Reached the maximum number of tool-use rounds for this reply. Ask a follow-up to continue.)",
  };
  yield { type: "turn_complete" };
}

// ── Plain generation profile ──

export interface CustomGenerateInput extends CustomProviderCredentials {
  system: string;
  message: string;
  model: string;
}

/**
 * Single non-streaming completion, no tools — used by the /generate route for
 * design/code generation against a custom endpoint.
 */
export async function generateText(
  input: CustomGenerateInput,
  options?: { runId?: string; signal?: AbortSignal },
): Promise<string> {
  const client = createClient(input);
  const start = Date.now();
  try {
    const completion = await client.chat.completions.create(
      {
        model: input.model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.message },
        ],
      },
      { signal: options?.signal },
    );
    serverLog(options?.runId, "custom-adapter", "generate", {
      model: input.model,
      latencyMs: Date.now() - start,
    });
    return completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    const { status, message } = extractError(err);
    throw new Error(
      status
        ? `Custom generation failed (HTTP ${status}): ${message}`
        : message,
    );
  }
}

// ── Analysis profile ──

/**
 * Run a single analysis phase against a custom endpoint with structured JSON
 * output. Tries native json_schema response_format first; on a 400 that
 * rejects it, retries with the schema embedded in the prompt and parses the
 * final message. Runs the same product tool loop (read-only analysis tools).
 */
export async function runAnalysisPhase<T = unknown>(
  prompt: string,
  systemPrompt: string,
  model: string,
  schema: Record<string, unknown>,
  options: CustomAnalysisOptions,
): Promise<T> {
  const client = createClient(options);
  const excludeWebSearch = shouldExcludeWebSearch(
    options.hasNativeWebSearch,
    options.webSearch !== false,
  );
  const tools = toOpenAITools(ANALYSIS_MODE_TOOL_DEFINITIONS, excludeWebSearch);
  const toolCtx: ToolCallContext = {
    customCredentials: {
      baseURL: options.baseURL,
      apiKey: options.apiKey,
      hasNativeWebSearch: options.hasNativeWebSearch,
    },
  };

  const baseMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  // Attempt 1: native structured output.
  try {
    const text = await runAnalysisLoop(
      client,
      model,
      [...baseMessages],
      tools,
      toolCtx,
      {
        response_format: {
          type: "json_schema",
          json_schema: { name: "analysis", schema, strict: false },
        },
      },
      options,
    );
    return parseJsonLoose<T>(text);
  } catch (err) {
    if (!isResponseFormatRejection(err)) {
      // A JSON parse failure or any non-format error: surface a clear message.
      if (err instanceof SyntaxError) {
        throw new Error(
          `Custom analysis returned unparseable JSON: ${err.message}`,
        );
      }
      const { status, message } = extractError(err);
      throw new Error(
        status
          ? `Custom analysis failed (HTTP ${status}): ${message}`
          : `Custom analysis failed: ${message}`,
      );
    }
    serverWarn(options.runId, "custom-adapter", "response-format-rejected", {
      model,
    });
  }

  // Attempt 2: prompt-embedded schema fallback.
  const fallbackMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `${prompt}\n\nRespond with ONLY valid JSON matching this schema (no prose, no markdown fences):\n${JSON.stringify(
        schema,
      )}`,
    },
  ];

  let fallbackText: string;
  try {
    fallbackText = await runAnalysisLoop(
      client,
      model,
      fallbackMessages,
      tools,
      toolCtx,
      {},
      options,
    );
  } catch (err) {
    const { status, message } = extractError(err);
    throw new Error(
      status
        ? `Custom analysis fallback failed (HTTP ${status}): ${message}`
        : `Custom analysis fallback failed: ${message}`,
    );
  }

  try {
    return parseJsonLoose<T>(fallbackText);
  } catch (err) {
    throw new Error(
      `Custom analysis fallback returned unparseable JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/**
 * Non-streaming assistant⇄tool loop that returns the final assistant text.
 * `extraParams` carries e.g. response_format for the structured attempt.
 */
async function runAnalysisLoop(
  client: OpenAI,
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
  tools: OpenAI.ChatCompletionTool[],
  toolCtx: ToolCallContext,
  extraParams: Partial<OpenAI.ChatCompletionCreateParamsNonStreaming>,
  options: CustomAnalysisOptions,
): Promise<string> {
  for (let round = 1; round <= MAX_TOOL_ROUNDS; round++) {
    if (options.signal?.aborted) throw new Error("Aborted");
    const roundStart = Date.now();

    const completion = await client.chat.completions.create(
      {
        model,
        messages,
        ...(tools.length > 0 ? { tools, tool_choice: "auto" as const } : {}),
        ...extraParams,
      },
      { signal: options.signal },
    );

    const choice = completion.choices[0];
    const message = choice?.message;
    const finishReason = choice?.finish_reason ?? null;

    serverLog(options.runId, "custom-adapter", "analysis-round", {
      model,
      round,
      toolCallCount: message?.tool_calls?.length ?? 0,
      latencyMs: Date.now() - roundStart,
      finishReason,
    });

    if (message?.tool_calls && message.tool_calls.length > 0) {
      messages.push({
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      });
      for (const call of message.tool_calls) {
        // Every id in the pushed assistant tool_calls array MUST get a tool
        // response, or the next request 400s on an orphaned tool_call_id.
        if (call.type !== "function") {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: "Unsupported tool call type.",
          });
          continue;
        }
        let args: Record<string, unknown>;
        try {
          args = call.function.arguments.trim()
            ? (JSON.parse(call.function.arguments) as Record<string, unknown>)
            : {};
        } catch {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content:
              "Error: tool arguments were not valid JSON. Retry with valid JSON.",
          });
          continue;
        }
        const result = await handleToolCall(call.function.name, args, toolCtx);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: capToolResult(result.text),
        });
      }
      // Trim mechanically if the appended tool results pushed us over budget.
      enforceMidTurnBudget(messages, options.runId, "custom-adapter");
      continue;
    }

    return message?.content ?? "";
  }

  throw new Error(
    `Custom analysis exceeded ${MAX_TOOL_ROUNDS} tool rounds without a final answer`,
  );
}

/**
 * Bind credentials into an AnalysisAdapter (the shape analysis-service and the
 * orchestrator's synthesis path consume). The bound runAnalysisPhase injects
 * the creds into the per-call options.
 */
export function createCustomAnalysisAdapter(creds: CustomProviderCredentials): {
  runAnalysisPhase<T = unknown>(
    prompt: string,
    systemPrompt: string,
    model: string,
    schema: Record<string, unknown>,
    options?: { runId?: string; signal?: AbortSignal; webSearch?: boolean },
  ): Promise<T>;
} {
  return {
    runAnalysisPhase: (prompt, systemPrompt, model, schema, options) =>
      runAnalysisPhase(prompt, systemPrompt, model, schema, {
        ...creds,
        ...(options ?? {}),
      }),
  };
}
