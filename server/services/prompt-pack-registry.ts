import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import type { MethodologyPhase } from "../../shared/types/methodology";
import type {
  PromptPackDefinition,
  PromptPackFileManifest,
  PromptPackMode,
  PromptPackSourceRef,
  PromptTemplateFileDefinition,
  PromptTemplateVariant,
  ResolvedPromptPack,
  ResolvedPromptTemplate,
} from "../../shared/types/prompt-pack";
import { DEFAULT_PROMPT_PACK_MODE } from "../../shared/types/prompt-pack";
import { hashText } from "../utils/hash-text";

export interface PromptPackResolutionRoots {
  packagedRoot?: string;
  filesystemRoot?: string;
}

function defaultPackagedRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "prompt-packs");
}

function defaultFilesystemRoot(): string {
  return join(homedir(), ".gta", "analysis-types");
}

function manifestPathFor(root: string, analysisType: string, mode: PromptPackMode): string {
  return join(root, analysisType, mode, "pack.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertStringField(
  value: unknown,
  fieldName: string,
  manifestPath: string,
): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  throw new Error(
    `Invalid prompt-pack manifest at "${manifestPath}": missing or invalid "${fieldName}".`,
  );
}

function assertPromptPackMode(
  value: unknown,
  manifestPath: string,
): PromptPackMode {
  const mode = assertStringField(value, "mode", manifestPath);
  if (mode !== DEFAULT_PROMPT_PACK_MODE) {
    throw new Error(
      `Unsupported prompt-pack mode "${mode}" in manifest "${manifestPath}".`,
    );
  }

  return mode;
}

function normalizeTemplateFile(
  value: unknown,
  manifestPath: string,
): PromptTemplateFileDefinition {
  if (!isRecord(value)) {
    throw new Error(
      `Invalid prompt-pack manifest at "${manifestPath}": template file entries must be objects.`,
    );
  }

  return {
    phase: assertStringField(value.phase, "templateFiles[].phase", manifestPath) as MethodologyPhase,
    variant: assertStringField(
      value.variant,
      "templateFiles[].variant",
      manifestPath,
    ) as PromptTemplateVariant,
    path: assertStringField(value.path, "templateFiles[].path", manifestPath),
  };
}

function normalizePromptPackManifest(
  raw: unknown,
  manifestPath: string,
): PromptPackFileManifest {
  if (!isRecord(raw)) {
    throw new Error(
      `Invalid prompt-pack manifest at "${manifestPath}": expected a JSON object.`,
    );
  }

  const templateFiles = Array.isArray(raw.templateFiles)
    ? raw.templateFiles.map((entry) => normalizeTemplateFile(entry, manifestPath))
    : null;

  if (!templateFiles || templateFiles.length === 0) {
    throw new Error(
      `Invalid prompt-pack manifest at "${manifestPath}": templateFiles must contain at least one entry.`,
    );
  }

  return {
    analysisType: assertStringField(
      raw.analysisType,
      "analysisType",
      manifestPath,
    ),
    mode: assertPromptPackMode(raw.mode, manifestPath),
    id: assertStringField(raw.id, "id", manifestPath),
    version: assertStringField(raw.version, "version", manifestPath),
    source: isRecord(raw.source)
      ? {
          kind:
            raw.source.kind === "filesystem" ? "filesystem" : "bundled",
          ...(typeof raw.source.path === "string" &&
          raw.source.path.trim().length > 0
            ? { path: raw.source.path }
            : {}),
        }
      : {
          kind: "bundled",
        },
    ...(Array.isArray(raw.phases)
      ? {
          phases: raw.phases.filter(isRecord).map((phase) => {
            const toolPolicy = isRecord(phase.toolPolicy)
              ? {
                  enabledAnalysisTools: Array.isArray(
                    phase.toolPolicy.enabledAnalysisTools,
                  )
                    ? phase.toolPolicy.enabledAnalysisTools
                        .filter((tool): tool is string => typeof tool === "string" && tool.trim().length > 0)
                    : [],
                  ...(typeof phase.toolPolicy.webSearch === "boolean"
                    ? { webSearch: phase.toolPolicy.webSearch }
                    : {}),
                  ...(typeof phase.toolPolicy.notes === "string" &&
                  phase.toolPolicy.notes.trim().length > 0
                    ? { notes: phase.toolPolicy.notes }
                    : {}),
                }
              : { enabledAnalysisTools: [] };

            return {
              phase: assertStringField(phase.phase, "phases[].phase", manifestPath) as MethodologyPhase,
              objective: assertStringField(
                phase.objective,
                "phases[].objective",
                manifestPath,
              ),
              doneCondition: assertStringField(
                phase.doneCondition,
                "phases[].doneCondition",
                manifestPath,
              ),
              toolPolicy,
            };
          }),
        }
      : {}),
    templateFiles,
  };
}

