import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { storeToAnalysisFile } from "shared/game-theory/utils/serialization";
import type { CanonicalStore } from "shared/game-theory/types/canonical";
import type { AnalysisFileMeta } from "shared/game-theory/types/file";
import { resolveSafeWritePath } from "../../utils/safe-path";

const saveSchema = z.object({
  filePath: z.string().min(1),
  store: z.record(z.unknown()),
  meta: z.object({
    name: z.string(),
    description: z.string().optional(),
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

  const safePath = await resolveSafeWritePath(filePath);
  if (!safePath.ok) {
    setResponseStatus(event, 403);
    return {
      success: false,
      error: safePath.error,
    };
  }

  try {
    const analysisFile = storeToAnalysisFile(
      store as unknown as CanonicalStore,
      meta as unknown as AnalysisFileMeta,
    );

    await mkdir(dirname(safePath.path), { recursive: true });
    const json = JSON.stringify(analysisFile, null, 2);
    await writeFile(safePath.path, json, "utf-8");

    return {
      success: true,
      filePath: safePath.path,
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
