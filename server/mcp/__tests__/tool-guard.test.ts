import { describe, expect, it } from "vitest";
import {
  ANALYSIS_MODE_TOOL_DEFINITIONS,
  CHAT_MODE_TOOL_DEFINITIONS,
  PRODUCT_TOOL_HANDLERS,
  handleToolCall,
  registerProductTools,
  type ProductToolMode,
  type ToolDefinition,
} from "../product-tools";
import {
  ANALYSIS_TOOL_NAMES,
  CHAT_TOOL_NAMES,
} from "../../services/ai/tool-surfaces";

type JsonSchema = {
  type?: string;
  properties?: Readonly<Record<string, JsonSchema>>;
  required?: readonly string[];
  additionalProperties?: boolean;
  enum?: readonly unknown[];
  items?: JsonSchema;
};

const VALID_ARGS: Record<string, Record<string, unknown>> = {
  get_entity: { id: "entity-1" },
  query_entities: {
    phase: "situational-grounding",
    type: "fact",
    stale: false,
  },
  query_relationships: { type: "supports", entityId: "entity-1" },
  request_loopback: {
    trigger_type: "model_unexplained_fact",
    justification: "A key fact changes the model.",
  },
  start_analysis: {
    topic: "semiconductor export controls",
    provider: "openai",
    model: "gpt-5.4",
  },
  get_analysis_status: {},
  create_entity: {
    type: "fact",
    phase: "situational-grounding",
    data: { type: "fact" },
    confidence: "medium",
  },
  update_entity: { id: "entity-1", updates: { rationale: "updated" } },
  delete_entity: { id: "entity-1" },
  create_relationship: {
    type: "supports",
    fromId: "entity-1",
    toId: "entity-2",
    metadata: { reason: "evidence" },
  },
  delete_relationship: { id: "rel-1" },
  rerun_phases: { phases: ["situational-grounding"] },
  abort_analysis: {},
  web_search: { query: "semiconductor export controls", max_results: 5 },
};

const MALFORMED_ARGS: Record<string, Record<string, unknown>> = {
  get_entity: { id: 42 },
  query_entities: { stale: "yes" },
  query_relationships: { entityId: 42 },
  request_loopback: { trigger_type: "model_unexplained_fact" },
  start_analysis: { provider: "openai" },
  get_analysis_status: { unexpected: true },
  create_entity: {
    type: "fact",
    phase: "situational-grounding",
    data: "not-object",
  },
  update_entity: { id: "entity-1", updates: "not-object" },
  delete_entity: { id: null },
  create_relationship: { type: "supports", fromId: 42, toId: "entity-2" },
  delete_relationship: { id: "rel-1", unexpected: true },
  rerun_phases: { phases: "situational-grounding" },
  abort_analysis: { unexpected: true },
  web_search: { query: 42 },
};

function schemaAccepts(schema: JsonSchema, value: unknown): boolean {
  if (schema.enum && !schema.enum.includes(value)) {
    return false;
  }

  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    const objectValue = value as Record<string, unknown>;
    const properties = schema.properties ?? {};
    for (const requiredKey of schema.required ?? []) {
      if (!(requiredKey in objectValue)) {
        return false;
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(objectValue)) {
        if (!(key in properties)) {
          return false;
        }
      }
    }
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (
        key in objectValue &&
        !schemaAccepts(propertySchema, objectValue[key])
      ) {
        return false;
      }
    }
    return true;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      return false;
    }
    return schema.items
      ? value.every((item) => schemaAccepts(schema.items!, item))
      : true;
  }

  if (schema.type === "string") {
    return typeof value === "string";
  }

  if (schema.type === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }

  if (schema.type === "boolean") {
    return typeof value === "boolean";
  }

  return true;
}

async function registeredToolNames(mode: ProductToolMode): Promise<string[]> {
  const handlers: Array<() => Promise<{ tools: ToolDefinition[] }>> = [];
  const fakeServer = {
    setRequestHandler: (_schema: unknown, handler: unknown) => {
      handlers.push(handler as () => Promise<{ tools: ToolDefinition[] }>);
    },
  };

  registerProductTools(fakeServer as never, mode);
  const result = await handlers[0]();
  return result.tools.map((tool) => tool.name).sort();
}

describe("MCP tool guard", () => {
  it("every declared chat tool has a dispatch handler", () => {
    const declaredNames = CHAT_MODE_TOOL_DEFINITIONS.map(
      (tool) => tool.name,
    ).sort();
    expect(Object.keys(PRODUCT_TOOL_HANDLERS).sort()).toEqual(declaredNames);
  });

  it("analysis and chat surface name lists match the registered MCP tools", async () => {
    expect([...ANALYSIS_TOOL_NAMES].sort()).toEqual(
      ANALYSIS_MODE_TOOL_DEFINITIONS.map((tool) => tool.name).sort(),
    );
    expect([...CHAT_TOOL_NAMES].sort()).toEqual(
      CHAT_MODE_TOOL_DEFINITIONS.map((tool) => tool.name).sort(),
    );

    await expect(registeredToolNames("analysis")).resolves.toEqual(
      [...ANALYSIS_TOOL_NAMES].sort(),
    );
    await expect(registeredToolNames("chat")).resolves.toEqual(
      [...CHAT_TOOL_NAMES].sort(),
    );
  });

  it("tool input schemas reject unknown and malformed args", () => {
    for (const tool of CHAT_MODE_TOOL_DEFINITIONS) {
      const schema = tool.inputSchema as JsonSchema;
      const valid = VALID_ARGS[tool.name];
      const malformed = MALFORMED_ARGS[tool.name];

      expect(valid, `missing valid sample for ${tool.name}`).toBeDefined();
      expect(
        malformed,
        `missing malformed sample for ${tool.name}`,
      ).toBeDefined();
      expect(
        schema.additionalProperties,
        `${tool.name} must reject unknown args`,
      ).toBe(false);
      expect(schemaAccepts(schema, valid), `${tool.name} valid sample`).toBe(
        true,
      );
      expect(
        schemaAccepts(schema, { ...valid, __unknown: true }),
        `${tool.name} unknown arg sample`,
      ).toBe(false);
      expect(
        schemaAccepts(schema, malformed),
        `${tool.name} malformed sample`,
      ).toBe(false);
    }
  });

  it("unknown tool names are rejected by the dispatch path", async () => {
    await expect(handleToolCall("does_not_exist", {})).resolves.toEqual({
      text: "Error: Unknown tool: does_not_exist",
      isError: true,
    });
  });
});
