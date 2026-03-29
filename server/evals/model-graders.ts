import type { GraderResult } from "./eval-types";
import type { RuntimeAdapterChatEvent } from "../services/ai/runtime-adapter-events";

type StreamChatImpl = (
  userPrompt: string,
  systemPrompt: string,
  model: string,
) => AsyncIterable<RuntimeAdapterChatEvent>;

export async function runModelGraders(
  entities: unknown[],
  phase: string,
  rubrics: string[] | undefined,
  options?: {
    provider?: string;
    model?: string;
    relationships?: unknown[];
    streamChatImpl?: StreamChatImpl;
  },
): Promise<GraderResult[]> {
  if (!rubrics?.length) return [];

  const results: GraderResult[] = [];
  for (const rubric of rubrics) {
    try {
      const score = await gradeWithRubric(entities, phase, rubric, options);
      results.push({
        grader: `rubric:${rubric.slice(0, 50)}`,
        passed: score >= 0.5,
        score,
        message: score >= 0.7 ? "Passed rubric check" : "Failed rubric check",
      });
    } catch (err) {
      results.push({
        grader: `rubric:${rubric.slice(0, 50)}`,
        passed: false,
        score: 0,
        message: `Grader error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  return results;
}

/** Strip <thinking>...</thinking> blocks from response text. */
function stripThinkingTags(text: string): string {
  return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
}

async function gradeWithRubric(
  entities: unknown[],
  phase: string,
  rubric: string,
  options?: {
    provider?: string;
    model?: string;
    relationships?: unknown[];
    streamChatImpl?: StreamChatImpl;
  },
): Promise<number> {
  const streamChat =
    options?.streamChatImpl ??
    (await import("../services/ai/claude-adapter")).streamChat;

  const systemPrompt =
    "You are a strict evaluator of AI-generated game theory analysis. " +
    "Score outputs against criteria. Reason step-by-step inside <thinking> tags, " +
    "then output ONLY a JSON object outside the tags: " +
    '{ "score": <0.0-1.0>, "reasoning": "<one-line summary>" }';

  const parts = [
    `Phase: ${phase}`,
    "",
    "Entities produced:",
    JSON.stringify(entities, null, 2),
  ];

  if (options?.relationships?.length) {
    parts.push(
      "",
      "Relationships:",
      JSON.stringify(options.relationships, null, 2),
    );
  }

  parts.push(
    "",
    "Criterion to evaluate:",
    rubric,
    "",
    "Score 0.0 (criterion fully violated) to 1.0 (criterion fully met).",
  );

  const userPrompt = parts.join("\n");

  const model = options?.model ?? "claude-opus-4-20250514";

  let responseText = "";
  for await (const event of streamChat(userPrompt, systemPrompt, model)) {
    if (event.type === "text_delta") {
      responseText += event.content;
    }
  }

  // Strip thinking blocks before extracting score
  const cleanText = stripThinkingTags(responseText);
  const match = cleanText.match(/"score"\s*:\s*([\d.]+)/);
  const score = match ? Math.min(1, Math.max(0, parseFloat(match[1]))) : 0;
  return score;
}
