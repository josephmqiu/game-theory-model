import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ANALYSIS_TYPE,
  DEFAULT_PROMPT_PACK_ID,
  DEFAULT_PROMPT_PACK_MODE,
  DEFAULT_PROMPT_PACK_VERSION,
} from "../../../shared/types/prompt-pack";
import {
  resolveAnalysisPromptTemplate,
  resolvePromptPack,
  resolvePromptTemplate,
} from "../prompt-pack-registry";

function createPackFixtureRoot(
  root: string,
  options: {
    id: string;
    version: string;
    promptText: string;
    sourceKind?: "bundled" | "filesystem";
  },
): string {
  const manifestDir = join(
    root,
    DEFAULT_ANALYSIS_TYPE,
    DEFAULT_PROMPT_PACK_MODE,
  );
  const promptsDir = join(manifestDir, "prompts");
  mkdirSync(join(promptsDir, "situational-grounding"), { recursive: true });

  writeFileSync(
    join(promptsDir, "situational-grounding", "initial.md"),
    options.promptText,
    "utf8",
  );
  writeFileSync(
    join(promptsDir, "situational-grounding", "revision.md"),
    `${options.promptText} revision`,
    "utf8",
  );

  writeFileSync(
    join(manifestDir, "pack.json"),
    JSON.stringify(
      {
        analysisType: DEFAULT_ANALYSIS_TYPE,
        mode: DEFAULT_PROMPT_PACK_MODE,
        id: options.id,
        version: options.version,
        source: {
          kind: options.sourceKind ?? "bundled",
        },
        phases: [
          {
            phase: "situational-grounding",
            objective: "Ground the situation before naming the game.",
            doneCondition:
              "The analysis has enough facts to identify players and constraints.",
            toolPolicy: {
              enabledAnalysisTools: [
                "get_entity",
                "query_entities",
                "query_relationships",
                "request_loopback",
              ],
              webSearch: true,
            },
          },
        ],
        templateFiles: [
          {
            phase: "situational-grounding",
            variant: "initial",
            path: "prompts/situational-grounding/initial.md",
          },
          {
            phase: "situational-grounding",
            variant: "revision",
            path: "prompts/situational-grounding/revision.md",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  return manifestDir;
}

function makeTempRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("prompt-pack-registry", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("resolves the bundled analysis prompt pack from disk", () => {
    const pack = resolvePromptPack({
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: DEFAULT_PROMPT_PACK_MODE,
    });

    expect(pack).toMatchObject({
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: DEFAULT_PROMPT_PACK_MODE,
      id: DEFAULT_PROMPT_PACK_ID,
      version: DEFAULT_PROMPT_PACK_VERSION,
      source: {
        kind: "bundled",
      },
    });
    expect(pack.source.path).toContain(
      join(
        "server",
        "prompt-packs",
        DEFAULT_ANALYSIS_TYPE,
        DEFAULT_PROMPT_PACK_MODE,
        "pack.json",
      ),
    );
    expect(pack.packHash).toEqual(expect.any(String));
    expect(pack.phases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "situational-grounding",
          toolPolicy: expect.objectContaining({
            enabledAnalysisTools: expect.arrayContaining([
              "query_entities",
              "query_relationships",
            ]),
          }),
        }),
      ]),
    );
  });

  it("prefers filesystem overrides over the packaged prompt pack", () => {
    const filesystemRoot = makeTempRoot("prompt-pack-filesystem-");
    const packagedRoot = makeTempRoot("prompt-pack-packaged-");
    tempRoots.push(filesystemRoot, packagedRoot);

    createPackFixtureRoot(filesystemRoot, {
      id: "game-theory/override",
      version: "2026-03-25.2",
      promptText: "filesystem override prompt",
      sourceKind: "filesystem",
    });
    createPackFixtureRoot(packagedRoot, {
      id: DEFAULT_PROMPT_PACK_ID,
      version: DEFAULT_PROMPT_PACK_VERSION,
      promptText: "packaged prompt",
    });

    const pack = resolvePromptPack({
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: DEFAULT_PROMPT_PACK_MODE,
      roots: {
        filesystemRoot,
        packagedRoot,
      },
    });

    expect(pack).toMatchObject({
      id: "game-theory/override",
      version: "2026-03-25.2",
      source: {
        kind: "filesystem",
        path: expect.stringContaining(
          join(DEFAULT_ANALYSIS_TYPE, DEFAULT_PROMPT_PACK_MODE, "pack.json"),
        ),
      },
    });
    expect(
      pack.templates.find(
        (template) =>
          template.phase === "situational-grounding" &&
          template.variant === "initial",
      )?.text,
    ).toBe("filesystem override prompt");
  });

  it("resolves stable template identities for initial and revision variants", () => {
    const initial = resolveAnalysisPromptTemplate({
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: DEFAULT_PROMPT_PACK_MODE,
      phase: "situational-grounding",
      variant: "initial",
    });
    const revision = resolveAnalysisPromptTemplate({
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: DEFAULT_PROMPT_PACK_MODE,
      phase: "situational-grounding",
      variant: "revision",
    });

    expect(initial.pack.id).toBe(DEFAULT_PROMPT_PACK_ID);
    expect(initial.pack.version).toBe(DEFAULT_PROMPT_PACK_VERSION);
    expect(initial.templateIdentity).toBe(
      `${DEFAULT_PROMPT_PACK_ID}:situational-grounding:initial`,
    );
    expect(revision.pack.id).toBe(DEFAULT_PROMPT_PACK_ID);
    expect(revision.pack.version).toBe(DEFAULT_PROMPT_PACK_VERSION);
    expect(revision.templateIdentity).toBe(
      `${DEFAULT_PROMPT_PACK_ID}:situational-grounding:revision`,
    );
  });

  it("fails clearly when a prompt file is missing", () => {
    const filesystemRoot = makeTempRoot("prompt-pack-invalid-");
    tempRoots.push(filesystemRoot);

    const manifestDir = join(
      filesystemRoot,
      DEFAULT_ANALYSIS_TYPE,
      DEFAULT_PROMPT_PACK_MODE,
    );
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "pack.json"),
      JSON.stringify({
        analysisType: DEFAULT_ANALYSIS_TYPE,
        mode: DEFAULT_PROMPT_PACK_MODE,
        id: DEFAULT_PROMPT_PACK_ID,
        version: DEFAULT_PROMPT_PACK_VERSION,
        source: {
          kind: "filesystem",
        },
        templateFiles: [
          {
            phase: "situational-grounding",
            variant: "initial",
            path: "prompts/situational-grounding/initial.md",
          },
        ],
      }),
      "utf8",
    );

    expect(() =>
      resolvePromptPack({
        analysisType: DEFAULT_ANALYSIS_TYPE,
        mode: DEFAULT_PROMPT_PACK_MODE,
        roots: {
          filesystemRoot,
          packagedRoot: (() => {
            const root = makeTempRoot("prompt-pack-empty-packaged-");
            tempRoots.push(root);
            return root;
          })(),
        },
      }),
    ).toThrow(
      /Prompt-pack template file not found at ".*situational-grounding\/initial\.md"/,
    );
  });

  it("fails deterministically for unsupported modes and phases", () => {
    expect(() =>
      resolvePromptPack({
        analysisType: DEFAULT_ANALYSIS_TYPE,
        mode: "analysis-runtime-missing" as "analysis-runtime",
      }),
    ).toThrow(
      'Unsupported prompt pack for analysisType "game-theory" and mode "analysis-runtime-missing".',
    );

    expect(() =>
      resolveAnalysisPromptTemplate({
        analysisType: DEFAULT_ANALYSIS_TYPE,
        mode: DEFAULT_PROMPT_PACK_MODE,
        phase: "revalidation" as never,
        variant: "initial",
      }),
    ).toThrow(
      `Unsupported prompt template for phase "revalidation" and variant "initial" in pack "${DEFAULT_PROMPT_PACK_ID}@${DEFAULT_PROMPT_PACK_VERSION}".`,
    );
  });

  it("resolves the bundled synthesis prompt pack from disk", () => {
    const pack = resolvePromptPack({
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: "synthesis",
    });

    expect(pack).toMatchObject({
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: "synthesis",
      id: "game-theory/synthesis-default",
      version: "2026-03-25.1",
      source: { kind: "bundled" },
    });
    expect(pack.templates.length).toBeGreaterThanOrEqual(1);
    const systemTemplate = pack.templates.find(
      (t) => t.phase === "system" && t.variant === "initial",
    );
    expect(systemTemplate).toBeDefined();
    expect(systemTemplate!.text).toContain("executive_summary");
    expect(systemTemplate!.text).toContain("entity_references");
  });

  it("resolves the bundled chat prompt pack with both templates", () => {
    const pack = resolvePromptPack({
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: "chat",
    });

    expect(pack).toMatchObject({
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: "chat",
      id: "game-theory/chat-default",
      version: "2026-03-25.1",
      source: { kind: "bundled" },
    });
    expect(pack.templates.length).toBe(2);

    const withAnalysis = pack.templates.find(
      (t) => t.phase === "system-with-analysis",
    );
    const emptyCanvas = pack.templates.find(
      (t) => t.phase === "system-empty-canvas",
    );
    expect(withAnalysis).toBeDefined();
    expect(withAnalysis!.text).toContain("entity graph analysis");
    expect(emptyCanvas).toBeDefined();
    expect(emptyCanvas!.text).toContain("canvas is currently blank");
  });

  it("resolves a template by generic templateId via resolvePromptTemplate", () => {
    const result = resolvePromptTemplate({
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: "synthesis",
      templateId: "system",
      variant: "initial",
    });

    expect(result.templateIdentity).toBe(
      "game-theory/synthesis-default:system:initial",
    );
    expect(result.templateHash).toEqual(expect.any(String));
    expect(result.text).toContain("executive_summary");
    expect(result.pack.id).toBe("game-theory/synthesis-default");
  });

  it("resolvePromptTemplate works for chat mode templates", () => {
    const withAnalysis = resolvePromptTemplate({
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: "chat",
      templateId: "system-with-analysis",
      variant: "initial",
    });
    const emptyCanvas = resolvePromptTemplate({
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: "chat",
      templateId: "system-empty-canvas",
      variant: "initial",
    });

    expect(withAnalysis.templateIdentity).toBe(
      "game-theory/chat-default:system-with-analysis:initial",
    );
    expect(emptyCanvas.templateIdentity).toBe(
      "game-theory/chat-default:system-empty-canvas:initial",
    );
  });

  it("filesystem overrides work for synthesis mode", () => {
    const filesystemRoot = makeTempRoot("prompt-pack-synth-override-");
    tempRoots.push(filesystemRoot);

    const manifestDir = join(
      filesystemRoot,
      DEFAULT_ANALYSIS_TYPE,
      "synthesis",
    );
    const promptsDir = join(manifestDir, "prompts", "system");
    mkdirSync(promptsDir, { recursive: true });

    writeFileSync(
      join(promptsDir, "initial.md"),
      "Custom synthesis prompt with executive_summary",
      "utf8",
    );
    writeFileSync(
      join(manifestDir, "pack.json"),
      JSON.stringify({
        analysisType: DEFAULT_ANALYSIS_TYPE,
        mode: "synthesis",
        id: "game-theory/synthesis-custom",
        version: "2026-03-25.99",
        source: { kind: "filesystem" },
        templateFiles: [
          {
            phase: "system",
            variant: "initial",
            path: "prompts/system/initial.md",
          },
        ],
      }),
      "utf8",
    );

    const pack = resolvePromptPack({
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: "synthesis",
      roots: { filesystemRoot },
    });

    expect(pack.id).toBe("game-theory/synthesis-custom");
    expect(pack.source.kind).toBe("filesystem");
    expect(pack.templates[0].text).toBe(
      "Custom synthesis prompt with executive_summary",
    );
  });

  it("rejects path traversal in template file paths", () => {
    const root = mkdtempSync(join(tmpdir(), "prompt-pack-traversal-"));
    tempRoots.push(root);

    const manifestDir = join(
      root,
      DEFAULT_ANALYSIS_TYPE,
      DEFAULT_PROMPT_PACK_MODE,
    );
    mkdirSync(manifestDir, { recursive: true });

    const manifest = {
      analysisType: DEFAULT_ANALYSIS_TYPE,
      mode: DEFAULT_PROMPT_PACK_MODE,
      id: "traversal-test",
      version: "1.0.0",
      templateFiles: [
        {
          phase: "situational-grounding",
          variant: "initial",
          path: "../../etc/passwd",
        },
      ],
    };
    writeFileSync(
      join(manifestDir, "pack.json"),
      JSON.stringify(manifest),
      "utf8",
    );

    expect(() =>
      resolvePromptPack({
        analysisType: DEFAULT_ANALYSIS_TYPE,
        mode: DEFAULT_PROMPT_PACK_MODE,
        roots: { packagedRoot: root },
      }),
    ).toThrow(/Path traversal detected/);
  });
});
