import type { ExportAuditPdfResult } from "../lib/exportAuditPdf";
import type {
  Critique,
  ProviderConfig,
  ApiKeyStatus,
  TavilyKeyStatus,
  EmbeddingMode,
  EmbeddingRuntimeConfig,
  SettingsTab,
} from "../types";

// ── Re-export types from sub-hooks ─────────────────────────────

export { useTheme, normalizeThemeMode, normalizeHex, normalizeFontFamily } from "./useTheme";
export type { ThemeMode, ThemePalette } from "./useTheme";

export { useProviderConfig, PROVIDER_OPTIONS, getProviderDefaults } from "./useProviderConfig";
export type { ProviderConnectionTestResult } from "./useProviderConfig";

export { useScanProfile } from "./useScanProfile";
export type { ScanProfile, ScanProfileConfig } from "./useScanProfile";

export {
  useUserPreferences,
  DEFAULT_USER_PREFERENCES,
  USER_PREFERENCES_SCHEMA_VERSION,
} from "./useUserPreferences";
export type {
  WebSearchDepth,
  ScanTuning,
  UserPreferencesV1,
  UserPreferencesPatch,
  UpdateCheckResult,
} from "./useUserPreferences";

export { useApiKeyManagement } from "./useApiKeyManagement";

export { useEmbeddingConfig } from "./useEmbeddingConfig";

// ── Composed return type ───────────────────────────────────────

export interface UseSettingsReturn {
  // Provider
  providerDraft: ProviderConfig | null;
  providerError: string | null;
  providerSaving: boolean;
  providerModels: string[];
  providerModelLoading: boolean;
  providerModelError: string | null;
  providerTestLoading: boolean;
  providerTestMessage: string | null;
  providerTestError: string | null;

  // Embeddings
  embeddingDraft: EmbeddingRuntimeConfig | null;
  embeddingError: string | null;
  embeddingSaving: boolean;
  embeddingOpenAiKeyStatus: ApiKeyStatus | null;
  embeddingOpenAiKeyInput: string;
  embeddingOpenAiKeyMasked: boolean;
  embeddingOpenAiKeyError: string | null;
  embeddingOpenAiKeySaving: boolean;

  // API Key
  apiKeyStatus: ApiKeyStatus | null;
  apiKeyInput: string;
  apiKeyMasked: boolean;
  apiKeyError: string | null;
  apiKeySaving: boolean;

  // Tavily
  tavilyKeyStatus: TavilyKeyStatus | null;
  tavilyKeyInput: string;
  tavilyKeyMasked: boolean;
  tavilyKeyError: string | null;
  tavilyKeySaving: boolean;

  // Web Search
  webSearchEnabled: boolean;
  webSearchDepth: import("./useUserPreferences").WebSearchDepth;

  // Safety
  autoVerifyEnabled: boolean;
  guruReplySoundEnabled: boolean;
  scanProfile: import("./useScanProfile").ScanProfile;
  scanProfileSaving: boolean;
  scanProfileError: string | null;

  // Personalization (Sprint 1 foundation)
  userPreferences: import("./useUserPreferences").UserPreferencesV1 | null;
  userPreferencesSaving: boolean;
  userPreferencesError: string | null;

  // Updates
  updateInfo: import("./useUserPreferences").UpdateCheckResult | null;
  updateDismissed: boolean;
  updateInstalling: boolean;
  updateError: string | null;
  updateChecking: boolean;

  // Tab
  settingsTab: SettingsTab;