function resolvePromptTemplates(
  pack: PromptPackDefinition,
): ResolvedPromptTemplate[] {
  return pack.templates.map((template) => ({
    ...template,
    templateHash: hashText(template.text),
    templateIdentity: `${pack.id}:${template.phase}:${template.variant}`,
  }));
}

function resolvePack(pack: PromptPackDefinition): ResolvedPromptPack {
  const templates = resolvePromptTemplates(pack);
  const packHash = hashText(
    JSON.stringify({
      id: pack.id,
      version: pack.version,
      mode: pack.mode,
      analysisType: pack.analysisType,
      phases: pack.phases ?? [],
      templates: templates.map((template) => ({
        phase: template.phase,
        variant: template.variant,
        templateHash: template.templateHash,
      })),
    }),
  );

  return {
    ...pack,
    templates,
    packHash,
  };
}

function loadPackFromManifest(
  manifestPath: string,
  sourceKind: PromptPackSourceRef["kind"],
): ResolvedPromptPack {
  if (!existsSync(manifestPath)) {
    throw new Error(`Prompt-pack manifest not found at "${manifestPath}".`);
  }

  const manifest = normalizePromptPackManifest(
    JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
    manifestPath,
  );
  const manifestDir = dirname(manifestPath);

  const templates = manifest.templateFiles.map((templateFile) => {
    const templatePath = join(manifestDir, templateFile.path);
    if (!existsSync(templatePath)) {
      throw new Error(
        `Prompt-pack template file not found at "${templatePath}" for manifest "${manifestPath}".`,
      );
    }

    return {
      phase: templateFile.phase,
      variant: templateFile.variant,
      text: readFileSync(templatePath, "utf8"),
    };
  });

  return resolvePack({
    analysisType: manifest.analysisType,
    mode: manifest.mode,
    id: manifest.id,
    version: manifest.version,
    source: {
      kind: sourceKind,
      path: manifestPath,
    },
    ...(manifest.phases ? { phases: manifest.phases } : {}),
    templates,
  });
}

function tryResolvePromptPackFromRoot(
  root: string,
  analysisType: string,
  mode: PromptPackMode,
  sourceKind: PromptPackSourceRef["kind"],
): ResolvedPromptPack | null {
  const manifestPath = manifestPathFor(root, analysisType, mode);
  if (!existsSync(manifestPath)) {
    return null;
  }

  return loadPackFromManifest(manifestPath, sourceKind);
}

export function resolvePromptPack(input: {
  analysisType: string;
  mode: PromptPackMode;
  roots?: PromptPackResolutionRoots;
}): ResolvedPromptPack {
  const filesystemRoot = input.roots?.filesystemRoot ?? defaultFilesystemRoot();
  const packagedRoot = input.roots?.packagedRoot ?? defaultPackagedRoot();

  const filesystemPack = tryResolvePromptPackFromRoot(
    filesystemRoot,
    input.analysisType,
    input.mode,
    "filesystem",
  );
  if (filesystemPack) {
    return filesystemPack;
  }

  const packagedPack = tryResolvePromptPackFromRoot(
    packagedRoot,
    input.analysisType,
    input.mode,
    "bundled",
  );
  if (packagedPack) {
    return packagedPack;
  }

  throw new Error(
    `Unsupported prompt pack for analysisType "${input.analysisType}" and mode "${input.mode}".`,
  );
}

export function resolveAnalysisPromptTemplate(input: {
  analysisType: string;
  mode: PromptPackMode;
  phase: MethodologyPhase;
  variant: PromptTemplateVariant;
  roots?: PromptPackResolutionRoots;
}): ResolvedPromptTemplate & { pack: ResolvedPromptPack } {
  const pack = resolvePromptPack({
    analysisType: input.analysisType,
    mode: input.mode,
    ...(input.roots ? { roots: input.roots } : {}),
  });
  const template = pack.templates.find(
    (candidate) =>
      candidate.phase === input.phase && candidate.variant === input.variant,
  );

  if (!template) {
    throw new Error(
      `Unsupported prompt template for phase "${input.phase}" and variant "${input.variant}" in pack "${pack.id}@${pack.version}".`,
    );
  }

  return {
    ...template,
    pack,
  };
}
