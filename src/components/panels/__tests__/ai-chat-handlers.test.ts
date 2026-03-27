import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const aiChatHandlersPath = join(
  process.cwd(),
  "src/components/panels/ai-chat-handlers.ts",
);

describe("ai-chat-handlers", () => {
  it("does not import renderer-local context optimization or system prompt building", () => {
    const source = readFileSync(aiChatHandlersPath, "utf8");

    // The renderer should not build system prompts or trim history locally.
    // These responsibilities moved to the server-owned chat service in Phase 6.
    expect(source).not.toContain("trimChatHistory");
    expect(source).not.toContain("buildChatSystemPrompt");
    expect(source).not.toContain("buildEntityGraphContext");
    expect(source).not.toContain("BLANK_CANVAS_CHAT_SYSTEM_PROMPT");
  });
});
