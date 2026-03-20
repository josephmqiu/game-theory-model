// Codex adapter — the ONLY file that communicates with the Codex app-server.
// Provides two profiles: streamChat (interactive) and runAnalysisPhase (structured).
// Uses JSON-RPC 2.0 over stdio to a persistent `codex app-server` subprocess.

import { spawn, type ChildProcess } from "node:child_process";
import { filterCodexEnv } from "../../utils/codex-client";
import { serverLog, serverWarn } from "../../utils/ai-logger";
import { resolveMcpServerScript } from "../../utils/mcp-server-manager";
import type { ChatEvent } from "../../../shared/types/events";
import {
  CODEX_MCP_SERVER_NAME,
  installMcpServer,
} from "./codex-config";
import {
  ANALYSIS_TOOL_NAMES,
  CHAT_PRODUCT_TOOL_NAMES,
} from "./tool-surfaces";

// ── Types ──

export interface StreamChatOptions {
  runId?: string;
  /** Wall-clock timeout per chat turn in ms (default: 5 min) */
  timeoutMs?: number;
  /** Abort signal — when aborted, sends turn/interrupt and ends the stream */
  signal?: AbortSignal;
}

export interface AnalysisRunOptions {
  runId?: string;
  maxTurns?: number;
  signal?: AbortSignal;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ── JSON-RPC client ──

type NotificationCallback = (
  method: string,
  params: Record<string, unknown>,
) => void;

let nextRequestId = 1;

interface AppServerConnection {
  process: ChildProcess;
  pendingRequests: Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
    }
  >;
  notificationCallbacks: Set<NotificationCallback>;
}

let connection: AppServerConnection | null = null;

// Thread filtering: tracks the active thread so notification handlers
// only process events for their own session (Issue: cross-session fan-out).
let currentThreadId: string | null = null;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function extractThreadId(result: unknown): string {
  const thread = asRecord(asRecord(result)?.thread);
  const threadId = thread?.id;
  if (typeof threadId !== "string" || threadId.length === 0) {
    throw new Error("App-server thread/start response missing thread.id");
  }
  return threadId;
}

function extractTurnId(result: unknown): string {
  const turn = asRecord(asRecord(result)?.turn);
  const turnId = turn?.id;
  if (typeof turnId !== "string" || turnId.length === 0) {
    throw new Error("App-server turn/start response missing turn.id");
  }
  return turnId;
}

function getTurnIdFromParams(params: Record<string, unknown>): string | null {
  const turn = asRecord(params.turn);
  return typeof turn?.id === "string" ? turn.id : null;
}

function getTurnErrorMessage(params: Record<string, unknown>): string | null {
  const turn = asRecord(params.turn);
  const error = asRecord(turn?.error);
  return typeof error?.message === "string" ? error.message : null;
}

function createTurnInput(prompt: string): Array<Record<string, string>> {
  return [{ type: "text", text: prompt }];
}

function extractCompletedItemText(
  params: Record<string, unknown>,
): string | null {
  const item = asRecord(params.item);
  if (item?.type === "agentMessage" && typeof item.text === "string") {
    return item.text;
  }
  return null;
}

function sendRequest(
  conn: AppServerConnection,
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const id = nextRequestId++;
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    id,
    method,
    ...(params !== undefined ? { params } : {}),
  };

  return new Promise((resolve, reject) => {
    conn.pendingRequests.set(id, { resolve, reject });
    const line = JSON.stringify(request) + "\n";
    const ok = conn.process.stdin?.write(line);
    if (ok === false) {
      conn.pendingRequests.delete(id);
      reject(new Error("Failed to write to app-server stdin"));
    }
  });
}

function sendNotification(
  conn: AppServerConnection,
  method: string,
  params?: Record<string, unknown>,
): void {
  const notification: JsonRpcNotification = {
    jsonrpc: "2.0",
    method,
    ...(params !== undefined ? { params } : {}),
  };
  conn.process.stdin?.write(JSON.stringify(notification) + "\n");
}

function onNotification(
  conn: AppServerConnection,
  callback: NotificationCallback,
): () => void {
  conn.notificationCallbacks.add(callback);
  return () => conn.notificationCallbacks.delete(callback);
}

