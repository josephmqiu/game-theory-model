// Codex adapter — the ONLY file that communicates with the Codex app-server.
// Provides two profiles: streamChat (interactive) and runAnalysisPhase (structured).
// Uses JSON-RPC 2.0 over stdio to a persistent `codex app-server` subprocess.

import { spawn, type ChildProcess } from "node:child_process";
import { filterCodexEnv } from "../../utils/codex-client";
import { serverLog, serverWarn } from "../../utils/ai-logger";
import { resolveMcpProxyScript } from "../../utils/mcp-server-manager";
import type { ChatEvent } from "../../../shared/types/events";
import { analysisRuntimeConfig } from "../../config/analysis-runtime";
import { CODEX_MCP_SERVER_NAME, installMcpServer } from "./codex-config";
import { ANALYSIS_TOOL_NAMES, CHAT_TOOL_NAMES } from "./tool-surfaces";
import type { AnalysisActivityCallback } from "./analysis-activity";
import {
  createProcessRuntimeError,
  createProviderRuntimeError,
} from "../../../shared/types/runtime-error";
import type {
  RuntimeAdapter,
  RuntimeAdapterSession,
  RuntimeAdapterSessionKey,
  RuntimeChatTurnInput,
  RuntimeSessionDiagnostics,
  RuntimeStructuredTurnInput,
} from "./adapter-contract";
import { mapRuntimeModels } from "./adapter-contract";
import { getCodexProviderSnapshot } from "./provider-health";

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
  webSearch?: boolean;
  onActivity?: AnalysisActivityCallback;
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

interface AppServerConnection {
  process: ChildProcess;
  nextRequestId: number;
  pendingRequests: Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
    }
  >;
  notificationCallbacks: Set<NotificationCallback>;
  diagnostics: {
    stdout: string[];
    stderr: string[];
  };
  terminationError: Error | null;
}

let connection: AppServerConnection | null = null;

const MAX_DIAGNOSTIC_LINES = 25;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function appendDiagnosticLine(target: string[], line: string): void {
  if (!line) return;
  target.push(line);
  if (target.length > MAX_DIAGNOSTIC_LINES) {
    target.splice(0, target.length - MAX_DIAGNOSTIC_LINES);
  }
}

function captureConnectionOutput(
  conn: AppServerConnection,
  stream: "stdout" | "stderr",
  text: string,
): void {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    appendDiagnosticLine(conn.diagnostics[stream], line.slice(0, 1000));
  }
}

function getWebSearchQuery(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const query = value.trim();
  return query.length > 0 ? query : undefined;
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

function getTurnStatus(params: Record<string, unknown>): string | null {
  const turn = asRecord(params.turn);
  return typeof turn?.status === "string" ? turn.status : null;
}

interface CodexTurnErrorDetails {
  message: string | null;
  additionalDetails: string | null;
  codexErrorInfo: unknown;
}

function getTurnErrorDetails(
  params: Record<string, unknown>,
): CodexTurnErrorDetails {
  const turn = asRecord(params.turn);
  const error = asRecord(turn?.error);
  return {
    message: typeof error?.message === "string" ? error.message : null,
    additionalDetails:
      typeof error?.additionalDetails === "string"
        ? error.additionalDetails
        : null,
    codexErrorInfo: error?.codexErrorInfo,
  };
}

function getServerNotificationErrorDetails(
  params: Record<string, unknown>,
): CodexTurnErrorDetails {
  const error = asRecord(params.error);
  return {
    message: typeof error?.message === "string" ? error.message : null,
    additionalDetails:
      typeof error?.additionalDetails === "string"
        ? error.additionalDetails
        : null,
    codexErrorInfo: error?.codexErrorInfo,
  };
}

function stringifyCodexErrorInfo(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildCodexTurnFailureMessage(
  message: string,
  details?: {
    status?: string | null;
    additionalDetails?: string | null;
    codexErrorInfo?: unknown;
  },
): string {
  const summary = message.trim().length > 0 ? message.trim() : "Unknown error";
  const suffix: string[] = [];

  if (details?.status) {
    suffix.push(`status=${details.status}`);
  }
  if (details?.additionalDetails) {
    suffix.push(`additionalDetails=${details.additionalDetails}`);
  }
  const codexErrorInfo = stringifyCodexErrorInfo(details?.codexErrorInfo);
  if (codexErrorInfo) {
    suffix.push(`codexErrorInfo=${codexErrorInfo}`);
  }

  return suffix.length > 0
    ? `Codex turn failed: ${summary} (${suffix.join("; ")})`
    : `Codex turn failed: ${summary}`;
}

function normalizeAnalysisError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Aborted") {
    return new Error("Aborted");
  }
  if (
    message.startsWith("Codex turn failed:") ||
    message.startsWith("Failed to restore chat MCP config:")
  ) {
    return error instanceof Error ? error : new Error(message);
  }
  return new Error(buildCodexTurnFailureMessage(message));
}

