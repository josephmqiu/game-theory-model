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
