import { afterEach, describe, expect, it, vi } from "vitest";
import { tavilyProvider } from "../tavily";

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("tavilyProvider", () => {
  it("POSTs the key in the body and maps content -> snippet", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        results: [
          { title: "T1", url: "https://a.example", content: "snippet a" },
          { title: "T2", url: "https://b.example", content: "snippet b" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await tavilyProvider.search("chip tariffs", {
      apiKey: "secret-key",
      maxResults: 3,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.tavily.com/search");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      api_key: "secret-key",
      query: "chip tariffs",
      max_results: 3,
    });
    expect(results).toEqual([
      { title: "T1", url: "https://a.example", snippet: "snippet a" },
      { title: "T2", url: "https://b.example", snippet: "snippet b" },
    ]);
  });

  it("throws with status + body snippet on non-2xx, without leaking the key", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        { detail: "usage limit exceeded" },
        { ok: false, status: 429 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      tavilyProvider.search("q", { apiKey: "secret-key", maxResults: 5 }),
    ).rejects.toThrow(/429/);
    await expect(
      tavilyProvider.search("q", { apiKey: "secret-key", maxResults: 5 }),
    ).rejects.not.toThrow(/secret-key/);
  });

  it("aborts the request after the timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            ),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = tavilyProvider.search("q", {
      apiKey: "secret-key",
      maxResults: 5,
    });
    const assertion = expect(promise).rejects.toThrow(/abort/i);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });
});