function handleIncomingLine(conn: AppServerConnection, line: string): void {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return; // Ignore non-JSON lines (e.g. stderr leaking to stdout)
  }

  // Response to a pending request (has "id" field)
  if ("id" in parsed && typeof parsed.id === "number") {
    const pending = conn.pendingRequests.get(parsed.id);
    if (pending) {
      conn.pendingRequests.delete(parsed.id);
      const response = parsed as unknown as JsonRpcResponse;
      if (response.error) {
        pending.reject(
          new Error(
            `JSON-RPC error ${response.error.code}: ${response.error.message}`,
          ),
        );
      } else {
        pending.resolve(response.result);
      }
    }
    return;
  }

  // Server-sent notification (no "id" field, has "method")
  if ("method" in parsed && typeof parsed.method === "string") {
    const params = (parsed.params ?? {}) as Record<string, unknown>;
    for (const cb of conn.notificationCallbacks) {
      try {
        cb(parsed.method, params);
      } catch {
        // Notification handlers must not crash the line parser
      }
    }
  }
}

const ANALYSIS_TIMEOUT_MS = 5 * 60 * 1000;

function resolveMcpServerCommand(): string {
  return process.release?.name === "node" ? process.execPath : "node";
}

function installToolSurface(
  toolNames: readonly string[],
  runId?: string,
): void {
  installMcpServer(resolveMcpServerCommand(), [resolveMcpServerScript()], {
    enabledTools: [...toolNames],
    env: runId ? { ANALYSIS_RUN_ID: runId } : undefined,
  });
  serverLog(runId, "codex-adapter", "mcp-config-written", {
    toolNames,
  });
}

async function reloadMcpServerConfig(
  conn: AppServerConnection,
  runId?: string,
): Promise<void> {
  await sendRequest(conn, "config/mcpServer/reload", {});
  serverLog(runId, "codex-adapter", "mcp-config-reloaded");
}

async function ensureConfiguredMcpServerAvailable(
  conn: AppServerConnection,
  toolNames: readonly string[],
  runId?: string,
): Promise<void> {
  const result = await sendRequest(conn, "mcpServerStatus/list", {
    limit: 100,
  });
  const data = asRecord(result)?.data;
  if (!Array.isArray(data)) {
    throw new Error("App-server returned an invalid MCP status payload");
  }

  const target = data
    .map((entry) => asRecord(entry))
    .find((entry) => entry?.name === CODEX_MCP_SERVER_NAME);

  if (!target) {
    throw new Error(`MCP server "${CODEX_MCP_SERVER_NAME}" is not loaded`);
  }

  const availableTools = Object.keys(asRecord(target.tools) ?? {});
  for (const toolName of toolNames) {
    if (!availableTools.includes(toolName)) {
      throw new Error(
        `MCP server "${CODEX_MCP_SERVER_NAME}" is missing tool "${toolName}"`,
      );
    }
  }

  serverLog(runId, "codex-adapter", "mcp-status-ready", {
    toolNames: availableTools,
  });
}

// ── App-server lifecycle ──

const INITIALIZE_TIMEOUT_MS = 15_000;

/**
 * Spawn the `codex app-server` subprocess and perform the JSON-RPC initialize handshake.
 * Returns the connection handle. Reuses an existing connection if alive.
 */
