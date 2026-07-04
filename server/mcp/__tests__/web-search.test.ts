import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../agents/analysis-agent", () => ({
  runFull: vi.fn(),
  getActiveStatus: vi.fn(() => null),
  abort: vi.fn(),
}));

vi.mock("../../services/revalidation-service", () => ({
  getActiveRevalStatus: vi.fn(() => null),
  revalidate: vi.fn(),
  getRevalStatus: vi.fn(() => null),
}));

vi.mock("../../utils/ai-logger", () => ({
  serverLog: vi.fn(),
  serverWarn: vi.fn(),
  serverError: vi.fn(),
}));

// Control which provider the handler resolves; config-cache stays real.
const searchMock = vi.fn();
vi.mock("../../services/search", () => ({
  getSearchProvider: vi.fn(() => ({ id: "tavily", search: searchMock })),
}));

async function loadHandler() {
  const { setSearchConfig } =
    await import("../../services/search/config-cache");
  const { handleWebSearch, handleToolCall } = await import("../product-tools");
  return { setSearchConfig, handleWebSearch, handleToolCall };
}

describe("web_search handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an isError message when search is not configured", async () => {
    const { setSearchConfig, handleWebSearch } = await loadHandler();
    setSearchConfig({ provider: null, apiKey: null });

    const result = await handleWebSearch({ query: "anything" });

    expect(result.isError).toBe(true);
    expect(result.text).toContain("not configured");
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("formats results as a numbered list when configured", async () => {
    const { setSearchConfig, handleWebSearch } = await loadHandler();
    setSearchConfig({ provider: "tavily", apiKey: "k" });
    searchMock.mockResolvedValueOnce([
      { title: "First", url: "https://one.example", snippet: "s1" },
      { title: "Second", url: "https://two.example", snippet: "s2" },
    ]);

    const result = await handleWebSearch({ query: "chips", max_results: 2 });

    expect(result.isError).toBe(false);
    expect(searchMock).toHaveBeenCalledWith("chips", {
      apiKey: "k",
      maxResults: 2,
    });
    expect(result.text).toContain("1. First");
    expect(result.text).toContain("https://one.example");
    expect(result.text).toContain("2. Second");
  });

  it("caps max_results at 10", async () => {
    const { setSearchConfig, handleWebSearch } = await loadHandler();
    setSearchConfig({ provider: "tavily", apiKey: "k" });
    searchMock.mockResolvedValueOnce([]);

    await handleWebSearch({ query: "chips", max_results: 999 });

    expect(searchMock).toHaveBeenCalledWith("chips", {
      apiKey: "k",
      maxResults: 10,
    });
  });

  it("returns an isError message when the provider throws", async () => {
    const { setSearchConfig, handleWebSearch } = await loadHandler();
    setSearchConfig({ provider: "tavily", apiKey: "k" });
    searchMock.mockRejectedValueOnce(
      new Error("Tavily search failed (HTTP 500)"),
    );

    const result = await handleWebSearch({ query: "chips" });

    expect(result.isError).toBe(true);
    expect(result.text).toContain("Web search failed");
    expect(result.text).toContain("HTTP 500");
  });

  it("propagates isError through handleToolCall dispatch", async () => {
    const { setSearchConfig, handleToolCall } = await loadHandler();
    setSearchConfig({ provider: null, apiKey: null });

    const result = await handleToolCall("web_search", { query: "x" });

    expect(result.isError).toBe(true);
    expect(result.text).toContain("not configured");
  });
});
