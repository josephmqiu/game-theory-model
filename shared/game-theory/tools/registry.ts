import type { ToolDefinition } from "../types/agent";

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolRegistry {
  register(tool: ToolDefinition): void;
  get(name: string): ToolDefinition | undefined;
  listAll(): readonly ToolDefinition[];
  getSchemas(): ToolSchema[];
}

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, ToolDefinition>();

  return {
    register(tool: ToolDefinition): void {
      if (tools.has(tool.name)) {
        throw new Error(`Tool "${tool.name}" is already registered`);
      }
      tools.set(tool.name, tool);
    },

    get(name: string): ToolDefinition | undefined {
      return tools.get(name);
    },

    listAll(): readonly ToolDefinition[] {
      return Array.from(tools.values());
    },

    getSchemas(): ToolSchema[] {
      return Array.from(tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }));
    },
  };
}
