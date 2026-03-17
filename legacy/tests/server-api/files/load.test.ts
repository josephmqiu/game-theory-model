import { describe, expect, it } from "vitest";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { storeToAnalysisFile } from "shared/game-theory/utils/serialization";
import type { AnalysisFileMeta } from "shared/game-theory/types/file";
import {
  createSampleAnalysisMeta,
  createSampleCanonicalStore,
} from "shared/game-theory/test-support/sample-analysis";
import handler from "../../../server/api/files/load.ts";
import { callGet } from "../../../server/test-support/http";

function buildAnalysisPayload(): string {
  return JSON.stringify(
    storeToAnalysisFile(
      createSampleCanonicalStore(),
      createSampleAnalysisMeta() as AnalysisFileMeta,
    ),
  );
}

describe("/api/files/load", () => {
  it("loads a valid .gta.json file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gta-load-"));
    const realDir = await realpath(dir);
    const filePath = join(dir, "analysis.gta.json");
    await writeFile(filePath, buildAnalysisPayload(), "utf-8");

    const response = await callGet<{
      success: true;
      filePath: string;
      store: Record<string, unknown>;
      meta: {
        name: string;
        description?: string;
        metadata: Record<string, unknown>;
      };
    }>(handler, `/api/files/load?path=${encodeURIComponent(filePath)}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.filePath).toBe(join(realDir, "analysis.gta.json"));
    expect(response.body.store).toHaveProperty("games");
    expect(response.body.store).toHaveProperty("players");
    expect(response.body.meta).toMatchObject({
      name: "Sample strategic analysis",
    });

    await rm(dir, { recursive: true, force: true });
  });

  it("rejects missing path", async () => {
    const response = await callGet<{ success: false; error: string }>(
      handler,
      "/api/files/load",
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain(
      "Missing required query parameter: path",
    );
  });

  it("rejects non-gta files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gta-load-"));
    const filePath = join(dir, "analysis.txt");
    await writeFile(filePath, "{}", "utf-8");

    const response = await callGet<{
      success: false;
      error: string;
    }>(handler, `/api/files/load?path=${encodeURIComponent(filePath)}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain(".gta.json");

    await rm(dir, { recursive: true, force: true });
  });

  it("returns safe-path errors for out-of-tree loads", async () => {
    const response = await callGet<{ success: false; error: string }>(
      handler,
      "/api/files/load?path=%2Fetc%2Fpasswords.gta.json",
    );

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain("outside the allowed directory");
  });
});
