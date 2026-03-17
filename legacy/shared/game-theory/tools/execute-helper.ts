import { z } from "zod";
import type { ToolContext, ToolResult } from "../types/agent";
import type { Command } from "../engine/commands";

// ── Shared executeTool helper ──────────────────────────────────────────────────
//
// Validates input against a Zod schema, builds a command, dispatches it, and
// returns a ToolResult. Used by all tool files to avoid duplication.

export function executeTool(
  input: unknown,
  schema: z.ZodType,
  buildCommand: (parsed: unknown) => Command,
  context: ToolContext,
): ToolResult {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => i.message).join("; ");
    return { success: false, error: `Invalid input: ${messages}` };
  }

  const command = buildCommand(parsed.data);
  const result = context.dispatch(command);

  if (result.status === "committed") {
    const kind = command.kind;
    const id = (command as { id?: string }).id ?? "";
    return { success: true, data: { id, kind } };
  }

  const errors =
    result.status === "rejected"
      ? result.errors
      : ["Dispatch returned dry_run"];
  return { success: false, error: errors.join("; ") };
}
