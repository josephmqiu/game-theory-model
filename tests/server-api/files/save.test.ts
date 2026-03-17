import { describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSampleAnalysisMeta } from "shared/game-theory/test-support/sample-analysis";
import { createSampleCanonicalStore } from "shared/game-theory/test-support/sample-analysis";
import type { AnalysisFileMeta } from "shared/game-theory/types/file";
import handler from "../../../server/api/files/save.ts";
import { callPost } from "../../../server/test-support/http";

function createPayload() {
  return {
    filePath: "",
    store: createSampleCanonicalStore(),
    meta: createSampleAnalysisMeta() as AnalysisFileMeta,
  };
}

describe("/api/files/save", () => {
  it("writes a valid analysis file to disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gta-save-"));
    const filePath = join(dir, "analysis.gta.json");

    const response = await callPost<
      {
        success: true;
        filePath: string;
        schemaVersion: number;
        bytesWritten: number;
      }
    >(handler, "/api/files/save", {
      ...createPayload(),
      filePath,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.filePath).toBe(filePath);
    expect(response.body.bytesWritten).toBeGreaterThan(0);

    const saved = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(saved);
    expect(parsed).toMatchObject({
      name: "Sample strategic analysis",
    });
    expect(parsed.schema_version).toBeTypeOf("number");
    expect(Array.isArray(parsed.games)).toBe(true);

    await rm(dir, { recursive: true, force: true });
  });

  it("rejects malformed save payloads", async () => {
    const response = await callPost<{ success: false; error: string }>(
      handler,
      "/api/files/save",
      { filePath: "", store: {} },
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain("filePath");
  });

  it("rejects writes outside safe paths", async () => {
    const response = await callPost<{ success: false; error: string }>(
      handler,
      "/api/files/save",
      {
        filePath: "/etc/gta-output.gta.json",
        store: createSampleCanonicalStore(),
        meta: createSampleAnalysisMeta() as AnalysisFileMeta,
      },
    );

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain("outside the allowed directory");
  });
});
