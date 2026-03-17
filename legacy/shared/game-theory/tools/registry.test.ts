import { describe, it, expect, beforeEach } from "vitest";
import { createToolRegistry } from "./registry";
import type { ToolDefinition } from "../types/agent";

function makeTool(name: string): ToolDefinition {
  return {
    name,
    description: `Description for ${name}`,
    inputSchema: { type: "object", properties: { value: { type: "string" } } },
    execute: async (_input, _context) => ({ success: true, data: name }),
  };
}

describe("ToolRegistry", () => {
  let registry: ReturnType<typeof createToolRegistry>;

  beforeEach(() => {
    registry = createToolRegistry();
  });

  it("registers and retrieves a tool by name", () => {
    const tool = makeTool("get_analysis");
    registry.register(tool);
    expect(registry.get("get_analysis")).toBe(tool);
  });

  it("returns undefined for an unknown tool", () => {
    expect(registry.get("nonexistent_tool")).toBeUndefined();
  });

  it("lists all registered tools in insertion order", () => {
    const alpha = makeTool("alpha");
    const beta = makeTool("beta");
    const gamma = makeTool("gamma");
    registry.register(alpha);
    registry.register(beta);
    registry.register(gamma);

    const all = registry.listAll();
    expect(all).toHaveLength(3);
    expect(all[0]).toBe(alpha);
    expect(all[1]).toBe(beta);
    expect(all[2]).toBe(gamma);
  });

  it("returns schemas with input_schema field instead of inputSchema", () => {
    const tool = makeTool("get_players");
    registry.register(tool);

    const schemas = registry.getSchemas();
    expect(schemas).toHaveLength(1);
    const schema = schemas[0];
    expect(schema.name).toBe("get_players");
    expect(schema.description).toBe("Description for get_players");
    expect(schema.input_schema).toEqual(tool.inputSchema);
    expect(schema).not.toHaveProperty("inputSchema");
  });

  it("rejects duplicate tool names with an error containing 'already registered'", () => {
    registry.register(makeTool("duplicate_tool"));
    expect(() => registry.register(makeTool("duplicate_tool"))).toThrow(
      "already registered",
    );
  });
});
