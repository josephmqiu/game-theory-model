import type { GraderResult } from "./eval-types";

type StreamChatImpl = (
  userPrompt: string,
  systemPrompt: string,
  model: string,
) => AsyncIterable<{ type: string; content?: string }>;

export async function runModelGraders(
  entities: unknown[],
  phase: string,
  rubrics: string[] | undefined,
  options?: {
    provider?: string;
    model?: string;
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

async function gradeWithRubric(
  entities: unknown[],
  phase: string,
  rubric: string,
  options?: {
    provider?: string;
    model?: string;
    streamChatImpl?: StreamChatImpl;
  },
): Promise<number> {
  const streamChat =
    options?.streamChatImpl ??
    (await import("../services/ai/claude-adapter")).streamChat;

  const systemPrompt =
    "You are a strict evaluator of AI-generated game theory analysis. " +
    "Score outputs against criteria. Respond with ONLY a JSON object: " +
    '{ "score": <0.0-1.0>, "reasoning": "<explanation>" }';

  const userPrompt = [
    `Phase: ${phase}`,
    "",
    "Entities produced:",
    JSON.stringify(entities, null, 2),
    "",
    "Criterion to evaluate:",
    rubric,
    "",
    "Score 0.0 (criterion fully violated) to 1.0 (criterion fully met).",
  ].join("\n");

  const model = options?.model ?? "claude-opus-4-20250514";

  // streamChat is AsyncGenerator<ChatEvent>
  // ChatEvent = { type: "text_delta"; content: string } | { type: "turn_complete" } | ...
  let responseText = "";
  for await (const event of streamChat(userPrompt, systemPrompt, model)) {
    if (event.type === "text_delta") {
      responseText += event.content;
    }
  }

  const match = responseText.match(/"score"\s*:\s*([\d.]+)/);
  const score = match ? Math.min(1, Math.max(0, parseFloat(match[1]))) : 0;
  return score;
}
