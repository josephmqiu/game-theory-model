import { connectClaudeCode } from "../server/api/ai/connect-agent";
import { streamChat } from "../server/services/ai/claude-adapter";

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
      throw new Error(`Claude live probe failed: ${event.error.message}`);
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
    throw new Error("Claude live probe never completed a turn");
  }
  if (!sawText) {
    throw new Error("Claude live probe completed without any text output");
  }
}

async function main(): Promise<void> {
  if (!liveProbeEnabled("GAME_THEORY_ENABLE_LIVE_CLAUDE_TEST")) {
    console.log(
      "Skipping Claude live probe. Set GAME_THEORY_ENABLE_LIVE_RUNTIME_TESTS=1 or GAME_THEORY_ENABLE_LIVE_CLAUDE_TEST=1 to enable.",
    );
    return;
  }

  const result = await connectClaudeCode();
  if (!result.connected) {
    throw new Error(
      result.notInstalled
        ? "Claude Code CLI not installed"
        : `Claude runtime misconfigured: ${result.error ?? "unknown error"}`,
    );
  }

  const model =
    process.env.GAME_THEORY_LIVE_CLAUDE_MODEL?.trim() ||
    result.models[0]?.value;
  if (!model) {
    throw new Error("Claude live probe could not determine a model to use");
  }

  await collectProbeResult(model);
  console.log(JSON.stringify({ ok: true, model }));
}

await main();
