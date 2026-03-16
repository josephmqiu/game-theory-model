import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { z } from "zod";
import { storeToAnalysisFile } from "shared/game-theory/utils/serialization";
import type { CanonicalStore } from "shared/game-theory/types/canonical";
import type { AnalysisFileMeta } from "shared/game-theory/types/file";

function isSafePath(filePath: string): boolean {
  if (filePath.includes("\0")) return false;

  const resolved = resolve(filePath);
  const home = homedir();
  const tmp = tmpdir();

  return resolved.startsWith(home) || resolved.startsWith(tmp);
}

const saveSchema = z.object({
  filePath: z.string().min(1),
  store: z.record(z.unknown()),
  meta: z.object({
    name: z.string(),
    description: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

/**
 * POST endpoint to save .gta.json analysis file content.
 * Accepts { filePath, store, meta } and uses storeToAnalysisFile()
 * to produce the canonical file format before writing to disk.
 */
export default defineEventHandler(async (event) => {
  const raw = await readBody(event);

  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    };
  }

  const { filePath, store, meta } = parsed.data;

  if (!filePath.endsWith(".gta.json")) {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: "File path must end with .gta.json",
    };
  }

  if (!isSafePath(filePath)) {
    setResponseStatus(event, 403);
    return {
      success: false,
      error: "Path is outside the allowed directory",
    };
  }

  try {
    const analysisFile = storeToAnalysisFile(
      store as unknown as CanonicalStore,
      meta as unknown as AnalysisFileMeta,
    );

    const resolvedPath = resolve(filePath);
    await mkdir(dirname(resolvedPath), { recursive: true });
    const json = JSON.stringify(analysisFile, null, 2);
    await writeFile(resolvedPath, json, "utf-8");

    return {
      success: true,
      filePath: resolvedPath,
      schemaVersion: analysisFile.schema_version,
      bytesWritten: Buffer.byteLength(json, "utf-8"),
    };
  } catch (error) {
    setResponseStatus(event, 500);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to write file",
    };
  }
});
