import { cleanupDir, fetchJson, formatLogs, mcpProxyEntryPath, requireFile, startBuiltServer } from "./_lib";
import { spawn } from "node:child_process";

interface JsonRpcResponse {
  error?: { message?: string };
  result?: {
    content?: Array<{ text?: string }>;
    tools?: Array<{ name?: string }>;
  };
}

async function proxyRoundTrip(
  payload: string,
  options?: { contentLength?: boolean; mcpPort?: number },
): Promise<string> {
  requireFile(mcpProxyEntryPath(), "Compiled MCP stdio proxy");

  const child = spawn("node", [mcpProxyEntryPath()], {
    env: {
      ...process.env,
      MCP_PORT: String(options?.mcpPort),
      NODE_ENV: "test",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stdout: string[] = [];
  const stderr: string[] = [];
  child.stdout.on("data", (chunk: Buffer | string) => stdout.push(chunk.toString()));
  child.stderr.on("data", (chunk: Buffer | string) => stderr.push(chunk.toString()));

  const framedPayload = options?.contentLength
    ? `Content-Length: ${Buffer.byteLength(payload, "utf-8")}\r\n\r\n${payload}`
    : `${payload}\n`;

  child.stdin.write(framedPayload);
  child.stdin.end();

  await new Promise<void>((resolveChild, rejectChild) => {
    child.once("error", rejectChild);
    child.once("close", (code) => {
      if (code !== 0) {
        rejectChild(
          new Error(
            `Proxy exited with code ${code ?? "unknown"}\nstdout:\n${stdout.join("")}\nstderr:\n${stderr.join("")}`,
          ),
        );
        return;
      }
      resolveChild();
    });
  });

  return stdout.join("");
}

function parseProxyResponse(output: string, contentLength = false): JsonRpcResponse {
  const body = contentLength ? output.split("\r\n\r\n")[1] ?? "" : output.trim();
  return JSON.parse(body) as JsonRpcResponse;
}

async function main(): Promise<void> {
  let started:
    | Awaited<ReturnType<typeof startBuiltServer>>
    | null = null;

  try {
    started = await startBuiltServer();

    const status = await fetchJson<{
      available: boolean;
      mcpAvailable: boolean;
      port: number;
      running: boolean;
    }>(`${started.baseUrl}/api/mcp/server`);

    if (!status.available || !status.mcpAvailable || status.port !== started.mcpPort) {
      throw new Error(`Unexpected MCP server status: ${JSON.stringify(status)}`);
    }

    const listOutput = await proxyRoundTrip(
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      { mcpPort: started.mcpPort },
    );
    const listResponse = parseProxyResponse(listOutput);
    const toolNames = (listResponse.result?.tools ?? [])
      .map((tool) => tool.name)
      .filter((toolName): toolName is string => typeof toolName === "string");
    if (!toolNames.includes("create_entity")) {
      throw new Error(`tools/list did not expose create_entity: ${JSON.stringify(listResponse)}`);
    }

    const createOutput = await proxyRoundTrip(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          arguments: {
            confidence: "high",
            data: {
              category: "action",
              content: "Smoke test entity",
              date: "2026-03-23",
              source: "smoke-test",
              type: "fact",
            },
            phase: "situational-grounding",
            rationale: "Created from MCP smoke test",
            type: "fact",
          },
          name: "create_entity",
        },
      }),
      { mcpPort: started.mcpPort },
    );
    const createResponse = parseProxyResponse(createOutput);
    const createPayload = createResponse.result?.content?.[0]?.text;
    if (!createPayload) {
      throw new Error(`create_entity did not return text content: ${JSON.stringify(createResponse)}`);
    }
    const createdEntityId = JSON.parse(createPayload).created?.[0]?.id as string | undefined;
    if (!createdEntityId) {
      throw new Error(`create_entity did not return an entity id: ${createPayload}`);
    }

    const getOutput = await proxyRoundTrip(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          arguments: { id: createdEntityId },
          name: "get_entity",
        },
      }),
      { mcpPort: started.mcpPort },
    );
    const getResponse = parseProxyResponse(getOutput);
    const getPayload = getResponse.result?.content?.[0]?.text;
    if (!getPayload) {
      throw new Error(`get_entity did not return text content: ${JSON.stringify(getResponse)}`);
    }
    const retrievedEntity = JSON.parse(getPayload) as { id: string };
    if (retrievedEntity.id !== createdEntityId) {
      throw new Error(`Expected get_entity id ${createdEntityId}, got ${retrievedEntity.id}`);
    }

    const contentLengthOutput = await proxyRoundTrip(
      JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/list" }),
      { contentLength: true, mcpPort: started.mcpPort },
    );
    if (!contentLengthOutput.includes("Content-Length:")) {
      throw new Error(`Expected Content-Length-framed output, got:\n${contentLengthOutput}`);
    }
    parseProxyResponse(contentLengthOutput, true);

    const forbiddenResponse = await fetch(`http://127.0.0.1:${started.mcpPort}/mcp`, {
      body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/list" }),
      headers: {
        "Content-Type": "application/json",
        Host: "forbidden.example:9999",
      },
      method: "POST",
    });
    if (forbiddenResponse.status !== 403) {
      throw new Error(`Expected 403 for forbidden host header, got ${forbiddenResponse.status}`);
    }

    console.log(
      JSON.stringify({
        ok: true,
        createdEntityId,
        toolCount: toolNames.length,
      }),
    );
  } catch (error) {
    const details =
      started === null
        ? error instanceof Error
          ? error.message
          : String(error)
        : `${error instanceof Error ? error.message : String(error)}\n${formatLogs(started.process)}`;
    console.error(details);
    process.exitCode = 1;
  } finally {
    if (started) {
      await started.process.stop();
      await cleanupDir(started.userDataDir);
    }
  }
}

await main();