export async function startAppServer(
  runId?: string,
): Promise<AppServerConnection> {
  if (connection && connection.process.exitCode === null) {
    return connection;
  }

  const child = spawn("codex", ["app-server"], {
    env: filterCodexEnv(process.env as Record<string, string | undefined>),
    stdio: ["pipe", "pipe", "pipe"],
    ...(process.platform === "win32" && { shell: true }),
  });

  serverLog(runId, "codex-adapter", "spawn", { pid: child.pid });

  const conn: AppServerConnection = {
    process: child,
    pendingRequests: new Map(),
    notificationCallbacks: new Set(),
  };

  // Wire up stdout line parser
  let stdoutBuffer = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString("utf-8");
    let idx = stdoutBuffer.indexOf("\n");
    while (idx >= 0) {
      const line = stdoutBuffer.slice(0, idx).trim();
      stdoutBuffer = stdoutBuffer.slice(idx + 1);
      if (line) handleIncomingLine(conn, line);
      idx = stdoutBuffer.indexOf("\n");
    }
  });

  // Log stderr but don't crash
  child.stderr?.on("data", (chunk: Buffer) => {
    serverWarn(runId, "codex-adapter", "stderr", {
      preview: chunk.toString("utf-8").trim().slice(0, 500),
    });
  });

  // Clean up on exit
  child.on("close", (code) => {
    serverLog(runId, "codex-adapter", "close", { exitCode: code ?? "unknown" });
    // Reject any pending requests
    for (const [, pending] of conn.pendingRequests) {
      pending.reject(
        new Error(`App-server exited with code ${code ?? "unknown"}`),
      );
    }
    conn.pendingRequests.clear();
    if (connection === conn) {
      connection = null;
    }
  });

  // Initialize handshake with timeout
  const initPromise = sendRequest(conn, "initialize", {
    protocolVersion: "1.0",
    clientInfo: {
      name: "game-theory-analyzer",
      version: "1.0.0",
    },
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("App-server initialize timed out")),
      INITIALIZE_TIMEOUT_MS,
    ),
  );

  try {
    await Promise.race([initPromise, timeoutPromise]);
  } catch (err) {
    child.kill("SIGTERM");
    throw err;
  }

  // Send initialized notification
  sendNotification(conn, "initialized");

  connection = conn;
  serverLog(runId, "codex-adapter", "initialized");
  return conn;
}

/**
 * Gracefully stop the app-server subprocess.
 */
