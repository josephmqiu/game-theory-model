import { once } from "node:events";
import type { Readable, Writable } from "node:stream";
import { MCP_DEFAULT_PORT } from "../../src/constants/app";

interface JsonRpcRequestLike {
  id?: string | number | null;
}

export interface ProxyRuntimeOptions {
  fetchImpl?: typeof fetch;
  host?: string;
  port?: number;
  path?: string;
  stdin?: Readable;
  stdout?: Writable;
  stderr?: Writable;
}

type InputFraming = "content-length" | "line";

function buildEndpoint({
  host = "127.0.0.1",
  port = MCP_DEFAULT_PORT,
  path = "/mcp",
}: ProxyRuntimeOptions): string {
  return `http://${host}:${port}${path}`;
}

function buildJsonRpcError(
  id: string | number | null | undefined,
  message: string,
) {
  return {
    jsonrpc: "2.0" as const,
    id: id ?? null,
    error: {
      code: -32000,
      message,
    },
  };
}

async function writeLine(
  stream: Writable,
  line: string,
  queue: Promise<void>,
): Promise<void> {
  await queue;
  await new Promise<void>((resolve, reject) => {
    stream.write(line, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function formatOutputMessage(
  message: string,
  framing: InputFraming,
): string {
  if (framing === "content-length") {
    const byteLength = Buffer.byteLength(message, "utf-8");
    return `Content-Length: ${byteLength}\r\n\r\n${message}`;
  }

  return `${message}\n`;
}

function extractNextMessage(buffer: string): {
  message: string;
  remaining: string;
  framing: InputFraming;
} | null {
  if (buffer.length === 0) {
    return null;
  }

  const trimmedLeading = buffer.replace(/^\s+/, "");
  if (trimmedLeading.length === 0) {
    return null;
  }

  if (/^Content-Length:/i.test(trimmedLeading)) {
    const headerEnd = trimmedLeading.indexOf("\r\n\r\n");
    const separatorLength = 4;
    const fallbackHeaderEnd = trimmedLeading.indexOf("\n\n");
    const normalizedHeaderEnd =
      headerEnd >= 0 ? headerEnd : fallbackHeaderEnd;
    const normalizedSeparatorLength =
      headerEnd >= 0 ? separatorLength : fallbackHeaderEnd >= 0 ? 2 : 0;

    if (normalizedHeaderEnd < 0) {
      return null;
    }

    const headerBlock = trimmedLeading.slice(0, normalizedHeaderEnd);
    const match = headerBlock.match(/^Content-Length:\s*(\d+)/im);
    if (!match) {
      throw new Error("Missing Content-Length header");
    }

    const bodyLength = Number.parseInt(match[1], 10);
    const bodyStart = normalizedHeaderEnd + normalizedSeparatorLength;
    const availableBody = trimmedLeading.slice(bodyStart);
    if (Buffer.byteLength(availableBody, "utf-8") < bodyLength) {
      return null;
    }

    const message = Buffer.from(availableBody, "utf-8")
      .subarray(0, bodyLength)
      .toString("utf-8");
    const remainingBody = Buffer.from(availableBody, "utf-8")
      .subarray(bodyLength)
      .toString("utf-8");

    return {
      message,
      remaining: remainingBody,
      framing: "content-length",
    };
  }

  const newlineIndex = buffer.indexOf("\n");
  if (newlineIndex >= 0) {
    const message = buffer.slice(0, newlineIndex).trim();
    return {
      message,
      remaining: buffer.slice(newlineIndex + 1),
      framing: "line",
    };
  }

  return null;
}

export async function verifyNitroReachable(
  options: ProxyRuntimeOptions = {},
): Promise<boolean> {
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    await fetchImpl(buildEndpoint(options), { method: "GET" });
    return true;
  } catch {
    return false;
  }
}

export async function forwardJsonRpcMessage(
  line: string,
  options: ProxyRuntimeOptions = {},
): Promise<string | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let parsed: JsonRpcRequestLike;

  try {
    parsed = JSON.parse(line) as JsonRpcRequestLike;
  } catch {
    return JSON.stringify(buildJsonRpcError(null, "Invalid JSON-RPC input"));
  }

  try {
    const response = await fetchImpl(buildEndpoint(options), {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: line,
    });
    const text = await response.text();
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (error) {
    return JSON.stringify(
      buildJsonRpcError(
        parsed.id,
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
}

export async function runProxy(options: ProxyRuntimeOptions = {}): Promise<void> {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  const reachable = await verifyNitroReachable(options);
  if (!reachable) {
    stderr.write(
      `Nitro MCP endpoint is unreachable at ${buildEndpoint(options)}\n`,
    );
    throw new Error("Nitro MCP endpoint is unreachable");
  }

  let writeQueue = Promise.resolve();
  const pending = new Set<Promise<void>>();
  let inputBuffer = "";

  const scheduleMessage = (line: string, framing: InputFraming) => {
    if (!line.trim()) {
      return;
    }

    const task = (async () => {
      const responseLine = await forwardJsonRpcMessage(line, options);
      if (!responseLine) {
        return;
      }
      const nextQueue = writeLine(
        stdout,
        formatOutputMessage(responseLine, framing),
        writeQueue,
      );
      writeQueue = nextQueue.catch(() => {});
      await nextQueue;
    })();

    pending.add(task);
    void task.finally(() => {
      pending.delete(task);
    });
  };

  stdin.on("data", (chunk: string | Buffer) => {
    inputBuffer += Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : chunk;

    while (true) {
      const extracted = extractNextMessage(inputBuffer);
      if (!extracted) {
        break;
      }

      inputBuffer = extracted.remaining;
      scheduleMessage(extracted.message, extracted.framing);
    }
  });

  await once(stdin, "end");
  const trailing = inputBuffer.trim();
  if (trailing) {
    scheduleMessage(trailing, "line");
  }
  await Promise.allSettled([...pending]);
}

async function main(): Promise<void> {
  const port = Number.parseInt(process.env.MCP_PORT ?? "", 10);
  await runProxy({
    port: Number.isNaN(port) ? MCP_DEFAULT_PORT : port,
  });
}

function isDirectExecution(): boolean {
  if (typeof process === "undefined" || !process.argv[1]) {
    return false;
  }

  const cjsGlobals = globalThis as typeof globalThis & {
    require?: { main?: unknown };
    module?: unknown;
  };

  if (
    typeof cjsGlobals.require !== "undefined" &&
    typeof cjsGlobals.module !== "undefined" &&
    cjsGlobals.require.main === cjsGlobals.module
  ) {
    return true;
  }

  return /(^|\/)mcp-stdio-proxy\.(?:c|m)?js$|(^|\/)mcp-stdio-proxy\.ts$/i.test(
    process.argv[1],
  );
}

if (isDirectExecution()) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
