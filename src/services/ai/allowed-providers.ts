// src/services/ai/allowed-providers.ts — re-export of the shared allowlist so
// existing renderer imports keep working. Source of truth: shared/ai/allowed-providers.ts
export {
  ALLOWED_PROVIDERS,
  PROVIDER_LABELS,
  isAllowedProvider,
  type AllowedProvider,
} from "../../../shared/ai/allowed-providers";
