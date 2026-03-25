import { describe, it, expect, afterEach } from "vitest";
import { parseArgs } from "../run-eval";

describe("parseArgs", () => {
  const originalArgv = process.argv;
  afterEach(() => {
    process.argv = originalArgv;
  });

  it("parses --fixture and --phase flags", () => {
    process.argv = [
      "bun",
      "run-eval.ts",
      "--fixture",
      "rps",
      "--phase",
      "assumptions",
    ];
    const args = parseArgs();
    expect(args.fixture).toBe("rps");
    expect(args.phase).toBe("assumptions");
  });

  it("sets fast and chain boolean flags", () => {
    process.argv = ["bun", "run-eval.ts", "--fast", "--chain"];
    const args = parseArgs();
    expect(args.fast).toBe(true);
    expect(args.chain).toBe(true);
  });

  it("defaults trials to 3", () => {
    process.argv = ["bun", "run-eval.ts"];
    const args = parseArgs();
    expect(args.trials).toBe(3);
  });
});
