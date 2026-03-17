export type AIProviderType = "anthropic" | "openai" | "opencode" | "copilot";

export type ProviderStatusStage =
  | "missing_binary"
  | "detected"
  | "authenticated"
  | "ready"
  | "error";

export type IntegrationStatusStage =
  | "missing_binary"
  | "detected"
  | "config_written"
  | "reachable"
  | "ready"
  | "error";

export type ProviderConnectionMethod =
  | "claude-code"
  | "codex-cli"
  | "opencode"
  | "copilot";

export interface GroupedModel {
  value: string;
  displayName: string;
  description: string;
  provider: AIProviderType;
}

export interface AIProviderConfig {
  type: AIProviderType;
  displayName: string;
  isConnected: boolean;
  connectionMethod: ProviderConnectionMethod | null;
  models: GroupedModel[];
  installed: boolean;
  authenticated: boolean | null;
  validated: boolean;
  statusStage: ProviderStatusStage;
  reachable: boolean | null;
  lastError: string | null;
  modelsDiscovered: number;
  statusMessage: string | null;
  lastCheckedAt: string | null;
  configPath: string | null;
}

export type MCPCliTool =
  | "claude-code"
  | "codex-cli"
  | "gemini-cli"
  | "opencode-cli"
  | "kiro-cli"
  | "copilot-cli";

export type MCPTransportMode = "stdio" | "http" | "both";

export interface MCPCliIntegration {
  tool: MCPCliTool;
  displayName: string;
  enabled: boolean;
  installed: boolean;
  validated: boolean;
  authenticated: boolean | null;
  statusStage: IntegrationStatusStage;
  reachable: boolean | null;
  lastError: string | null;
  statusMessage: string | null;
  lastCheckedAt: string | null;
  configPath: string | null;
}

export interface ProviderStatusSnapshot {
  provider: AIProviderType;
  installed: boolean;
  authenticated: boolean | null;
  validated: boolean;
  statusStage: ProviderStatusStage;
  reachable: boolean | null;
  lastError: string | null;
  modelsDiscovered?: number | null;
  statusMessage: string | null;
  lastCheckedAt: string;
  configPath: string | null;
}

export interface IntegrationStatusSnapshot {
  tool: MCPCliTool;
  installed: boolean;
  authenticated: boolean | null;
  validated: boolean;
  statusStage: IntegrationStatusStage;
  reachable: boolean | null;
  lastError: string | null;
  statusMessage: string | null;
  lastCheckedAt: string;
  configPath: string | null;
}

export interface ModelGroup {
  provider: AIProviderType;
  providerName: string;
  models: GroupedModel[];
}
