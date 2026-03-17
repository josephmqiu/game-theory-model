import { z } from "zod";
import { afterEach, describe, expect, it } from "vitest";

import {
  createSampleAnalysisMeta,
  createSampleCanonicalStore,
} from "../test-support/sample-analysis";
import { storeToAnalysisFile } from "../utils/serialization";
import {
  buildMigrationPath,
  getCurrentSchemaVersion,
  migrateFile,
  resetMigrationsForTests,
  resetSchemaRegistryForTests,
  type MigrationTransform,
  type SchemaVersion,
} from "./migration";

afterEach(() => {
  resetSchemaRegistryForTests();
  resetMigrationsForTests();
});

describe("migration engine", () => {
  it("builds an ordered migration path when all steps exist", () => {
    const migrations: MigrationTransform[] = [
      {
        from: 1,
        to: 2,
        description: "step one",
        lossy: false,
        transform: (data) => ({ result: data }),
      },
      {
        from: 2,
        to: 3,
        description: "step two",
        lossy: false,
        transform: (data) => ({ result: data }),
      },
    ];

    resetMigrationsForTests(migrations);

    expect(buildMigrationPath(1, 3)).toEqual(migrations);
  });

  it("throws when an intermediate migration step is missing", () => {
    resetMigrationsForTests([
      {
        from: 1,
        to: 2,
        description: "step one",
        lossy: false,
        transform: (data) => ({ result: data }),
      },
    ]);

    expect(() => buildMigrationPath(1, 3)).toThrow(/2 to 3/);
  });

  it("returns migration_failed instead of throwing when the migration path is incomplete", async () => {
    resetMigrationsForTests([
      {
        from: 1,
        to: 2,
        description: "step one",
        lossy: false,
        transform: (data) => ({ result: data }),
      },
    ]);

    const result = await migrateFile({ schema_version: 1 }, 1, 3);

    expect(result.status).toBe("migration_failed");
    if (result.status !== "migration_failed") {
      throw new Error("Expected migration failure result.");
    }

    expect(result.description).toMatch(/Missing migration from schema 2 to 3/);
    expect(result.partial_data).toEqual({ schema_version: 1 });
  });

  it("returns an empty path for same-version migrations", () => {
    expect(buildMigrationPath(2, 2)).toEqual([]);
  });

  it("validates and normalizes when the file is already on the current version", async () => {
    const file = storeToAnalysisFile(
      createSampleCanonicalStore(),
      createSampleAnalysisMeta(),
    );

    const result = await migrateFile(file, 2, 2);

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error("Expected successful migration result.");
    }

    expect(result.steps_applied).toEqual([]);
    expect(result.data).toEqual(file);
  });

  it("reports unsupported future versions", async () => {
    const result = await migrateFile(
      { schema_version: 9 },
      9,
      getCurrentSchemaVersion(),
    );

    expect(result).toMatchObject({
      status: "unsupported_version",
      file_version: 9,
      app_version: 2,
    });
  });

  it("returns migration_failed when transformed output fails schema validation", async () => {
    const file = storeToAnalysisFile(
      createSampleCanonicalStore(),
      createSampleAnalysisMeta(),
    );

    const v2Schema = z
      .object({
        ...z.object({}).shape,
      })
      .passthrough() as unknown as z.ZodType<typeof file>;

    const v1Schema = z.object({
      schema_version: z.literal(1),
    }) as unknown as z.ZodType<typeof file>;

    const schemas: SchemaVersion[] = [
      {
        format: 1,
        schema: v1Schema,
        normalize: (data) => data,
        released_at: "2026-03-14",
        breaking: false,
      },
      {
        format: 2,
        schema: v2Schema,
        normalize: (data) => data,
        released_at: "2026-03-15",
        breaking: false,
      },
    ];

    resetSchemaRegistryForTests(schemas);
    resetMigrationsForTests([
      {
        from: 1,
        to: 2,
        description: "break the payload",
        lossy: false,
        transform: () => ({ result: null }),
      },
    ]);

    const result = await migrateFile(file, 1, 2);

    expect(result.status).toBe("migration_failed");
    if (result.status !== "migration_failed") {
      throw new Error("Expected migration failure.");
    }

    expect(result.failed_at_step).toEqual({ from: 1, to: 2 });
    expect(result.partial_data).toBeNull();
  });

  it("collects discarded data for lossy transforms", async () => {
    const baseFile = storeToAnalysisFile(
      createSampleCanonicalStore(),
      createSampleAnalysisMeta(),
    );
    const v1Schema = z.object({
      schema_version: z.literal(1),
      name: z.string(),
      metadata: z.object({
        tags: z.array(z.string()),
      }),
    }) as unknown as z.ZodType<typeof baseFile>;

    const v2Schema = z.object({
      schema_version: z.literal(2),
      name: z.string(),
      metadata: z.object({
        tags: z.array(z.string()),
        primary_event_dates: z
          .object({
            start: z.string(),
          })
          .optional(),
      }),
    }) as unknown as z.ZodType<typeof baseFile>;

    resetSchemaRegistryForTests([
      {
        format: 1,
        schema: v1Schema,
        normalize: (data) => data,
        released_at: "2026-03-14",
        breaking: false,
      },
      {
        format: 2,
        schema: v2Schema,
        normalize: (data) => data,
        released_at: "2026-03-15",
        breaking: false,
      },
    ]);
    resetMigrationsForTests([
      {
        from: 1,
        to: 2,
        description: "drop the old note",
        lossy: true,
        discarded_fields: ["legacy_note"],
        transform: (data) => {
          const source = data as Record<string, unknown>;
          return {
            result: {
              ...source,
              schema_version: 2,
              metadata: {
                tags: ["fixture"],
                primary_event_dates: {
                  start: "2026-03-01",
                },
              },
            },
            discarded: {
              legacy_note: "deprecated",
            },
          };
        },
      },
    ]);

    const result = await migrateFile(
      {
        schema_version: 1,
        name: baseFile.name,
        metadata: { tags: ["fixture"] },
        legacy_note: "deprecated",
      },
      1,
      2,
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error("Expected successful migration result.");
    }

    expect(result.discarded_data).toEqual([
      {
        step: { from: 1, to: 2 },
        description: "drop the old note",
        fields: ["legacy_note"],
        values: { legacy_note: "deprecated" },
      },
    ]);
  });

  it("supports an end-to-end additive test transform defined only in the test suite", async () => {
    const file = storeToAnalysisFile(
      createSampleCanonicalStore(),
      createSampleAnalysisMeta(),
    );
    const v1Schema = z.object({
      schema_version: z.literal(1),
      name: z.string(),
      description: z.string().optional(),
      created_at: z.string(),
      updated_at: z.string(),
      games: z.array(z.unknown()),
      formalizations: z.array(z.unknown()),
      players: z.array(z.unknown()),
      nodes: z.array(z.unknown()),
      edges: z.array(z.unknown()),
      sources: z.array(z.unknown()),
      observations: z.array(z.unknown()),
      claims: z.array(z.unknown()),
      inferences: z.array(z.unknown()),
      assumptions: z.array(z.unknown()),
      contradictions: z.array(z.unknown()),
      derivations: z.array(z.unknown()),
      latent_factors: z.array(z.unknown()),
      cross_game_links: z.array(z.unknown()),
      scenarios: z.array(z.unknown()),
      playbooks: z.array(z.unknown()),
      metadata: z.object({
        tags: z.array(z.string()),
      }),
    }) as unknown as z.ZodType<typeof file>;

    const v2Schema = z.object({
      schema_version: z.literal(2),
      name: z.string(),
      description: z.string().optional(),
      created_at: z.string(),
      updated_at: z.string(),
      games: z.array(z.unknown()),
      formalizations: z.array(z.unknown()),
      players: z.array(z.unknown()),
      nodes: z.array(z.unknown()),
      edges: z.array(z.unknown()),
      sources: z.array(z.unknown()),
      observations: z.array(z.unknown()),
      claims: z.array(z.unknown()),
      inferences: z.array(z.unknown()),
      assumptions: z.array(z.unknown()),
      contradictions: z.array(z.unknown()),
      derivations: z.array(z.unknown()),
      latent_factors: z.array(z.unknown()),
      cross_game_links: z.array(z.unknown()),
      scenarios: z.array(z.unknown()),
      playbooks: z.array(z.unknown()),
      metadata: z.object({
        tags: z.array(z.string()),
        primary_event_dates: z
          .object({
            start: z.string(),
            end: z.string().optional(),
          })
          .optional(),
      }),
    }) as unknown as z.ZodType<typeof file>;

    resetSchemaRegistryForTests([
      {
        format: 1,
        schema: v1Schema,
        normalize: (data) => data,
        released_at: "2026-03-14",
        breaking: false,
      },
      {
        format: 2,
        schema: v2Schema,
        normalize: (data) => data,
        released_at: "2026-03-15",
        breaking: false,
      },
    ]);
    resetMigrationsForTests([
      {
        from: 1,
        to: 2,
        description: "add primary event dates",
        lossy: false,
        transform: (data) => {
          const source = data as typeof file;
          return {
            result: {
              ...source,
              schema_version: 2,
              metadata: {
                ...source.metadata,
                primary_event_dates: {
                  start: "2026-03-01",
                },
              },
            },
          };
        },
      },
    ]);

    const v1File = {
      ...file,
      metadata: {
        tags: file.metadata.tags,
      },
    };

    const result = await migrateFile(v1File, 1, 2);

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error("Expected successful migration result.");
    }

    expect(result.steps_applied).toEqual([{ from: 1, to: 2, status: "ok" }]);
    expect(
      (result.data.metadata as Record<string, unknown>).primary_event_dates,
    ).toEqual({
      start: "2026-03-01",
    });
  });
});
