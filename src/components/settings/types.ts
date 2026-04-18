import type {
  EmbeddingMode,
  ProviderConfig,
  ApiKeyStatus,
  TavilyKeyStatus,
  EmbeddingRuntimeConfig,
  UpdateCheckResult,
  SettingsTab,
} from "../../types";

export type { SettingsTab };

export interface ProviderSettingsProps {
  providerDraft: ProviderConfig | null;
  providerError: string | null;
  providerSaving: boolean;
  providerModels: string[];
  providerModelLoading: boolean;
  providerModelError: string | null;
  providerTestLoading: boolean;
  providerTestMessage: string | null;
  providerTestError: string | null;
  onProviderChange: (nextId: string) => void;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onRefreshModels: () => void;
  onSaveProvider: () => void;
  onTestProviderConnection: () => void;
  apiKeyStatus: ApiKeyStatus | null;
  apiKeyInput: string;
  apiKeyError: string | null;
  apiKeySaving: boolean;
  onApiKeyFocus: () => void;
  onApiKeyChange: (value: string) => void;
  onSaveApiKey: () => void;
  onClearApiKey: () => void;
}

export interface WebSettingsProps {
  tavilyKeyStatus: TavilyKeyStatus | null;
  tavilyKeyInput: string;
  tavilyKeyMasked: boolean;
  tavilyKeyError: string | null;
  tavilyKeySaving: boolean;
  webSearchEnabled: boolean;
  webSearchDepth: "basic" | "advanced" | "fast" | "ultra-fast" | "auto";
  webSearchReady: boolean;
  onWebSearchToggle: () => void;
  onWebSearchDepthChange: (value: "basic" | "advanced" | "fast" | "ultra-fast" | "auto") => void;
  autoVerifyEnabled: boolean;
  onAutoVerifyToggle: () => void;
  guruReplySoundEnabled: boolean;
  onGuruReplySoundToggle: () => void;
  scanProfile: "source" | "extended" | "full";
  scanProfileSaving: boolean;
  scanProfileError: string | null;
  onScanProfileChange: (value: "source" | "extended" | "full") => void;
  onSaveScanProfile: () => void;
  onTavilyKeyFocus: () => void;
  onTavilyKeyChange: (value: string) => void;
  onSaveTavilyKey: () => void;
  onClearTavilyKey: () => void;
}

export interface EmbeddingSettingsProps {
  embeddingDraft: EmbeddingRuntimeConfig | null;
  embeddingError: string | null;
  embeddingSaving: boolean;
  embeddingOpenAiKeyStatus: ApiKeyStatus | null;
  embeddingOpenAiKeyInput: string;
  embeddingOpenAiKeyMasked: boolean;
  embeddingOpenAiKeyError: string | null;
  embeddingOpenAiKeySaving: boolean;
  onEmbeddingModeChange: (mode: EmbeddingMode) => void;
  onEmbeddingOpenAiBaseUrlChange: (value: string) => void;
  onEmbeddingOllamaBaseUrlChange: (value: string) => void;
  onEmbeddingOpenAiModelChange: (value: string) => void;
  onEmbeddingOllamaModelChange: (value: string) => void;
  onSaveEmbeddingSettings: () => void;
  onRefreshEmbeddingSettings: () => void;
  onEmbeddingOpenAiKeyFocus: () => void;
  onEmbeddingOpenAiKeyChange: (value: string) => void;
  onSaveEmbeddingOpenAiKey: () => void;
  onClearEmbeddingOpenAiKey: () => void;
}

export interface UpdateSettingsProps {
  updateInfo: UpdateCheckResult | null;
  updateChecking: boolean;
  updateInstalling: boolean;
  updateError: string | null;
  onCheckUpdates: () => void;
  onInstallUpdate: () => void;
}

export interface PersonalizationSettingsProps {
  userPreferences: {
    theme_mode: "dark" | "light" | "system";
    light_palette: {
      accent: string;
      panel: string;
      text: string;
    };
    dark_palette: {
      accent: string;
      panel: string;
      text: string;
    };
    font_size_scale: number;
    font_family: string;
    model_custom_instructions: string | null;
    scan_tuning: {
      max_files_per_scan: number;
      max_batch_size_hint: number;
      token_budget_hint: number;
    };
  } | null;
  userPreferencesSaving: boolean;
  userPreferencesError: string | null;
  onUpdateUserPreferences: (patch: {
    theme_mode?: "dark" | "light" | "system";
    language?: "en" | "tr";
    light_palette?: {
      accent?: string;
      panel?: string;
      text?: string;
    };
    dark_palette?: {
      accent?: string;
      panel?: string;
      text?: string;
    };
    font_size_scale?: number;
    font_family?: string;
    model_custom_instructions?: string | null;
    scan_tuning?: {
      max_files_per_scan?: number;
      max_batch_size_hint?: number;
      token_budget_hint?: number;
    };
  }) => void;
  onRefreshUserPreferences: () => Promise<void>;
  onResetUserPreferences: () => Promise<void>;
}

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  theme: "dark" | "light";
  onThemeToggle: () => void;
  onLocaleChange?: (locale: "en" | "tr") => void;
  isDesktop: boolean;
  providerProps: ProviderSettingsProps;
  webProps: WebSettingsProps;
  embeddingProps: EmbeddingSettingsProps;
  updateProps: UpdateSettingsProps;
  personalizationProps: PersonalizationSettingsProps;
  onExportPDF: () => void;
  exportPdfInProgress: boolean;
  exportPdfMessage: string | null;
  exportPdfError: string | null;
  settingsTab: SettingsTab;
  onSettingsTabChange: (tab: SettingsTab) => void;
}
