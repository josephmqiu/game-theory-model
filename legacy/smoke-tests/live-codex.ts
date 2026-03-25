import { getFreePort } from "./_lib";
import { startMcpServer } from "../server/mcp/mcp-server";
import { connectCodexCli } from "../server/api/ai/connect-agent";
import { stopAppServer, streamChat } from "../server/services/ai/codex-adapter";

function liveProbeEnabled(flag: string): boolean {
  return (
    process.env.GAME_THEORY_ENABLE_LIVE_RUNTIME_TESTS === "1" ||
    process.env[flag] === "1"
  );
}

async function collectProbeResult(model: string): Promise<void> {
  let sawCompletion = false;
  let sawText = false;

  for await (const event of streamChat(
    "Reply with the word OK and nothing else.",
    "You are concise.",
    model,
    { timeoutMs: 30_000 },
  )) {
    if (event.type === "error") {
      throw new Error(`Codex live probe failed: ${event.message}`);
    }
    if (event.type === "text_delta" && event.content.trim().length > 0) {
      sawText = true;
    }
    if (event.type === "turn_complete") {
      sawCompletion = true;
      break;
    }
  }

  if (!sawCompletion) {
    throw new Error("Codex live probe never completed a turn");
  }
  if (!sawText) {
    throw new Error("Codex live probe completed without any text output");
  }
}

async function main(): Promise<void> {
  if (!liveProbeEnabled("GAME_THEORY_ENABLE_LIVE_CODEX_TEST")) {
    console.log(
      "Skipping Codex live probe. Set GAME_THEORY_ENABLE_LIVE_RUNTIME_TESTS=1 or GAME_THEORY_ENABLE_LIVE_CODEX_TEST=1 to enable.",
    );
    return;
  }

  const mcpPort = await getFreePort();
  process.env.MCP_PORT = String(mcpPort);

  const mcpHandle = await startMcpServer(mcpPort);
  if (!mcpHandle.available) {
    throw new Error("Failed to start in-process MCP server for Codex live probe");
  }

  try {
    const result = await connectCodexCli();
    if (!result.connected) {
      throw new Error(
        result.notInstalled
          ? "Codex CLI not installed"
          : `Codex runtime misconfigured: ${result.error ?? "unknown error"}`,
      );
    }

    const model =
      process.env.GAME_THEORY_LIVE_CODEX_MODEL?.trim() ||
      result.models[0]?.value;
    if (!model) {
      throw new Error("Codex live probe could not determine a model to use");
    }

    await collectProbeResult(model);
    console.log(JSON.stringify({ ok: true, mcpPort, model }));
  } finally {
    await stopAppServer();
    await mcpHandle.close();
  }
}

await main();
