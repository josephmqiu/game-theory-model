/**
 * Nitro plugin — wires the workspace database accessor into entity-graph-service
 * at server startup. This avoids a static import of node:sqlite from
 * entity-graph-service (which breaks the Bun-hosted Vite dev server).
 */

import { _bindWorkspaceDatabaseForInit } from "../services/entity-graph-service";
import { getWorkspaceDatabase } from "../services/workspace/workspace-db";

export default () => {
  if (process.env.VITEST === "true") return;
  _bindWorkspaceDatabaseForInit(getWorkspaceDatabase);
};
