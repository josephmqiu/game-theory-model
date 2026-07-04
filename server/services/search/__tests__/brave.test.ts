import { afterEach, describe, expect, it, vi } from "vitest";
import { braveProvider } from "../brave";

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

describe("braveProvider", () => {
  it("GETs with the key in X-Subscription-Token and maps description -> snippet", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        web: {
          results: [
            {
              title: "B1",
              url: "https://a.example",
              description: "desc a",
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await braveProvider.search("chip tariffs", {
      apiKey: "brave-key",
      maxResults: 4,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    const requestUrl = new URL(String(url));
    expect(requestUrl.origin + requestUrl.pathname).toBe(
      "https://api.search.brave.com/res/v1/web/search",
    );
    expect(requestUrl.searchParams.get("q")).toBe("chip tariffs");
    expect(requestUrl.searchParams.get("count")).toBe("4");
    expect(init.method).toBe("GET");
    expect(
      (init.headers as Record<string, string>)["X-Subscription-Token"],
    ).toBe("brave-key");
    expect(results).toEqual([
      { title: "B1", url: "https://a.example", snippet: "desc a" },
    ]);
  });

  it("throws with status on non-2xx, without leaking the key", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ message: "unauthorized" }, { ok: false, status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      braveProvider.search("q", { apiKey: "brave-key", maxResults: 5 }),
    ).rejects.toThrow(/401/);
    await expect(
      braveProvider.search("q", { apiKey: "brave-key", maxResults: 5 }),
    ).rejects.not.toThrow(/brave-key/);
  });

  it("aborts the request after the timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: URL, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            ),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = braveProvider.search("q", {
      apiKey: "brave-key",
      maxResults: 5,
    });
    const assertion = expect(promise).rejects.toThrow(/abort/i);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });
});
