import { describe, expect, it } from "vitest";
import { getSearchProvider } from "../index";

describe("search provider registry", () => {
  it("returns the tavily provider", () => {
    expect(getSearchProvider("tavily").id).toBe("tavily");
  });

  it("returns the brave provider", () => {
    expect(getSearchProvider("brave").id).toBe("brave");
  });

  it("throws for an unknown provider id", () => {
    expect(() => getSearchProvider("duckduckgo" as never)).toThrow(
      /Unknown search provider/,
    );
  });
});