  // Actions
  setSettingsTab: (tab: SettingsTab) => void;
  setProviderDraft: React.Dispatch<React.SetStateAction<ProviderConfig | null>>;
  onProviderChange: (nextId: string) => void;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  refreshProviderModels: (
    force?: boolean,
    resetModel?: boolean,
    override?: ProviderConfig,
    announce?: boolean
  ) => Promise<void>;
  saveProviderSettings: () => Promise<void>;
  testProviderConnection: () => Promise<void>;
  onEmbeddingModeChange: (mode: EmbeddingMode) => void;
  onEmbeddingOpenAiBaseUrlChange: (value: string) => void;
  onEmbeddingOllamaBaseUrlChange: (value: string) => void;
  onEmbeddingOpenAiModelChange: (value: string) => void;
  onEmbeddingOllamaModelChange: (value: string) => void;
  saveEmbeddingSettings: () => Promise<void>;
  refreshEmbeddingSettings: (announce?: boolean) => Promise<void>;
  onEmbeddingOpenAiKeyFocus: () => void;
  onEmbeddingOpenAiKeyChange: (value: string) => void;
  saveEmbeddingOpenAiKey: () => Promise<void>;
  clearEmbeddingOpenAiKey: () => Promise<void>;
  onApiKeyFocus: () => void;
  onApiKeyChange: (value: string) => void;
  saveApiKey: () => Promise<void>;
  clearApiKey: () => Promise<void>;
  onTavilyKeyFocus: () => void;
  onTavilyKeyChange: (value: string) => void;
  saveTavilyKey: () => Promise<void>;
  clearTavilyKey: () => Promise<void>;
  setWebSearchEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  onWebSearchToggle: () => void;
  setWebSearchDepth: React.Dispatch<React.SetStateAction<import("./useUserPreferences").WebSearchDepth>>;
  onWebSearchDepthChange: (value: import("./useUserPreferences").WebSearchDepth) => void;
  setAutoVerifyEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  onAutoVerifyToggle: () => void;
  setGuruReplySoundEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  onGuruReplySoundToggle: () => void;
  onLocalePreferenceChange: (locale: "en" | "tr") => void;
  setScanProfile: React.Dispatch<React.SetStateAction<import("./useScanProfile").ScanProfile>>;
  saveScanProfile: () => Promise<void>;
  updateUserPreferences: (patch: import("./useUserPreferences").UserPreferencesPatch) => void;
  refreshUserPreferences: () => Promise<void>;
  resetUserPreferences: () => Promise<void>;
  onExportPDF: (logs: Record<string, Critique>, path: string) => void;
  setUpdateDismissed: React.Dispatch<React.SetStateAction<boolean>>;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;

  // Derived
  providerLabel: string;
  requiresApiKey: boolean;
  webSearchReady: boolean;
  exportPdfInProgress: boolean;
  exportPdfMessage: string | null;
  exportPdfError: string | null;
}

// ── Composed hook ──────────────────────────────────────────────

import { useProviderConfig } from "./useProviderConfig";
import { useScanProfile } from "./useScanProfile";
import { useUserPreferences } from "./useUserPreferences";
import { useApiKeyManagement } from "./useApiKeyManagement";
import { useEmbeddingConfig } from "./useEmbeddingConfig";
import { useTheme } from "./useTheme";

