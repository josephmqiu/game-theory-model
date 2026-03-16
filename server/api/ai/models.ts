interface ModelInfo {
  value: string;
  displayName: string;
  description: string;
}

const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    value: "claude-sonnet-4-20250514",
    displayName: "Claude Sonnet 4",
    description:
      "Best balance of speed and capability for coding and analysis.",
  },
  {
    value: "claude-opus-4-20250514",
    displayName: "Claude Opus 4",
    description:
      "Deepest reasoning for complex architectural and analytical tasks.",
  },
  {
    value: "claude-haiku-4-20250514",
    displayName: "Claude Haiku 4",
    description: "Fast and cost-effective for lightweight tasks.",
  },
];

import { defineEventHandler } from "h3";

/**
 * Returns the list of available Anthropic models.
 */
export default defineEventHandler(() => {
  return { models: ANTHROPIC_MODELS };
});
