import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const aiChatPanelPath = join(
  process.cwd(),
  "src/components/panels/ai-chat-panel.tsx",
);

describe("AIChatPanel thread projection wiring", () => {
  it("renders from projected thread detail and overlay messages instead of ai-store history", () => {
    const source = readFileSync(aiChatPanelPath, "utf8");

    expect(source).toContain("useThreadStore");
    expect(source).toContain("projectThreadMessagesToChatMessages");
    expect(source).toContain("activeThreadDetail?.messages");
    expect(source).toContain("overlayMessages");
    expect(source).not.toContain("const messages = useAIStore((s) => s.messages)");
    expect(source).not.toContain("const chatTitle = useAIStore((s) => s.chatTitle)");
  });

  it("creates a server-owned thread for the new chat action and lists threads for switching", () => {
    const source = readFileSync(aiChatPanelPath, "utf8");

    expect(source).toContain("const createThread = useThreadStore");
    expect(source).toContain("const selectThread = useThreadStore");
    expect(source).toContain("threads.map((thread) =>");
    expect(source).toContain("onClick={() => void createThread()}");
  });
});