export function useSettings(
  exportPdfFn: (args: { logs: Record<string, Critique>; path: string }) => Promise<ExportAuditPdfResult>,
  settingsOpen: boolean
): UseSettingsReturn {
  const provider = useProviderConfig(settingsOpen);
  const scan = useScanProfile(settingsOpen);
  const userPrefs = useUserPreferences({ settingsOpen, exportPdfFn });
  const apiKeys = useApiKeyManagement({
    providerId: provider.providerDraft?.provider_id,
    settingsOpen,
    providerDraft: provider.providerDraft,
    setWebSearchEnabled: userPrefs.setWebSearchEnabled,
  });
  const embedding = useEmbeddingConfig(settingsOpen);

  // useTheme is called for composition completeness; not spread into return
  // because the original UseSettingsReturn did not include theme fields.
  void useTheme(userPrefs.userPreferences);

  return {
    // Provider
    providerDraft: provider.providerDraft,
    providerError: provider.providerError,
    providerSaving: provider.providerSaving,
    providerModels: provider.providerModels,
    providerModelLoading: provider.providerModelLoading,
    providerModelError: provider.providerModelError,
    providerTestLoading: provider.providerTestLoading,
    providerTestMessage: provider.providerTestMessage,
    providerTestError: provider.providerTestError,
    setProviderDraft: provider.setProviderDraft,
    onProviderChange: provider.onProviderChange,
    onBaseUrlChange: provider.onBaseUrlChange,
    onModelChange: provider.onModelChange,
    refreshProviderModels: provider.refreshProviderModels,
    saveProviderSettings: provider.saveProviderSettings,
    testProviderConnection: provider.testProviderConnection,
    providerLabel: provider.providerLabel,

    // Embedding
    embeddingDraft: embedding.embeddingDraft,
    embeddingError: embedding.embeddingError,
    embeddingSaving: embedding.embeddingSaving,
    embeddingOpenAiKeyStatus: embedding.embeddingOpenAiKeyStatus,
    embeddingOpenAiKeyInput: embedding.embeddingOpenAiKeyInput,
    embeddingOpenAiKeyMasked: embedding.embeddingOpenAiKeyMasked,
    embeddingOpenAiKeyError: embedding.embeddingOpenAiKeyError,
    embeddingOpenAiKeySaving: embedding.embeddingOpenAiKeySaving,
    onEmbeddingModeChange: embedding.onEmbeddingModeChange,
    onEmbeddingOpenAiBaseUrlChange: embedding.onEmbeddingOpenAiBaseUrlChange,
    onEmbeddingOllamaBaseUrlChange: embedding.onEmbeddingOllamaBaseUrlChange,
    onEmbeddingOpenAiModelChange: embedding.onEmbeddingOpenAiModelChange,
    onEmbeddingOllamaModelChange: embedding.onEmbeddingOllamaModelChange,
    saveEmbeddingSettings: embedding.saveEmbeddingSettings,
    refreshEmbeddingSettings: embedding.refreshEmbeddingSettings,
    onEmbeddingOpenAiKeyFocus: embedding.onEmbeddingOpenAiKeyFocus,
    onEmbeddingOpenAiKeyChange: embedding.onEmbeddingOpenAiKeyChange,
    saveEmbeddingOpenAiKey: embedding.saveEmbeddingOpenAiKey,
    clearEmbeddingOpenAiKey: embedding.clearEmbeddingOpenAiKey,

    // API Keys
    apiKeyStatus: apiKeys.apiKeyStatus,
    apiKeyInput: apiKeys.apiKeyInput,
    apiKeyMasked: apiKeys.apiKeyMasked,
    apiKeyError: apiKeys.apiKeyError,
    apiKeySaving: apiKeys.apiKeySaving,
    tavilyKeyStatus: apiKeys.tavilyKeyStatus,
    tavilyKeyInput: apiKeys.tavilyKeyInput,
    tavilyKeyMasked: apiKeys.tavilyKeyMasked,
    tavilyKeyError: apiKeys.tavilyKeyError,
    tavilyKeySaving: apiKeys.tavilyKeySaving,
    onApiKeyFocus: apiKeys.onApiKeyFocus,
    onApiKeyChange: apiKeys.onApiKeyChange,
    saveApiKey: apiKeys.saveApiKey,
    clearApiKey: apiKeys.clearApiKey,
    onTavilyKeyFocus: apiKeys.onTavilyKeyFocus,
    onTavilyKeyChange: apiKeys.onTavilyKeyChange,
    saveTavilyKey: apiKeys.saveTavilyKey,
    clearTavilyKey: apiKeys.clearTavilyKey,
    requiresApiKey: apiKeys.requiresApiKey,
    webSearchReady: apiKeys.webSearchReady,

    // Scan profile
    scanProfile: scan.scanProfile,
    scanProfileSaving: scan.scanProfileSaving,
    scanProfileError: scan.scanProfileError,
    setScanProfile: scan.setScanProfile,
    saveScanProfile: scan.saveScanProfile,

    // User preferences
    userPreferences: userPrefs.userPreferences,
    userPreferencesSaving: userPrefs.userPreferencesSaving,
    userPreferencesError: userPrefs.userPreferencesError,
    webSearchEnabled: userPrefs.webSearchEnabled,
    webSearchDepth: userPrefs.webSearchDepth,
    autoVerifyEnabled: userPrefs.autoVerifyEnabled,
    guruReplySoundEnabled: userPrefs.guruReplySoundEnabled,
    settingsTab: userPrefs.settingsTab,
    setSettingsTab: userPrefs.setSettingsTab,
    setWebSearchEnabled: userPrefs.setWebSearchEnabled,
    onWebSearchToggle: userPrefs.onWebSearchToggle,
    setWebSearchDepth: userPrefs.setWebSearchDepth,
    onWebSearchDepthChange: userPrefs.onWebSearchDepthChange,
    setAutoVerifyEnabled: userPrefs.setAutoVerifyEnabled,
    onAutoVerifyToggle: userPrefs.onAutoVerifyToggle,
    setGuruReplySoundEnabled: userPrefs.setGuruReplySoundEnabled,
    onGuruReplySoundToggle: userPrefs.onGuruReplySoundToggle,
    onLocalePreferenceChange: userPrefs.onLocalePreferenceChange,
    updateUserPreferences: userPrefs.updateUserPreferences,
    refreshUserPreferences: userPrefs.refreshUserPreferences,
    resetUserPreferences: userPrefs.resetUserPreferences,
    onExportPDF: userPrefs.onExportPDF,
    exportPdfInProgress: userPrefs.exportPdfInProgress,
    exportPdfMessage: userPrefs.exportPdfMessage,
    exportPdfError: userPrefs.exportPdfError,

    // Updates
    updateInfo: userPrefs.updateInfo,
    updateDismissed: userPrefs.updateDismissed,
    updateInstalling: userPrefs.updateInstalling,
    updateError: userPrefs.updateError,
    updateChecking: userPrefs.updateChecking,
    setUpdateDismissed: userPrefs.setUpdateDismissed,
    checkForUpdates: userPrefs.checkForUpdates,
    installUpdate: userPrefs.installUpdate,
  };
}

export default useSettings;
