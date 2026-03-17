/**
 * Shared hook — derives connected models from agent-settings-store and
 * auto-selects a valid model when the current selection disappears.
 */

import { useEffect, useMemo } from "react";
import { aiStore, useAiStore } from "@/stores/ai-store";
import { useAgentSettingsStore } from "@/stores/agent-settings-store";
import type { AIProviderType, GroupedModel } from "@/types/agent-settings";

export const PROVIDER_LABELS: Record<AIProviderType, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  opencode: "OpenCode",
  copilot: "Copilot",
};

export interface ConnectedModel extends GroupedModel {
  providerLabel: string;
}

export function useConnectedModels(): ConnectedModel[] {
  const connectedProviders = useAgentSettingsStore((s) => s.providers);

  return useMemo(
    () =>
      (Object.keys(connectedProviders) as AIProviderType[]).flatMap(
        (providerType) =>
          connectedProviders[providerType].models.map((model) => ({
            ...model,
            providerLabel: connectedProviders[providerType].displayName,
          })),
      ),
    [connectedProviders],
  );
}

export function useModelAutoFallback(): void {
  const settingsHydrated = useAgentSettingsStore((s) => s.hydrated);
  const provider = useAiStore((s) => s.provider);
  const connectedModels = useConnectedModels();

  useEffect(() => {
    if (!settingsHydrated || connectedModels.length === 0) return;
    const currentModel = connectedModels.find(
      (model) =>
        model.value === provider.modelId &&
        model.provider === provider.provider,
    );
    if (!currentModel) {
      const firstModel = connectedModels[0];
      if (!firstModel) return;
      if (
        firstModel.provider !== provider.provider ||
        firstModel.value !== provider.modelId
      ) {
        aiStore.getState().setProvider({
          provider: firstModel.provider,
          modelId: firstModel.value,
        });
      }
    }
  }, [connectedModels, provider.modelId, provider.provider, settingsHydrated]);
}
