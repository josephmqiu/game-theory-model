import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const aiChatHandlersPath = join(
  process.cwd(),
  "src/components/panels/ai-chat-handlers.ts",
);

describe("useChatHandlers canonical refresh", () => {
  it("refreshes projected thread data after a streamed turn completes", () => {
    const source = readFileSync(aiChatHandlersPath, "utf8");

    expect(source).toContain("refreshThreads()");
    expect(source).toContain("refreshActiveThreadDetail()");
    expect(source).toContain("setActiveThreadIdentity(identity)");
    expect(source).toContain("clearOverlayMessages()");
  });
});
