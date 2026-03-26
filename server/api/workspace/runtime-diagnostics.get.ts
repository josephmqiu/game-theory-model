import { defineEventHandler, getQuery } from "h3";
import { getWorkspaceRuntimeDiagnosticsSnapshot } from "../../services/workspace/workspace-runtime-transport";

export default defineEventHandler((event) => {
  const query = getQuery(event) as {
    connectionId?: string;
  };

  return getWorkspaceRuntimeDiagnosticsSnapshot(query.connectionId?.trim());
});

