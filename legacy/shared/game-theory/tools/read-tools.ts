import { z } from "zod";
import type { ToolDefinition, ToolContext, ToolResult } from "../types/agent";
import { STORE_KEY } from "../types/canonical";
import type { EntityType } from "../types/canonical";
import { entityTypes } from "../types/canonical";

// ── get_entity ────────────────────────────────────────────────────────────────

const getEntitySchema = z.object({
  type: z.enum(entityTypes),
  id: z.string().min(1),
});

function createGetEntityTool(): ToolDefinition {
  return {
    name: "get_entity",
    description:
      "Looks up a single entity by type and ID in the canonical store. Returns the entity data or an error if not found.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [...entityTypes],
          description: "Entity type to look up.",
        },
        id: {
          type: "string",
          description: "ID of the entity.",
        },
      },
      required: ["type", "id"],
    },
    execute: async (
      input: Record<string, unknown>,
      context: ToolContext,
    ): Promise<ToolResult> => {
      const parsed = getEntitySchema.safeParse(input);
      if (!parsed.success) {
        const messages = parsed.error.issues.map((i) => i.message).join("; ");
        return { success: false, error: `Invalid input: ${messages}` };
      }

      const { type, id } = parsed.data;
      const storeKey = STORE_KEY[type as EntityType];
      const collection = context.canonical[storeKey] as Record<string, unknown>;
      const entity = collection[id];

      if (!entity) {
        return {
          success: false,
          error: `Entity of type '${type}' with id '${id}' not found.`,
        };
      }

      return { success: true, data: entity };
    },
  };
}

// ── list_entities ─────────────────────────────────────────────────────────────

const listEntitiesSchema = z.object({
  type: z.enum(entityTypes),
});

function createListEntitiesTool(): ToolDefinition {
  return {
    name: "list_entities",
    description:
      "Returns all entities of a given type from the canonical store, as an array of { id, entity } objects.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [...entityTypes],
          description: "Entity type to list.",
        },
      },
      required: ["type"],
    },
    execute: async (
      input: Record<string, unknown>,
      context: ToolContext,
    ): Promise<ToolResult> => {
      const parsed = listEntitiesSchema.safeParse(input);
      if (!parsed.success) {
        const messages = parsed.error.issues.map((i) => i.message).join("; ");
        return { success: false, error: `Invalid input: ${messages}` };
      }

      const { type } = parsed.data;
      const storeKey = STORE_KEY[type as EntityType];
      const collection = context.canonical[storeKey] as Record<string, unknown>;

      const items = Object.entries(collection).map(([id, entity]) => ({
        id,
        entity,
      }));

      return { success: true, data: { type, items, count: items.length } };
    },
  };
}

// ── Public factory ────────────────────────────────────────────────────────────

export function createReadTools(): ToolDefinition[] {
  return [createGetEntityTool(), createListEntitiesTool()];
}
