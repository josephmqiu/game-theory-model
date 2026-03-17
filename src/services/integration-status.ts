import { agentSettingsStore } from "@/stores/agent-settings-store";
import type {
  IntegrationStatusSnapshot,
  ProviderStatusSnapshot,
} from "@/types/agent-settings";

export async function refreshIntegrationStatuses(): Promise<{
  providers: ProviderStatusSnapshot[];
  integrations: IntegrationStatusSnapshot[];
}> {
  const response = await fetch("/api/integrations/status");
  const result = (await response.json()) as {
    providers: ProviderStatusSnapshot[];
    integrations: IntegrationStatusSnapshot[];
  };

  agentSettingsStore.getState().syncProviderStatuses(result.providers);
  agentSettingsStore.getState().syncIntegrationStatuses(result.integrations);
  return result;
}
