import { MCP_DEFAULT_PORT } from "../../src/constants/app";
import { startMcpServer } from "../mcp/mcp-server";

export default () => {
  if (process.env.VITEST === "true") return;
  const parsedPort = Number.parseInt(process.env.MCP_PORT ?? "", 10);
  const port = Number.isFinite(parsedPort) ? parsedPort : MCP_DEFAULT_PORT;
  void startMcpServer(port);
};
