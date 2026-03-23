import { MCP_DEFAULT_PORT } from "../../src/constants/app";
import { startMcpServer } from "../mcp/mcp-server";

export default () => {
  void startMcpServer(MCP_DEFAULT_PORT);
};