function logSendRequestFailure(
  runId: string | undefined,
  event: string,
  context: Record<string, unknown>,
): (error: unknown) => void {
  return (error: unknown) => {
    serverWarn(runId, "codex-adapter", event, {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
  };
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
  if (conn.terminationError) {
    return Promise.reject(conn.terminationError);
  }

  const id = conn.nextRequestId++;
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
    appendDiagnosticLine(conn.diagnostics.stdout, line.slice(0, 1000));
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

const ANALYSIS_TIMEOUT_MS = analysisRuntimeConfig.codex.analysisTimeoutMs;

function resolveMcpServerCommand(): string {
  // In Electron, process.execPath is the Electron binary (GUI app), not a
  // Node.js runtime. Codex needs a real Node/Bun binary to spawn the MCP
  // server subprocess. Fall back to "node" (on PATH) in Electron production.
  if (process.env.ELECTRON_RESOURCES_PATH) return "node";
  return process.release?.name === "node" ? process.execPath : "node";
}

function installToolSurface(
  toolNames: readonly string[],
  runId?: string,
): void {
  const env: Record<string, string> = {};
  if (runId) {
    env.ANALYSIS_RUN_ID = runId;
  }
  if (process.env.MCP_PORT?.trim()) {
    env.MCP_PORT = process.env.MCP_PORT.trim();
  }

  installMcpServer(resolveMcpServerCommand(), [resolveMcpProxyScript()], {
    enabledTools: [...toolNames],
    env: Object.keys(env).length > 0 ? env : undefined,
  });
  serverLog(runId, "codex-adapter", "mcp-config-written", {
    toolNames,
  });
}

function installAnalysisToolSurface(runId?: string): void {
  installToolSurface(ANALYSIS_TOOL_NAMES, runId);
}

function installChatToolSurface(): void {
  installToolSurface(CHAT_TOOL_NAMES);
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
  // Retry with backoff: config/mcpServer/reload may return before Codex
  // finishes initializing the MCP subprocess (initialize + tools/list).
  const MAX_ATTEMPTS = 5;
  const RETRY_DELAYS = [0, 300, 600, 1200, 2400];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }

    // Wrap entire check in try-catch: sendRequest can reject with a JSON-RPC
    // error during MCP server restart, and the response shape may be transient.
    let result: unknown;
    try {
      result = await sendRequest(conn, "mcpServerStatus/list", {
        limit: 100,
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      serverLog(runId, "codex-adapter", "mcp-status-retry", {
        attempt: attempt + 1,
        reason: "sendRequest rejected",
        error: lastError.message,
      });
      continue;
    }

    const data = asRecord(result)?.data;
    if (!Array.isArray(data)) {
      lastError = new Error(
        `App-server returned non-array MCP status (got ${typeof data})`,
      );
      if (attempt < MAX_ATTEMPTS - 1) {
        serverLog(runId, "codex-adapter", "mcp-status-retry", {
          attempt: attempt + 1,
          reason: "invalid payload shape",
          dataType: typeof data,
        });
        continue;
      }
      throw lastError;
    }

    const target = data
      .map((entry) => asRecord(entry))
      .find((entry) => entry?.name === CODEX_MCP_SERVER_NAME);

    if (!target) {
      if (attempt < MAX_ATTEMPTS - 1) {
        serverLog(runId, "codex-adapter", "mcp-status-retry", {
          attempt: attempt + 1,
          reason: "server not loaded",
          serverNames: data.map((e) => asRecord(e)?.name).filter(Boolean),
        });
        continue;
      }
      throw new Error(`MCP server "${CODEX_MCP_SERVER_NAME}" is not loaded`);
    }

    const availableTools = Object.keys(asRecord(target.tools) ?? {});
    const missing = toolNames.filter((t) => !availableTools.includes(t));

    if (missing.length === 0) {
      serverLog(runId, "codex-adapter", "mcp-status-ready", {
        toolNames: availableTools,
        attempts: attempt + 1,
      });
      return;
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      serverLog(runId, "codex-adapter", "mcp-status-retry", {
        attempt: attempt + 1,
        reason: "missing tools",
        missing,
        available: availableTools,
      });
      continue;
    }

    throw new Error(
      `MCP server "${CODEX_MCP_SERVER_NAME}" is missing tool "${missing[0]}"`,
    );
  }

  // Should not reach here, but guard against it
  throw lastError ?? new Error("MCP status check exhausted retries");
}

// ── App-server lifecycle ──

const INITIALIZE_TIMEOUT_MS = analysisRuntimeConfig.codex.initializeTimeoutMs;

/**
 * Spawn the `codex app-server` subprocess and perform the JSON-RPC initialize handshake.
 * Returns the connection handle. Reuses an existing connection if alive.
 */
export async function startAppServer(
  runId?: string,
): Promise<AppServerConnection> {
  if (
    connection &&
    connection.process.exitCode === null &&
    !connection.terminationError
  ) {
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
    nextRequestId: 1,
    pendingRequests: new Map(),
    notificationCallbacks: new Set(),
    diagnostics: {
      stdout: [],
      stderr: [],
    },
    terminationError: null,
  };

  // Wire up stdout line parser
  let stdoutBuffer = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf-8");
    captureConnectionOutput(conn, "stdout", text);
    stdoutBuffer += text;
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
    const preview = chunk.toString("utf-8");
    captureConnectionOutput(conn, "stderr", preview);
    serverWarn(runId, "codex-adapter", "stderr", {
      preview: preview.trim().slice(0, 500),
    });
  });

  const handleTermination = (
    event: "error" | "exit" | "close",
    error?: Error,
    code?: number | null,
    signal?: NodeJS.Signals | null,
  ) => {
    if (conn.terminationError) return;
    conn.terminationError =
      error ??
      new Error(
        `App-server terminated during ${event} (${code ?? "unknown"}${signal ? `, ${signal}` : ""})`,
      );
    serverLog(runId, "codex-adapter", "process-terminated", {
      event,
      exitCode: code ?? "unknown",
      signal: signal ?? null,
      error: error?.message,
      stdoutTail: conn.diagnostics.stdout,
      stderrTail: conn.diagnostics.stderr,
    });
    // Reject any pending requests
    for (const [, pending] of conn.pendingRequests) {
      pending.reject(conn.terminationError);
    }
    conn.pendingRequests.clear();
    if (connection === conn) {
      connection = null;
    }
  };

  child.on("error", (error) => {
    handleTermination("error", error);
  });
  child.on("exit", (code, signal) => {
    handleTermination("exit", undefined, code, signal);
  });
  child.on("close", (code, signal) => {
    handleTermination("close", undefined, code, signal);
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
    serverWarn(runId, "codex-adapter", "initialize-failed", {
      error: err instanceof Error ? err.message : String(err),
      stdoutTail: conn.diagnostics.stdout,
      stderrTail: conn.diagnostics.stderr,
    });
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
        serverWarn(runId, "codex-adapter", "force-kill", {
          pid: conn.process.pid,
        });
        conn.process.kill("SIGKILL");
      }
      resolve();
    }, analysisRuntimeConfig.codex.gracefulShutdownTimeoutMs);

    conn.process.on("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// ── Chat profile ──

const CHAT_TIMEOUT_MS = analysisRuntimeConfig.codex.chatTimeoutMs;
const MAX_TOOL_CALLS_PER_TURN = analysisRuntimeConfig.codex.maxToolCallsPerTurn;

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

  installChatToolSurface();

  let conn: AppServerConnection;
  try {
    conn = await startAppServer(runId);
    await reloadMcpServerConfig(conn, runId);
    await ensureConfiguredMcpServerAvailable(conn, CHAT_TOOL_NAMES, runId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    yield {
      type: "error",
      error: createProcessRuntimeError(`Failed to start app-server: ${msg}`, {
        provider: "codex",
        processState: "failed-to-start",
        retryable: false,
      }),
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
    serverLog(runId, "codex-adapter", "thread-started", { threadId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    yield {
      type: "error",
      error: createProviderRuntimeError(`Failed to create thread: ${msg}`, {
        provider: "codex",
        reason: "unknown",
        retryable: false,
      }),
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
          sendRequest(conn, "turn/interrupt", { threadId, turnId }).catch(
            logSendRequestFailure(runId, "turn-interrupt-failed", {
              reason: "tool-call-limit",
              threadId,
              turnId,
            }),
          );
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
        }).catch(
          logSendRequestFailure(runId, "approval-response-failed", {
            approvalId,
            method: "item/tool/approveUserInput",
            threadId,
          }),
        );
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
        ).catch(
          logSendRequestFailure(runId, "approval-response-failed", {
            approvalId,
            method,
            threadId,
          }),
        );
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
      error: createProviderRuntimeError(`Failed to start turn: ${msg}`, {
        provider: "codex",
        reason: "unknown",
        retryable: false,
      }),
    };
    return;
  }

  // Wire up abort signal to interrupt the turn
  const onAbort = () => {
    aborted = true;
    if (turnId) {
      sendRequest(conn, "turn/interrupt", { threadId, turnId }).catch(
        logSendRequestFailure(runId, "turn-interrupt-failed", {
          reason: "abort-signal",
          threadId,
          turnId,
        }),
      );
    }
    // Wake the wait loop so it can exit
    resolveWait?.();
    resolveWait = null;
  };
  if (signal) {
    if (signal.aborted) {
      aborted = true;
      if (turnId) {
        sendRequest(conn, "turn/interrupt", { threadId, turnId }).catch(
          logSendRequestFailure(runId, "turn-interrupt-failed", {
            reason: "already-aborted",
            threadId,
            turnId,
          }),
        );
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
          await sendRequest(conn, "turn/interrupt", { threadId, turnId }).catch(
            logSendRequestFailure(runId, "turn-interrupt-failed", {
              reason: "timeout",
              threadId,
              turnId,
            }),
          );
        }
        yield {
          type: "error",
          error: createProviderRuntimeError(
            `Turn timed out after ${Math.round(timeoutMs / 1000)}s`,
            {
              provider: "codex",
              reason: "unavailable",
              retryable: true,
            },
          ),
        };
        return;
      }

      // Drain queued events before checking error state
      while (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      }

      // Check tool call error (after draining so queued events are yielded first)
      if (turnError) {
        yield {
          type: "error",
          error: createProviderRuntimeError(turnError, {
            provider: "codex",
            reason: "unknown",
            retryable: false,
          }),
        };
        return;
      }

      // Wait for next event or check timeout periodically
      if (!turnCompleted && eventQueue.length === 0) {
        await new Promise<void>((resolve) => {
          resolveWait = resolve;
          // Wake up periodically to check timeout
          setTimeout(resolve, analysisRuntimeConfig.codex.chatPollIntervalMs);
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
  installAnalysisToolSurface(runId);

  const conn = await startAppServer(runId);
  let restoreError: Error | null = null;
  let primaryError: Error | null = null;
  let threadId = "";
  let turnId: string | null = null;
  let parsedResult: T | null = null;

  try {
    await reloadMcpServerConfig(conn, runId);
    await ensureConfiguredMcpServerAvailable(conn, ANALYSIS_TOOL_NAMES, runId);

    const webSearchMode = options?.webSearch === false ? "disabled" : "live";
    const threadResult = await sendRequest(conn, "thread/start", {
      developerInstructions: systemPrompt,
      model,
      config: {
        web_search: webSearchMode,
      },
    });
    threadId = extractThreadId(threadResult);
    serverLog(runId, "codex-adapter", "analysis-thread-started", { threadId });

    // Collect result from turn/completed
    let result: unknown = undefined;
    let completed = false;
    let completionError: string | null = null;
    let turnFailureStatus: string | null = null;
    let completionErrorDetails: CodexTurnErrorDetails | null = null;
    let streamedText = "";
    let fatalError: string | null = null;

    const removeListener = onNotification(conn, (method, params) => {
      // Thread filtering: skip notifications for a different thread (best-effort).
      const notifThreadId = params.threadId as string | undefined;
      if (notifThreadId && notifThreadId !== threadId) return;

      if (method === "turn/started") {
        turnId = getTurnIdFromParams(params) ?? turnId;
        return;
      }

      if (method === "error") {
        const details = getServerNotificationErrorDetails(params);
        fatalError = buildCodexTurnFailureMessage(
          details.message ?? "Server notification error",
          {
            additionalDetails: details.additionalDetails,
            codexErrorInfo: details.codexErrorInfo,
          },
        );
        serverWarn(runId, "codex-adapter", "analysis-error-notification", {
          threadId,
          turnId,
          message: details.message,
          additionalDetails: details.additionalDetails,
          codexErrorInfo: details.codexErrorInfo,
          willRetry: params.willRetry,
        });
        return;
      }

      if (method === "item/started") {
        const item = asRecord(params.item);
        if (item?.type === "webSearch") {
          const query = getWebSearchQuery(item.query);
          options?.onActivity?.({
            kind: "web-search",
            message: "Using WebSearch",
            ...(query ? { query } : {}),
          });
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
        const toolName =
          typeof params.toolName === "string" ? params.toolName : "unknown";
        options?.onActivity?.({
          kind: "tool",
          message: `Using ${toolName}`,
          toolName,
        });
        serverLog(runId, "codex-adapter", "analysis-mcp-tool-call", {
          toolName,
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
        turnFailureStatus = getTurnStatus(params);
        const errorDetails = getTurnErrorDetails(params);
        completionErrorDetails = errorDetails;
        completed = true;
        completionError =
          errorDetails.message ??
          completionError ??
          (turnFailureStatus && turnFailureStatus !== "completed"
            ? buildCodexTurnFailureMessage(
                "Turn completed with non-success status",
                {
                  status: turnFailureStatus,
                  additionalDetails: errorDetails.additionalDetails,
                  codexErrorInfo: errorDetails.codexErrorInfo,
                },
              )
            : null);
        if (result === undefined) {
          result = params.structuredOutput ?? params.content ?? params.result;
        }
        if (result === undefined && streamedText.trim().length > 0) {
          result = streamedText;
        }
        serverLog(runId, "codex-adapter", "analysis-turn-completed", {
          threadId,
          turnId,
          status: turnFailureStatus,
          hasResult: result !== undefined && result !== null,
          errorMessage: errorDetails.message,
          additionalDetails: errorDetails.additionalDetails,
          codexErrorInfo: errorDetails.codexErrorInfo,
        });
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
          }).catch(
            logSendRequestFailure(runId, "approval-response-failed", {
              approvalId,
              method: "item/tool/approveUserInput",
              threadId,
              toolName,
            }),
          );
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
        fatalError = buildCodexTurnFailureMessage(
          `Analysis rejected ${method} during structured-output turn`,
        );
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
              reason: "Analysis mode only permits read-only MCP tool access",
            },
          ).catch(
            logSendRequestFailure(runId, "approval-response-failed", {
              approvalId,
              method,
              threadId,
            }),
          );
        }
      }
    });

    serverLog(runId, "codex-adapter", "analysis-turn-start-request", {
      threadId,
      model,
      hasOutputSchema: true,
    });
    let turnResult: unknown;
    try {
      turnResult = await sendRequest(conn, "turn/start", {
        threadId,
        input: createTurnInput(prompt),
        outputSchema: schema,
      });
    } catch (error) {
      throw new Error(
        buildCodexTurnFailureMessage(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
    turnId = extractTurnId(turnResult);
    serverLog(runId, "codex-adapter", "analysis-turn-started", {
      threadId,
      turnId,
    });

    const startTime = Date.now();

    try {
      while (!completed) {
        if (options?.signal?.aborted) {
          if (turnId) {
            await sendRequest(conn, "turn/interrupt", {
              threadId,
              turnId,
            }).catch(
              logSendRequestFailure(runId, "turn-interrupt-failed", {
                reason: "analysis-abort",
                threadId,
                turnId,
              }),
            );
          }
          throw new Error("Aborted");
        }
        if (fatalError) {
          if (turnId) {
            await sendRequest(conn, "turn/interrupt", {
              threadId,
              turnId,
            }).catch(
              logSendRequestFailure(runId, "turn-interrupt-failed", {
                reason: "analysis-fatal-error",
                threadId,
                turnId,
              }),
            );
          }
          throw new Error(fatalError);
        }
        if (Date.now() - startTime > ANALYSIS_TIMEOUT_MS) {
          if (turnId) {
            await sendRequest(conn, "turn/interrupt", {
              threadId,
              turnId,
            }).catch(
              logSendRequestFailure(runId, "turn-interrupt-failed", {
                reason: "analysis-timeout",
                threadId,
                turnId,
              }),
            );
          }
          throw new Error("Analysis phase timed out");
        }
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            analysisRuntimeConfig.codex.analysisPollIntervalMs,
          ),
        );
      }

      if (fatalError) {
        throw new Error(fatalError);
      }

      if (completionError !== null) {
        const errorMessage = completionError as string;
        const additionalDetails =
          (completionErrorDetails as CodexTurnErrorDetails | null)
            ?.additionalDetails ?? null;
        const codexErrorInfo = (
          completionErrorDetails as CodexTurnErrorDetails | null
        )?.codexErrorInfo;
        if (errorMessage.startsWith("Codex turn failed:")) {
          throw new Error(errorMessage);
        }
        throw new Error(
          buildCodexTurnFailureMessage(errorMessage, {
            status: turnFailureStatus,
            additionalDetails,
            codexErrorInfo,
          }),
        );
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
    }
  } catch (error) {
    primaryError = normalizeAnalysisError(error);
  } finally {
    try {
      installChatToolSurface();
      await reloadMcpServerConfig(conn, runId);
      serverLog(runId, "codex-adapter", "analysis-mcp-restored");
    } catch (err) {
      restoreError =
        err instanceof Error
          ? err
          : new Error(`Failed to restore chat MCP config: ${String(err)}`);
      serverWarn(runId, "codex-adapter", "mcp-restore-failed", {
        message: restoreError.message,
      });
      if (!primaryError) {
        primaryError = restoreError;
      }
    }
  }

  if (primaryError) {
    throw primaryError;
  }

  if (parsedResult === null) {
    throw new Error("Analysis phase completed without parsed result");
  }

  return parsedResult;
}

// ── Exports for testing ──

export { filterCodexEnv };

class CodexRuntimeSession implements RuntimeAdapterSession {
  readonly provider = "codex" as const;
  readonly key: RuntimeAdapterSessionKey;
  private readonly sessionId: string;

  constructor(key: RuntimeAdapterSessionKey) {
    this.key = key;
    this.sessionId = `codex-${key.ownerId}-${Math.random().toString(36).slice(2, 10)}`;
  }

  streamChatTurn(input: RuntimeChatTurnInput): AsyncGenerator<ChatEvent> {
    return streamChat(input.prompt, input.systemPrompt, input.model, {
      runId: input.runId,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
    });
  }

  runStructuredTurn<T = unknown>(input: RuntimeStructuredTurnInput): Promise<T> {
    return runAnalysisPhase<T>(
      input.prompt,
      input.systemPrompt,
      input.model,
      input.schema,
      {
        runId: input.runId,
        signal: input.signal,
        webSearch: input.webSearch,
        onActivity: input.onActivity,
      },
    );
  }

  getDiagnostics(): RuntimeSessionDiagnostics {
    const details: Record<string, unknown> = {
      ownerId: this.key.ownerId,
    };
    if (connection) {
      details.stdoutTail = connection.diagnostics.stdout;
      details.stderrTail = connection.diagnostics.stderr;
      details.pid = connection.process.pid;
    }

    return {
      provider: "codex",
      sessionId: this.sessionId,
      ...(this.key.runId ? { runId: this.key.runId } : {}),
      details,
    };
  }

  async dispose(): Promise<void> {
    // Session-local state is scoped to the turn methods in this slice.
  }
}

export const codexRuntimeAdapter: RuntimeAdapter = {
  provider: "codex",
  createSession(key: RuntimeAdapterSessionKey): RuntimeAdapterSession {
    return new CodexRuntimeSession(key);
  },
  async listModels() {
    const snapshot = await getCodexProviderSnapshot();
    return mapRuntimeModels("codex", snapshot.models);
  },
  async checkHealth() {
    return (await getCodexProviderSnapshot()).health;
  },
};

/** Visible for testing — get the current connection */
export function _getConnection(): AppServerConnection | null {
  return connection;
}

/** Visible for testing — reset module state */
export function _resetConnection(): void {
  if (connection?.process && connection.process.exitCode === null) {
    try {
      connection.process.kill("SIGKILL");
    } catch {
      // Best-effort for tests.
    }
  }
  connection = null;
}
