import { describe, expect, it } from "vitest";
import {
  resolveAnalysisPromptTemplate,
  resolvePromptPack,
} from "../prompt-pack-registry";

describe("prompt-pack-registry", () => {
  it("resolves the bundled analysis prompt pack", () => {
    const pack = resolvePromptPack({
      analysisType: "game-theory",
      mode: "analysis-runtime",
    });

    expect(pack).toMatchObject({
      analysisType: "game-theory",
      mode: "analysis-runtime",
      id: "game-theory/default",
      version: "2026-03-25.1",
      source: {
        kind: "bundled",
      },
    });
    expect(pack.packHash).toEqual(expect.any(String));
  });

  it("resolves stable template identities for initial and revision variants", () => {
    const initial = resolveAnalysisPromptTemplate({
      analysisType: "game-theory",
      mode: "analysis-runtime",
      phase: "situational-grounding",
      variant: "initial",
    });
    const revision = resolveAnalysisPromptTemplate({
      analysisType: "game-theory",
      mode: "analysis-runtime",
      phase: "situational-grounding",
      variant: "revision",
    });

    expect(initial.pack.id).toBe("game-theory/default");
    expect(initial.pack.version).toBe("2026-03-25.1");
    expect(initial.templateIdentity).toBe(
      "game-theory/default:situational-grounding:initial",
    );
    expect(revision.pack.id).toBe("game-theory/default");
    expect(revision.pack.version).toBe("2026-03-25.1");
    expect(revision.templateIdentity).toBe(
      "game-theory/default:situational-grounding:revision",
    );
  });

  it("fails deterministically for unsupported modes and phases", () => {
    expect(() =>
      resolvePromptPack({
        analysisType: "game-theory",
        mode: "analysis-runtime-missing" as "analysis-runtime",
      }),
    ).toThrow(
      'Unsupported prompt pack for analysisType "game-theory" and mode "analysis-runtime-missing".',
    );

    expect(() =>
      resolveAnalysisPromptTemplate({
        analysisType: "game-theory",
        mode: "analysis-runtime",
        phase: "revalidation" as never,
        variant: "initial",
      }),
    ).toThrow(
      'Unsupported prompt template for phase "revalidation" and variant "initial" in pack "game-theory/default@2026-03-25.1".',
    );
  });
});
