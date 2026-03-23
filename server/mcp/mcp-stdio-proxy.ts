import { once } from "node:events";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
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
): Promise<string> {
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
      headers: { "Content-Type": "application/json" },
      body: line,
    });
    const text = await response.text();
    return text.trim();
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

  const readline = createInterface({
    input: stdin,
    crlfDelay: Infinity,
  });

  let writeQueue = Promise.resolve();
  const pending = new Set<Promise<void>>();

  readline.on("line", (line) => {
    const task = (async () => {
      const responseLine = await forwardJsonRpcMessage(line, options);
      const nextQueue = writeLine(stdout, `${responseLine}\n`, writeQueue);
      writeQueue = nextQueue.catch(() => {});
      await nextQueue;
    })();

    pending.add(task);
    void task.finally(() => {
      pending.delete(task);
    });
  });

  await once(readline, "close");
  await Promise.allSettled([...pending]);
}

async function main(): Promise<void> {
  const port = Number.parseInt(process.env.MCP_PORT ?? "", 10);
  await runProxy({
    port: Number.isNaN(port) ? MCP_DEFAULT_PORT : port,
  });
}

if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
