import { defineEventHandler } from "h3";
import {
  getMcpIntegrationStatuses,
  getProviderStatuses,
} from "../../utils/integration-status";

export default defineEventHandler(async () => {
  const [providers, integrations] = await Promise.all([
    getProviderStatuses(),
    getMcpIntegrationStatuses(),
  ]);

  return {
    providers,
    integrations,
  };
});