export async function stopAppServer(runId?: string): Promise<void> {
  if (!connection) return;

  const conn = connection;
  connection = null;

  serverLog(runId, "codex-adapter", "stopping");

  // Try graceful shutdown, then force kill
  conn.process.kill("SIGTERM");

  // Give it 2 seconds to exit gracefully
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (conn.process.exitCode === null) {
        conn.process.kill("SIGKILL");
      }
      resolve();
    }, 2000);

    conn.process.on("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// ── Chat profile ──

const CHAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_TOOL_CALLS_PER_TURN = 50;

// Approval notification methods that require a response
const MCP_TOOL_APPROVAL = "item/tool/requestUserInput";
const FILE_CHANGE_APPROVAL = "item/fileChange/requestApproval";
const COMMAND_APPROVAL = "item/commandExecution/requestApproval";
const PERMISSIONS_APPROVAL = "item/permissions/requestApproval";

/**
 * Stream a chat turn using the Codex app-server.
 * Yields normalized ChatEvent objects.
 *
 * Note on history forwarding: the caller (chat.ts) still extracts only the
 * last user message, and we send it as a single text item in Codex's `input`
 * array. Multi-turn conversation history and image attachments are not
 * forwarded — this is still a known limitation of this integration layer.
 */
export async function* streamChat(
  prompt: string,
  systemPrompt: string,
  model: string,
  options?: StreamChatOptions,
): AsyncGenerator<ChatEvent> {
  const runId = options?.runId;
  const timeoutMs = options?.timeoutMs ?? CHAT_TIMEOUT_MS;

  let conn: AppServerConnection;
  try {
    conn = await startAppServer(runId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    yield {
      type: "error",
      message: `Failed to start app-server: ${msg}`,
      recoverable: false,
    };
    return;
  }

  // Create a thread
  let threadId: string;
  let turnId: string | null = null;
  try {
    const threadResult = await sendRequest(conn, "thread/start", {
      developerInstructions: systemPrompt,
      model,
    });
    threadId = extractThreadId(threadResult);
    currentThreadId = threadId;
    serverLog(runId, "codex-adapter", "thread-started", { threadId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    yield {
      type: "error",
      message: `Failed to create thread: ${msg}`,
      recoverable: false,
    };
    return;
  }

  // Abort signal — when the client disconnects, interrupt the turn
  const signal = options?.signal;

  // Set up notification listener
  let turnCompleted = false;
  let aborted = false;
  let toolCallCount = 0;
  const eventQueue: ChatEvent[] = [];
  let resolveWait: (() => void) | null = null;
  let turnError: string | null = null;

  function enqueueEvent(event: ChatEvent) {
    eventQueue.push(event);
    resolveWait?.();
    resolveWait = null;
  }

  const removeListener = onNotification(conn, (method, params) => {
    // Thread filtering: skip notifications for a different thread (best-effort).
    // If the notification has no threadId, accept it.
    const notifThreadId = params.threadId as string | undefined;
    if (notifThreadId && notifThreadId !== threadId) return;

    if (method === "turn/started") {
      turnId = getTurnIdFromParams(params) ?? turnId;
      return;
    }

    // Text delta
    if (method === "item/agentMessage/delta") {
      const delta = typeof params.delta === "string" ? params.delta : "";
      if (delta) {
        enqueueEvent({ type: "text_delta", content: delta });
      }
      return;
    }

    // Tool call progress
    if (method === "item/mcpToolCall/progress") {
      toolCallCount++;
      const toolName =
        typeof params.toolName === "string" ? params.toolName : "unknown";
      enqueueEvent({
        type: "tool_call_start",
        toolName,
        input: params.input ?? {},
      });

      // Guard: interrupt if too many tool calls
      if (toolCallCount >= MAX_TOOL_CALLS_PER_TURN) {
        serverWarn(runId, "codex-adapter", "tool-call-limit", {
          count: toolCallCount,
          threadId,
        });
        if (turnId) {
          sendRequest(conn, "turn/interrupt", { threadId, turnId }).catch(() => {});
        }
        turnError = `Turn interrupted: exceeded ${MAX_TOOL_CALLS_PER_TURN} tool calls`;
      }
      return;
    }

    // Turn completed
    if (method === "turn/completed") {
      turnId = getTurnIdFromParams(params) ?? turnId;
      const errorMessage = getTurnErrorMessage(params);
      if (errorMessage) {
        turnError = errorMessage;
      }
      turnCompleted = true;
      if (!turnError) {
        enqueueEvent({ type: "turn_complete" });
      }
      return;
    }

    // MCP tool approval — auto-approve
    if (method === MCP_TOOL_APPROVAL) {
      const approvalId = params.id as string | undefined;
      if (approvalId) {
        serverLog(runId, "codex-adapter", "mcp-tool-auto-approve", {
          toolName: params.toolName,
          approvalId,
        });
        sendRequest(conn, "item/tool/approveUserInput", {
          id: approvalId,
          approved: true,
        }).catch(() => {});
      }
      return;
    }

    // File/command/permissions approval — auto-reject with warning.
    // TODO: Forward to UI for user review instead of auto-rejecting
    if (
      method === FILE_CHANGE_APPROVAL ||
      method === COMMAND_APPROVAL ||
      method === PERMISSIONS_APPROVAL
    ) {
      const approvalId = params.id as string | undefined;
      serverWarn(runId, "codex-adapter", "approval-rejected", {
        method,
        approvalId,
        detail: params,
      });
      if (approvalId) {
        sendRequest(
          conn,
          method.replace("requestApproval", "respondApproval"),
          {
            id: approvalId,
            approved: false,
            reason:
              "File/command operations are not permitted in the current trust tier",
          },
        ).catch(() => {});
      }
      return;
    }

    // Catch-all: log any unrecognized notification types for monitoring
    // (covers non-MCP tool activity and future notification types)
    serverWarn(runId, "codex-adapter", "unrecognized-notification", {
      method,
      params,
    });
  });

  // Send the turn
  try {
    const turnResult = await sendRequest(conn, "turn/start", {
      threadId,
      input: createTurnInput(prompt),
    });
    turnId = extractTurnId(turnResult);
  } catch (err) {
    removeListener();
    const msg = err instanceof Error ? err.message : String(err);
    yield {
      type: "error",
      message: `Failed to start turn: ${msg}`,
      recoverable: false,
    };
    return;
  }

  // Wire up abort signal to interrupt the turn
  const onAbort = () => {
    aborted = true;
    if (turnId) {
      sendRequest(conn, "turn/interrupt", { threadId, turnId }).catch(() => {});
    }
    // Wake the wait loop so it can exit
    resolveWait?.();
    resolveWait = null;
  };
  if (signal) {
    if (signal.aborted) {
      aborted = true;
      if (turnId) {
        sendRequest(conn, "turn/interrupt", { threadId, turnId }).catch(() => {});
      }
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  // Wall-clock timeout
  const startTime = Date.now();

  try {
    while (!turnCompleted) {
      // Check abort
      if (aborted) {
        return;
      }

      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        serverWarn(runId, "codex-adapter", "timeout", {
          elapsedMs: Date.now() - startTime,
          threadId,
        });
        if (turnId) {
          await sendRequest(conn, "turn/interrupt", { threadId, turnId }).catch(() => {});
        }
        yield {
          type: "error",
          message: `Turn timed out after ${Math.round(timeoutMs / 1000)}s`,
          recoverable: false,
        };
        return;
      }

      // Drain queued events before checking error state
      while (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      }

      // Check tool call error (after draining so queued events are yielded first)
      if (turnError) {
        yield { type: "error", message: turnError, recoverable: false };
        return;
      }

      // Wait for next event or check timeout periodically
      if (!turnCompleted && eventQueue.length === 0) {
        await new Promise<void>((resolve) => {
          resolveWait = resolve;
          // Wake up periodically to check timeout
          setTimeout(resolve, 1000);
        });
      }
    }

    // Drain any remaining events
    while (eventQueue.length > 0) {
      yield eventQueue.shift()!;
    }
  } finally {
    removeListener();
    if (signal) signal.removeEventListener("abort", onAbort);
    if (currentThreadId === threadId) currentThreadId = null;
  }
}

// ── Analysis profile ──

/**
 * Run a single analysis phase using Codex with structured JSON output.
 * Returns the parsed JSON result.
 *
 * Registers the read-only analysis MCP surface, reloads app-server config,
 * runs a structured-output turn, then restores the chat MCP surface.
 */
export async function runAnalysisPhase<T = unknown>(
  prompt: string,
  systemPrompt: string,
  model: string,
  schema: Record<string, unknown>,
  options?: AnalysisRunOptions,
): Promise<T> {
  const runId = options?.runId;
  installToolSurface(ANALYSIS_TOOL_NAMES, runId);

  const conn = await startAppServer(runId);
  let restoreError: Error | null = null;
  let threadId = "";
  let turnId: string | null = null;
  let parsedResult: T | null = null;

  try {
    await reloadMcpServerConfig(conn, runId);
    await ensureConfiguredMcpServerAvailable(conn, ANALYSIS_TOOL_NAMES, runId);

    const threadResult = await sendRequest(conn, "thread/start", {
      developerInstructions: systemPrompt,
      model,
      config: {
        web_search: "live",
      },
    });
    threadId = extractThreadId(threadResult);
    currentThreadId = threadId;
    serverLog(runId, "codex-adapter", "analysis-thread-started", { threadId });

    // Collect result from turn/completed
    let result: unknown = undefined;
    let completed = false;
    let completionError: string | null = null;
    let streamedText = "";

    const removeListener = onNotification(conn, (method, params) => {
      // Thread filtering: skip notifications for a different thread (best-effort).
      const notifThreadId = params.threadId as string | undefined;
      if (notifThreadId && notifThreadId !== threadId) return;

      if (method === "turn/started") {
        turnId = getTurnIdFromParams(params) ?? turnId;
        return;
      }

      if (method === "item/started") {
        const item = asRecord(params.item);
        if (item?.type === "webSearch") {
          serverLog(runId, "codex-adapter", "analysis-web-search", {
            query: item.query,
          });
        }
        return;
      }

      if (method === "item/agentMessage/delta") {
        if (typeof params.delta === "string") {
          streamedText += params.delta;
        }
        return;
      }

      if (method === "item/mcpToolCall/progress") {
        serverLog(runId, "codex-adapter", "analysis-mcp-tool-call", {
          toolName: params.toolName,
          input: params.input ?? {},
        });
        return;
      }

      if (method === "item/completed") {
        const item = asRecord(params.item);
        if (item?.type === "webSearch") {
          serverLog(runId, "codex-adapter", "analysis-web-search-complete", {
            query: item.query,
          });
        }
        const completedText = extractCompletedItemText(params);
        if (completedText) {
          result = completedText;
        }
        return;
      }

      if (method === "turn/completed") {
        turnId = getTurnIdFromParams(params) ?? turnId;
        completed = true;
        completionError = getTurnErrorMessage(params) ?? completionError;
        if (result === undefined) {
          result = params.structuredOutput ?? params.content ?? params.result;
        }
        if (result === undefined && streamedText.trim().length > 0) {
          result = streamedText;
        }
        return;
      }

      if (method === MCP_TOOL_APPROVAL) {
        const approvalId = params.id as string | undefined;
        const toolName =
          typeof params.toolName === "string" ? params.toolName : "unknown";
        if (approvalId) {
          const approved = ANALYSIS_TOOL_NAMES.includes(
            toolName as (typeof ANALYSIS_TOOL_NAMES)[number],
          );
          sendRequest(conn, "item/tool/approveUserInput", {
            id: approvalId,
            approved,
            reason: approved
              ? "Approved analysis read-only MCP tool"
              : "Analysis mode only permits read-only MCP tools",
          }).catch(() => {});
          serverLog(runId, "codex-adapter", "analysis-tool-approval", {
            approvalId,
            toolName,
            approved,
          });
        }
        return;
      }

      if (
        method === FILE_CHANGE_APPROVAL ||
        method === COMMAND_APPROVAL ||
        method === PERMISSIONS_APPROVAL
      ) {
        const approvalId = params.id as string | undefined;
        serverWarn(runId, "codex-adapter", "analysis-approval-rejected", {
          method,
          approvalId,
          detail: params,
        });
        if (approvalId) {
          sendRequest(
            conn,
            method.replace("requestApproval", "respondApproval"),
            {
              id: approvalId,
              approved: false,
              reason:
                "Analysis mode only permits read-only MCP tool access",
            },
          ).catch(() => {});
        }
      }
    });

    const turnResult = await sendRequest(conn, "turn/start", {
      threadId,
      input: createTurnInput(prompt),
      outputSchema: schema,
    });
    turnId = extractTurnId(turnResult);

    const startTime = Date.now();

    try {
      while (!completed) {
        if (options?.signal?.aborted) {
          if (turnId) {
            await sendRequest(conn, "turn/interrupt", {
              threadId,
              turnId,
            }).catch(() => {});
          }
          throw new Error("Aborted");
        }
        if (Date.now() - startTime > ANALYSIS_TIMEOUT_MS) {
          if (turnId) {
            await sendRequest(conn, "turn/interrupt", {
              threadId,
              turnId,
            }).catch(() => {});
          }
          throw new Error("Analysis phase timed out");
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (completionError) {
        throw new Error(completionError);
      }

      if (result === undefined || result === null) {
        throw new Error("Analysis phase returned empty result");
      }

      if (typeof result === "string") {
        parsedResult = JSON.parse(result) as T;
      } else {
        parsedResult = result as T;
      }
    } finally {
      removeListener();
      if (currentThreadId === threadId) currentThreadId = null;
    }
  } finally {
    try {
      installToolSurface(CHAT_PRODUCT_TOOL_NAMES);
      await reloadMcpServerConfig(conn, runId);
    } catch (err) {
      restoreError =
        err instanceof Error
          ? err
          : new Error(`Failed to restore chat MCP config: ${String(err)}`);
      serverWarn(runId, "codex-adapter", "mcp-restore-failed", {
        message: restoreError.message,
      });
    }
  }

  if (restoreError) {
    throw restoreError;
  }

  if (parsedResult === null) {
    throw new Error("Analysis phase completed without parsed result");
  }

  return parsedResult;
}

// ── Exports for testing ──

export { filterCodexEnv };

/** Visible for testing — get the current connection */
export function _getConnection(): AppServerConnection | null {
  return connection;
}

/** Visible for testing — reset module state */
export function _resetConnection(): void {
  connection = null;
  nextRequestId = 1;
}
