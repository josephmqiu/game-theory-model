import { defineEventHandler } from "h3";
import { getPendingCommands } from "../../utils/mcp-command-bus";

export default defineEventHandler(() => {
  return {
    status: "ok",
    commands: getPendingCommands(),
  };
});
