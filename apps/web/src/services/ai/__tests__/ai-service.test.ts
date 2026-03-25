import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIStreamChunk } from "@/services/ai/ai-types";
import { streamChat } from "@/services/ai/ai-service";

function encodeSseEvent(event: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

async function collectChunks(
  generator: AsyncGenerator<AIStreamChunk>,
): Promise<AIStreamChunk[]> {
  const chunks: AIStreamChunk[] = [];
  for await (const chunk of generator) {
    chunks.push(chunk);
  }
  return chunks;
}

describe("ai-service streamChat", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not cancel the reader on normal terminal completion", async () => {
    const reader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: encodeSseEvent({ type: "done", content: "" }),
        })
        .mockResolvedValueOnce({
          done: true,
          value: undefined,
        }),
      cancel: vi.fn(),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => reader,
        },
      } as unknown as Response),
    );

    const chunks = await collectChunks(
      streamChat(
        "system",
        [{ role: "user", content: "hello" }],
        "claude-sonnet-4-5-20250929",
        undefined,
        "anthropic",
      ),
    );

    expect(chunks).toEqual([]);
    expect(reader.cancel).not.toHaveBeenCalled();
  });

  it("returns cleanly when the request is explicitly aborted", async () => {
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const abortController = new AbortController();
    const consume = collectChunks(
      streamChat(
        "system",
        [{ role: "user", content: "hello" }],
        "claude-sonnet-4-5-20250929",
        undefined,
        "anthropic",
        abortController.signal,
      ),
    );

    abortController.abort();

    await expect(consume).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
