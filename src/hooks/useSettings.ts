import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import { invoke, isTauriRuntime } from "../lib/tauri";
import type { Critique } from "../components/CritiqueAccordionRow";
import { STORAGE_KEYS } from "../constants";
import type { ExportAuditPdfResult } from "../lib/exportAuditPdf";
import { useToast } from "./useToast";
import { useI18n } from "../i18n";

export type ProviderConfig = {
  provider_id: string;
  base_url: string;
  model: string;
};

export type ProviderConnectionTestResult = {
  ok: boolean;
  provider_id: string;
  base_url: string;
  model: string;
  message: string;
};

export type ApiKeyStatus = {
  has_key: boolean;
  source: string;
  warning?: string | null;
};

export type TavilyKeyStatus = {
  has_key: boolean;
  source: string;
};

export type EmbeddingMode = "auto" | "openai" | "ollama" | "local";

export type EmbeddingRuntimeConfig = {
  mode: EmbeddingMode;
  openai_base_url?: string | null;
  ollama_base_url?: string | null;
  openai_model?: string | null;
  ollama_model?: string | null;
};

export type SettingsTab = "general" | "provider" | "embedding" | "web" | "updates" | "export";

export type ScanProfile = "source" | "extended" | "full";

export type WebSearchDepth = "basic" | "advanced" | "fast" | "ultra-fast" | "auto";

export type ThemeMode = "dark" | "light" | "system";

export type ThemePalette = {
  accent: string;
  panel: string;
  text: string;
};

export type ScanTuning = {
  max_files_per_scan: number;
  max_batch_size_hint: number;
  token_budget_hint: number;
};

export type UserPreferencesV1 = {
  schema_version: number;
  theme_mode: ThemeMode;
  language: "en" | "tr";
  light_palette: ThemePalette;
  dark_palette: ThemePalette;
  font_size_scale: number;
  font_family: string;
  model_custom_instructions: string | null;
  scan_tuning: ScanTuning;
  web_search_enabled: boolean;
  web_search_depth: WebSearchDepth;
  auto_verify_enabled: boolean;
  guru_reply_sound_enabled: boolean;
};

export type UserPreferencesPatch = {
  theme_mode?: ThemeMode;
  language?: "en" | "tr";
  light_palette?: Partial<ThemePalette>;
  dark_palette?: Partial<ThemePalette>;
  font_size_scale?: number;
  font_family?: string;
  model_custom_instructions?: string | null;
  scan_tuning?: Partial<ScanTuning>;
  web_search_enabled?: boolean;
  web_search_depth?: WebSearchDepth;
  auto_verify_enabled?: boolean;
  guru_reply_sound_enabled?: boolean;
};

export type ScanProfileConfig = {
  profile: ScanProfile;
};

export type UpdateCheckResult = {
  status: string;
  current_version: string;
  latest_version?: string | null;
  notes?: string | null;
  error?: string | null;
  last_checked_at?: string | null;
};

export const PROVIDER_OPTIONS = [
  { id: "ollama", label: "Ollama (Local/Hosted)", baseUrl: "http://localhost:11434" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", label: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com/v1" },
  { id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { id: "github-models", label: "GitHub Models", baseUrl: "https://models.github.ai" },
] as const;

export const getProviderDefaults = (providerId: string) => {
  const match = PROVIDER_OPTIONS.find((p) => p.id === providerId);
  return match ?? PROVIDER_OPTIONS[0];
};

const pickDefaultModel = (models: string[]): string => {
  if (models.length === 0) return "";
  return models[0];
};

const API_KEY_MASK = "••••••";

const buildFallbackUpdateInfo = (
  version: string,
  status: string = "up_to_date",
  error: string | null = null
): UpdateCheckResult => ({
  status,
  current_version: version,
  latest_version: version,
  notes: null,
  error,
  last_checked_at: new Date().toISOString(),
});

const DEFAULT_EMBEDDING_CONFIG: EmbeddingRuntimeConfig = {
  mode: "auto",
  openai_base_url: "",
  ollama_base_url: "http://localhost:11434",
  openai_model: "text-embedding-3-small",
  ollama_model: "nomic-embed-text",
};

const USER_PREFERENCES_SCHEMA_VERSION = 1;
const DEFAULT_MODEL_CUSTOM_INSTRUCTION =
  "Keep release-governance clarity first: explain risk and release impact before fix details, and prefer minimal, policy-compliant, production-safe changes.";

const DEFAULT_USER_PREFERENCES: UserPreferencesV1 = {
  schema_version: USER_PREFERENCES_SCHEMA_VERSION,
  theme_mode: "dark",
  language: "en",
  light_palette: {
    accent: "#5f879a",
    panel: "#f7f9fc",
    text: "#1f2b38",
  },
  dark_palette: {
    accent: "#5f8fa5",
    panel: "#141a21",
    text: "#e6edf5",
  },
  font_size_scale: 100,
  font_family: "space-grotesk",
  model_custom_instructions: DEFAULT_MODEL_CUSTOM_INSTRUCTION,
  scan_tuning: {
    max_files_per_scan: 300,
    max_batch_size_hint: 3,
    token_budget_hint: 5000,
  },
  web_search_enabled: false,
  web_search_depth: "basic",
  auto_verify_enabled: false,
  guru_reply_sound_enabled: true,
};

const normalizeEmbeddingConfig = (
  input?: Partial<EmbeddingRuntimeConfig> | null
): EmbeddingRuntimeConfig => {
  const modeRaw = (input?.mode ?? DEFAULT_EMBEDDING_CONFIG.mode).toString().toLowerCase();
  const mode: EmbeddingMode = modeRaw === "openai" || modeRaw === "ollama" || modeRaw === "local"
    ? modeRaw
    : "auto";
  return {
    mode,
    openai_base_url: (input?.openai_base_url ?? DEFAULT_EMBEDDING_CONFIG.openai_base_url ?? "").toString(),
    ollama_base_url: (input?.ollama_base_url ?? DEFAULT_EMBEDDING_CONFIG.ollama_base_url ?? "").toString(),
    openai_model: (input?.openai_model ?? DEFAULT_EMBEDDING_CONFIG.openai_model ?? "").toString(),
    ollama_model: (input?.ollama_model ?? DEFAULT_EMBEDDING_CONFIG.ollama_model ?? "").toString(),
  };
};

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
  webSearchDepth: WebSearchDepth;

  // Safety
  autoVerifyEnabled: boolean;
  guruReplySoundEnabled: boolean;
  scanProfile: ScanProfile;
  scanProfileSaving: boolean;
  scanProfileError: string | null;

  // Personalization (Sprint 1 foundation)
  userPreferences: UserPreferencesV1 | null;
  userPreferencesSaving: boolean;
  userPreferencesError: string | null;

  // Updates
  updateInfo: UpdateCheckResult | null;
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
  setWebSearchDepth: React.Dispatch<React.SetStateAction<WebSearchDepth>>;
  onWebSearchDepthChange: (value: WebSearchDepth) => void;
  setAutoVerifyEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  onAutoVerifyToggle: () => void;
  setGuruReplySoundEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  onGuruReplySoundToggle: () => void;
  onLocalePreferenceChange: (locale: "en" | "tr") => void;
  setScanProfile: React.Dispatch<React.SetStateAction<ScanProfile>>;
  saveScanProfile: () => Promise<void>;
  updateUserPreferences: (patch: UserPreferencesPatch) => void;
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

export function useSettings(
  exportPdfFn: (args: { logs: Record<string, Critique>; path: string }) => Promise<ExportAuditPdfResult>,
  settingsOpen = false
): UseSettingsReturn {
  const isDesktop = isTauriRuntime();
  const toast = useToast();
  const { t } = useI18n();

  // Provider state
  const [providerDraft, setProviderDraft] = useState<ProviderConfig | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerModels, setProviderModels] = useState<string[]>([]);
  const [providerModelLoading, setProviderModelLoading] = useState(false);
  const [providerModelError, setProviderModelError] = useState<string | null>(null);
  const [providerTestLoading, setProviderTestLoading] = useState(false);
  const [providerTestMessage, setProviderTestMessage] = useState<string | null>(null);
  const [providerTestError, setProviderTestError] = useState<string | null>(null);
  const providerTestMessageTimerRef = useRef<number | null>(null);
  const providerModelCacheRef = useRef<Map<string, string[]>>(new Map());
  const providerIdentityRef = useRef<{ id: string; base_url: string } | null>(null);

  // Embedding state
  const [embeddingDraft, setEmbeddingDraft] = useState<EmbeddingRuntimeConfig | null>(null);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);
  const [embeddingSaving, setEmbeddingSaving] = useState(false);
  const [embeddingOpenAiKeyStatus, setEmbeddingOpenAiKeyStatus] = useState<ApiKeyStatus | null>(null);
  const [embeddingOpenAiKeyInput, setEmbeddingOpenAiKeyInput] = useState("");
  const [embeddingOpenAiKeyMasked, setEmbeddingOpenAiKeyMasked] = useState(false);
  const [embeddingOpenAiKeyError, setEmbeddingOpenAiKeyError] = useState<string | null>(null);
  const [embeddingOpenAiKeySaving, setEmbeddingOpenAiKeySaving] = useState(false);

  // API Key state
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeySaving, setApiKeySaving] = useState(false);

  // Tavily state
  const [tavilyKeyStatus, setTavilyKeyStatus] = useState<TavilyKeyStatus | null>(null);
  const [tavilyKeyInput, setTavilyKeyInput] = useState("");
  const [tavilyKeyMasked, setTavilyKeyMasked] = useState(false);
  const [tavilyKeyError, setTavilyKeyError] = useState<string | null>(null);
  const [tavilyKeySaving, setTavilyKeySaving] = useState(false);

  // Web Search state
  const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.WEB_SEARCH) === "true";
    }
    return false;
  });

  const normalizeWebSearchDepth = useCallback((value: string | null): WebSearchDepth => {
    const raw = (value ?? "").trim().toLowerCase();
    if (raw === "advanced" || raw === "fast" || raw === "ultra-fast" || raw === "auto") {
      return raw as WebSearchDepth;
    }
    return "basic";
  }, []);

  const normalizeThemeMode = useCallback((value: unknown): ThemeMode => {
    const raw = String(value ?? "").trim().toLowerCase();
    if (raw === "light" || raw === "system") return raw;
    return "dark";
  }, []);

  const normalizeLocale = useCallback((value: unknown): "en" | "tr" => {
    const raw = String(value ?? "").trim().toLowerCase();
    return raw === "tr" ? "tr" : "en";
  }, []);

  const normalizeHex = useCallback((value: unknown, fallback: string): string => {
    const raw = String(value ?? "").trim();
    const valid = /^#[0-9a-fA-F]{6}$/.test(raw);
    return valid ? raw : fallback;
  }, []);

  const normalizeFontFamily = useCallback((value: unknown): string => {
    const raw = String(value ?? "")
      .trim()
      .toLowerCase();
    const allowList = new Set([
      "space-grotesk",
      "inter",
      "system-ui",
      "source-sans-3",
      "ibm-plex-sans",
    ]);
    return allowList.has(raw) ? raw : "space-grotesk";
  }, []);

  const normalizeUserPreferences = useCallback(
    (input?: Partial<UserPreferencesV1> | null): UserPreferencesV1 => {
      const next = input ?? {};
      const mergedScanTuning = {
        ...DEFAULT_USER_PREFERENCES.scan_tuning,
        ...(next.scan_tuning ?? {}),
      };
      const modelInstructionRaw =
        typeof next.model_custom_instructions === "string"
          ? next.model_custom_instructions
          : (DEFAULT_USER_PREFERENCES.model_custom_instructions ?? "");
      return {
        schema_version: USER_PREFERENCES_SCHEMA_VERSION,
        theme_mode: normalizeThemeMode(next.theme_mode),
        language: normalizeLocale(next.language),
        light_palette: {
          accent: normalizeHex(
            next.light_palette?.accent,
            DEFAULT_USER_PREFERENCES.light_palette.accent,
          ),
          panel: normalizeHex(
            next.light_palette?.panel,
            DEFAULT_USER_PREFERENCES.light_palette.panel,
          ),
          text: normalizeHex(
            next.light_palette?.text,
            DEFAULT_USER_PREFERENCES.light_palette.text,
          ),
        },
        dark_palette: {
          accent: normalizeHex(
            next.dark_palette?.accent,
            DEFAULT_USER_PREFERENCES.dark_palette.accent,
          ),
          panel: normalizeHex(
            next.dark_palette?.panel,
            DEFAULT_USER_PREFERENCES.dark_palette.panel,
          ),
          text: normalizeHex(
            next.dark_palette?.text,
            DEFAULT_USER_PREFERENCES.dark_palette.text,
          ),
        },
        font_size_scale: Math.min(
          130,
          Math.max(85, Number(next.font_size_scale ?? DEFAULT_USER_PREFERENCES.font_size_scale)),
        ),
        font_family: normalizeFontFamily(next.font_family),
        model_custom_instructions: modelInstructionRaw.trim() || null,
        scan_tuning: {
          max_files_per_scan: Math.min(
            400,
            Math.max(
              50,
              Number(
                mergedScanTuning.max_files_per_scan
                  ?? DEFAULT_USER_PREFERENCES.scan_tuning.max_files_per_scan,
              ),
            ),
          ),
          max_batch_size_hint: Math.min(
            10,
            Math.max(
              1,
              Number(
                mergedScanTuning.max_batch_size_hint
                  ?? DEFAULT_USER_PREFERENCES.scan_tuning.max_batch_size_hint,
              ),
            ),
          ),
          token_budget_hint: Math.min(
            12000,
            Math.max(
              1500,
              Number(
                mergedScanTuning.token_budget_hint
                  ?? DEFAULT_USER_PREFERENCES.scan_tuning.token_budget_hint,
              ),
            ),
          ),
        },
        web_search_enabled:
          typeof next.web_search_enabled === "boolean"
            ? next.web_search_enabled
            : DEFAULT_USER_PREFERENCES.web_search_enabled,
        web_search_depth: normalizeWebSearchDepth(next.web_search_depth ?? "basic"),
        auto_verify_enabled:
          typeof next.auto_verify_enabled === "boolean"
            ? next.auto_verify_enabled
            : DEFAULT_USER_PREFERENCES.auto_verify_enabled,
        guru_reply_sound_enabled:
          typeof next.guru_reply_sound_enabled === "boolean"
            ? next.guru_reply_sound_enabled
            : DEFAULT_USER_PREFERENCES.guru_reply_sound_enabled,
      };
    },
    [
      normalizeFontFamily,
      normalizeHex,
      normalizeLocale,
      normalizeThemeMode,
      normalizeWebSearchDepth,
    ],
  );

  const [webSearchDepth, setWebSearchDepth] = useState<WebSearchDepth>(() => {
    if (typeof window !== "undefined") {
      return normalizeWebSearchDepth(localStorage.getItem(STORAGE_KEYS.WEB_SEARCH_DEPTH));
    }
    return "basic";
  });

  // Safety state
  const [autoVerifyEnabled, setAutoVerifyEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.AUTO_VERIFY_ENABLED) === "true";
    }
    return false;
  });

  const [guruReplySoundEnabled, setGuruReplySoundEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.GURU_REPLY_SOUND_ENABLED);
      if (stored === null) return true;
      return stored === "true";
    }
    return true;
  });

  // Scan profile state (desktop persisted)
  const [scanProfile, setScanProfile] = useState<ScanProfile>("source");
  const [scanProfileSaving, setScanProfileSaving] = useState(false);
  const [scanProfileError, setScanProfileError] = useState<string | null>(null);

  // User preferences (desktop persisted, schema-versioned)
  const [userPreferences, setUserPreferences] = useState<UserPreferencesV1 | null>(null);
  const [userPreferencesSaving, setUserPreferencesSaving] = useState(false);
  const [userPreferencesError, setUserPreferencesError] = useState<string | null>(null);
  const userPreferencesRef = useRef<UserPreferencesV1 | null>(null);
  const userPreferencesGenerationRef = useRef(0);
  const pendingUserPreferencesSaveRef = useRef<{ prefs: UserPreferencesV1; generation: number } | null>(null);
  const userPreferencesSaveLoopRunningRef = useRef(false);
  const userPreferencesSaveTimerRef = useRef<number | null>(null);

  // Update state
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [exportPdfInProgress, setExportPdfInProgress] = useState(false);
  const [exportPdfMessage, setExportPdfMessage] = useState<string | null>(null);
  const [exportPdfError, setExportPdfError] = useState<string | null>(null);

  // Timer ref for auto-dismiss
  const exportStatusTimerRef = useRef<number | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (exportStatusTimerRef.current) {
        window.clearTimeout(exportStatusTimerRef.current);
      }
      if (userPreferencesSaveTimerRef.current) {
        window.clearTimeout(userPreferencesSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    userPreferencesRef.current = userPreferences;
  }, [userPreferences]);

  // Tab state
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");

  // Always open Settings on General tab to reduce setup confusion.
  useEffect(() => {
    if (!settingsOpen) return;
    setSettingsTab("general");
  }, [settingsOpen]);

  // Persist web search setting
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.WEB_SEARCH, String(webSearchEnabled));
  }, [webSearchEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.WEB_SEARCH_DEPTH, webSearchDepth);
  }, [webSearchDepth]);

  // Persist auto verification setting
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.AUTO_VERIFY_ENABLED, String(autoVerifyEnabled));
  }, [autoVerifyEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.GURU_REPLY_SOUND_ENABLED, String(guruReplySoundEnabled));
  }, [guruReplySoundEnabled]);

  const mergeLegacyPreferences = useCallback(
    (base: UserPreferencesV1): UserPreferencesV1 => {
      if (typeof window === "undefined") return base;
      const asBool = (raw: string | null): boolean | null => {
        if (raw === "true") return true;
        if (raw === "false") return false;
        return null;
      };

      const next: UserPreferencesV1 = {
        ...base,
        scan_tuning: { ...base.scan_tuning },
      };

      const themeLegacy = localStorage.getItem(STORAGE_KEYS.THEME);
      if (themeLegacy === "dark" || themeLegacy === "light") {
        next.theme_mode = themeLegacy;
      }

      const localeLegacy = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
      if (localeLegacy === "en" || localeLegacy === "tr") {
        next.language = localeLegacy;
      }

      const webSearchLegacy = asBool(localStorage.getItem(STORAGE_KEYS.WEB_SEARCH));
      if (webSearchLegacy !== null) {
        next.web_search_enabled = webSearchLegacy;
      }

      const webDepthLegacy = localStorage.getItem(STORAGE_KEYS.WEB_SEARCH_DEPTH);
      if (webDepthLegacy) {
        next.web_search_depth = normalizeWebSearchDepth(webDepthLegacy);
      }

      const autoVerifyLegacy = asBool(localStorage.getItem(STORAGE_KEYS.AUTO_VERIFY_ENABLED));
      if (autoVerifyLegacy !== null) {
        next.auto_verify_enabled = autoVerifyLegacy;
      }

      const guruSoundLegacy = asBool(localStorage.getItem(STORAGE_KEYS.GURU_REPLY_SOUND_ENABLED));
      if (guruSoundLegacy !== null) {
        next.guru_reply_sound_enabled = guruSoundLegacy;
      }

      return normalizeUserPreferences(next);
    },
    [normalizeUserPreferences, normalizeWebSearchDepth],
  );

  const applyPreferencesToRuntime = useCallback((prefs: UserPreferencesV1): void => {
    setWebSearchEnabled(prefs.web_search_enabled);
    setWebSearchDepth(normalizeWebSearchDepth(prefs.web_search_depth));
    setAutoVerifyEnabled(prefs.auto_verify_enabled);
    setGuruReplySoundEnabled(prefs.guru_reply_sound_enabled);
  }, [normalizeWebSearchDepth]);

  const commitUserPreferencesState = useCallback((prefs: UserPreferencesV1): number => {
    const nextGeneration = userPreferencesGenerationRef.current + 1;
    userPreferencesGenerationRef.current = nextGeneration;
    userPreferencesRef.current = prefs;
    startTransition(() => {
      setUserPreferences(prefs);
    });
    return nextGeneration;
  }, []);

  const clearQueuedUserPreferencesSave = useCallback((): void => {
    pendingUserPreferencesSaveRef.current = null;
    if (userPreferencesSaveTimerRef.current) {
      window.clearTimeout(userPreferencesSaveTimerRef.current);
      userPreferencesSaveTimerRef.current = null;
    }
  }, []);

  const saveUserPreferencesInternal = useCallback(
    async (prefs: UserPreferencesV1): Promise<UserPreferencesV1> => {
      const normalized = normalizeUserPreferences(prefs);
      const saved = await invoke<UserPreferencesV1>("set_user_preferences", {
        preferences: normalized,
      });
      return normalizeUserPreferences(saved);
    },
    [normalizeUserPreferences],
  );

  const flushUserPreferencesSaveQueue = useCallback(async (): Promise<void> => {
    if (!isDesktop || userPreferencesSaveLoopRunningRef.current) return;
    userPreferencesSaveLoopRunningRef.current = true;
    try {
      while (pendingUserPreferencesSaveRef.current) {
        const queued = pendingUserPreferencesSaveRef.current;
        pendingUserPreferencesSaveRef.current = null;
        setUserPreferencesSaving(true);
        setUserPreferencesError(null);
        try {
          const saved = await saveUserPreferencesInternal(queued.prefs);
          const hasNewerPatch = pendingUserPreferencesSaveRef.current !== null;
          const isCurrentGeneration = queued.generation === userPreferencesGenerationRef.current;
          if (!hasNewerPatch && isCurrentGeneration) {
            userPreferencesRef.current = saved;
            startTransition(() => {
              setUserPreferences(saved);
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setUserPreferencesError(t("settings.errors.preferencesSaveFailed", { error: message }));
          break;
        }
      }
    } finally {
      userPreferencesSaveLoopRunningRef.current = false;
      setUserPreferencesSaving(false);
    }
  }, [isDesktop, saveUserPreferencesInternal, t]);

  const queueUserPreferencesSave = useCallback(
    (prefs: UserPreferencesV1, generation: number, delayMs = 220): void => {
      pendingUserPreferencesSaveRef.current = { prefs, generation };
      setUserPreferencesSaving(true);
      setUserPreferencesError(null);
      if (userPreferencesSaveTimerRef.current) {
        window.clearTimeout(userPreferencesSaveTimerRef.current);
      }
      userPreferencesSaveTimerRef.current = window.setTimeout(() => {
        userPreferencesSaveTimerRef.current = null;
        void flushUserPreferencesSaveQueue();
      }, delayMs);
    },
    [flushUserPreferencesSaveQueue],
  );

  const refreshUserPreferences = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setUserPreferencesSaving(true);
    setUserPreferencesError(null);
    try {
      clearQueuedUserPreferencesSave();
      const raw = await invoke<UserPreferencesV1>("get_user_preferences");
      const normalized = normalizeUserPreferences(raw);
      commitUserPreferencesState(normalized);
      applyPreferencesToRuntime(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUserPreferencesError(t("settings.errors.preferencesLoadFailed", { error: message }));
    } finally {
      setUserPreferencesSaving(false);
    }
  }, [
    isDesktop,
    clearQueuedUserPreferencesSave,
    normalizeUserPreferences,
    commitUserPreferencesState,
    applyPreferencesToRuntime,
    t,
  ]);

  const resetUserPreferences = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setUserPreferencesSaving(true);
    setUserPreferencesError(null);
    try {
      clearQueuedUserPreferencesSave();
      const raw = await invoke<UserPreferencesV1>("reset_user_preferences");
      const normalized = normalizeUserPreferences(raw);
      commitUserPreferencesState(normalized);
      applyPreferencesToRuntime(normalized);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES_MIGRATED_V1, "true");
      }
      toast.showSuccess(t("toast.saved"), 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUserPreferencesError(t("settings.errors.preferencesResetFailed", { error: message }));
    } finally {
      setUserPreferencesSaving(false);
    }
  }, [
    isDesktop,
    clearQueuedUserPreferencesSave,
    normalizeUserPreferences,
    commitUserPreferencesState,
    applyPreferencesToRuntime,
    t,
    toast,
  ]);

  // Load + one-time migrate legacy local settings to schema-versioned preferences.
  useEffect(() => {
    if (!isDesktop || !settingsOpen) return;
    let canceled = false;

    const loadAndMigrate = async (): Promise<void> => {
      setUserPreferencesSaving(true);
      setUserPreferencesError(null);
      try {
        clearQueuedUserPreferencesSave();
        const fetched = await invoke<UserPreferencesV1>("get_user_preferences");
        if (canceled) return;
        let normalized = normalizeUserPreferences(fetched);

        const migrationDone =
          typeof window !== "undefined" &&
          localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES_MIGRATED_V1) === "true";

        if (!migrationDone) {
          const mergedFromLegacy = mergeLegacyPreferences(normalized);
          const before = JSON.stringify(normalized);
          const after = JSON.stringify(mergedFromLegacy);
          if (before !== after) {
            setUserPreferencesSaving(true);
            normalized = await saveUserPreferencesInternal(mergedFromLegacy);
          }
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES_MIGRATED_V1, "true");
          }
        }

        if (canceled) return;
        commitUserPreferencesState(normalized);
        applyPreferencesToRuntime(normalized);
      } catch (error) {
        if (canceled) return;
        const message = error instanceof Error ? error.message : String(error);
        setUserPreferencesError(t("settings.errors.preferencesLoadFailed", { error: message }));
      } finally {
        if (!canceled) {
          setUserPreferencesSaving(false);
        }
      }
    };

    void loadAndMigrate();
    return () => {
      canceled = true;
    };
  }, [
    applyPreferencesToRuntime,
    clearQueuedUserPreferencesSave,
    commitUserPreferencesState,
    isDesktop,
    mergeLegacyPreferences,
    normalizeUserPreferences,
    saveUserPreferencesInternal,
    settingsOpen,
    t,
  ]);

  // Load scan profile config when settings opens
  useEffect(() => {
    if (!isDesktop || !settingsOpen) return;
    const loadScanProfile = async (): Promise<void> => {
      try {
        const res = await invoke<ScanProfileConfig>("get_scan_profile_config");
        const raw = (res?.profile ?? "source").toString().toLowerCase();
        const normalized: ScanProfile = raw === "extended" || raw === "full" ? raw : "source";
        setScanProfile(normalized);
        setScanProfileError(null);
      } catch (e: unknown) {
        setScanProfileError(e instanceof Error ? e.message : String(e));
      }
    };
    void loadScanProfile();
  }, [isDesktop, settingsOpen]);

  const saveScanProfile = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setScanProfileSaving(true);
    setScanProfileError(null);
    try {
      const res = await invoke<ScanProfileConfig>("set_scan_profile_config", {
        config: { profile: scanProfile },
      });
      const raw = (res?.profile ?? scanProfile).toString().toLowerCase();
      const normalized: ScanProfile = raw === "extended" || raw === "full" ? raw : "source";
      setScanProfile(normalized);
      toast.showSuccess(t("toast.saved"), 2500);
    } catch (e: unknown) {
      setScanProfileError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanProfileSaving(false);
    }
  }, [isDesktop, scanProfile, t, toast]);

  const patchUserPreferences = useCallback((patch: UserPreferencesPatch): void => {
    if (!isDesktop) return;
    void (async () => {
      let base = userPreferencesRef.current;
      if (!base) {
        try {
          const fetched = await invoke<UserPreferencesV1>("get_user_preferences");
          base = normalizeUserPreferences(fetched);
        } catch {
          base = normalizeUserPreferences(null);
        }
      }

      const merged = normalizeUserPreferences({
        ...base,
        ...patch,
        light_palette: {
          ...base.light_palette,
          ...(patch.light_palette ?? {}),
        },
        dark_palette: {
          ...base.dark_palette,
          ...(patch.dark_palette ?? {}),
        },
        scan_tuning: {
          ...base.scan_tuning,
          ...(patch.scan_tuning ?? {}),
        },
      });
      const generation = commitUserPreferencesState(merged);
      applyPreferencesToRuntime(merged);
      queueUserPreferencesSave(merged, generation);
    })();
  }, [
    isDesktop,
    normalizeUserPreferences,
    commitUserPreferencesState,
    applyPreferencesToRuntime,
    queueUserPreferencesSave,
  ]);

  const onWebSearchDepthChange = useCallback((value: WebSearchDepth): void => {
    const normalized = normalizeWebSearchDepth(value);
    setWebSearchDepth(normalized);
    patchUserPreferences({ web_search_depth: normalized });
  }, [normalizeWebSearchDepth, patchUserPreferences]);

  // Load initial provider config
  useEffect(() => {
    if (!isDesktop) return;
    const loadProvider = async (): Promise<void> => {
      try {
        const res = await invoke<ProviderConfig>("get_provider_config");
        setProviderDraft(res);
        setProviderError(null);
      } catch (e: unknown) {
        setProviderError(e instanceof Error ? e.message : String(e));
      }
    };
    loadProvider();
  }, [isDesktop]);

  // Load API key status when needed
  useEffect(() => {
    if (!isDesktop || !settingsOpen || !providerDraft) return;
    const loadApiKeyStatus = async (): Promise<void> => {
      try {
        const res = await invoke<ApiKeyStatus>("get_api_key_status", {
          providerId: providerDraft.provider_id,
        });
        applyApiKeyStatus(res);
      } catch (e: unknown) {
        setApiKeyError(e instanceof Error ? e.message : String(e));
      }
    };
    loadApiKeyStatus();
  }, [isDesktop, settingsOpen, providerDraft?.provider_id]);

  // Load Tavily status
  useEffect(() => {
    if (!isDesktop || !settingsOpen) return;
    const loadTavilyStatus = async (): Promise<void> => {
      try {
        const res = await invoke<TavilyKeyStatus>("get_tavily_key_status");
        applyTavilyStatus(res);
      } catch (e: unknown) {
        setTavilyKeyError(e instanceof Error ? e.message : String(e));
      }
    };
    loadTavilyStatus();
  }, [isDesktop, settingsOpen]);

  useEffect(() => {
    if (!isDesktop) return;
    const syncEmbeddingConfig = async (): Promise<void> => {
      const stored = readStoredEmbeddingConfig();
      if (stored) {
        setEmbeddingDraft(stored);
        try {
          const applied = await invoke<EmbeddingRuntimeConfig>("set_embedding_runtime_config", {
            config: stored,
          });
          const normalized = normalizeEmbeddingConfig(applied);
          setEmbeddingDraft(normalized);
          persistEmbeddingConfig(normalized);
          setEmbeddingError(null);
          return;
        } catch (error) {
          setEmbeddingError(error instanceof Error ? error.message : String(error));
        }
      }
      await refreshEmbeddingSettings(false);
    };
    void syncEmbeddingConfig();
  }, [isDesktop]);

  useEffect(() => {
    if (!isDesktop || !settingsOpen) return;
    const loadEmbeddingOpenAiKeyStatus = async (): Promise<void> => {
      try {
        const status = await invoke<ApiKeyStatus>("get_api_key_status", { providerId: "openai" });
        applyEmbeddingOpenAiKeyStatus(status);
      } catch (e: unknown) {
        setEmbeddingOpenAiKeyError(e instanceof Error ? e.message : String(e));
      }
    };
    void loadEmbeddingOpenAiKeyStatus();
  }, [isDesktop, settingsOpen]);

  // Check for updates on mount
  useEffect(() => {
    if (!isDesktop) return;
    const loadVersion = async (): Promise<void> => {
      try {
        const version = await invoke<string>("get_app_version");
        setAppVersion(version);
        setUpdateInfo(prev => prev ?? buildFallbackUpdateInfo(version));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setAppVersion("Unknown");
        setUpdateInfo(prev => prev ?? buildFallbackUpdateInfo("Unknown", "unavailable", message));
      }
    };
    void loadVersion();
  }, [isDesktop]);

  // Check for updates on mount
  useEffect(() => {
    if (!isDesktop) return;
    void checkForUpdates();
  }, [isDesktop]);

  // Provider identity tracking for model refresh
  useEffect(() => {
    if (!isDesktop || !providerDraft) return;
    const id = providerDraft.provider_id;
    const baseUrl = providerDraft.base_url.trim() || getProviderDefaults(id).baseUrl;
    const prev = providerIdentityRef.current;
    if (prev && prev.id === id && prev.base_url === baseUrl) return;
    providerIdentityRef.current = { id, base_url: baseUrl };
  }, [isDesktop, providerDraft?.provider_id, providerDraft?.base_url]);

  const applyApiKeyStatus = useCallback((status: ApiKeyStatus | null | undefined): void => {
    if (!status || typeof status.has_key !== "boolean") {
      setApiKeyStatus(null);
      setApiKeyError(t("settings.errors.apiKeyStatusLoadFailed"));
      setApiKeyMasked(false);
      setApiKeyInput("");
      return;
    }
    setApiKeyStatus(status);
    if (status.warning) {
      setApiKeyError(status.warning);
    } else {
      setApiKeyError(null);
    }
    if (status.has_key) {
      setApiKeyMasked(true);
      setApiKeyInput(API_KEY_MASK);
    } else {
      setApiKeyMasked(false);
      setApiKeyInput("");
    }
  }, [t]);

  const applyTavilyStatus = useCallback((status: TavilyKeyStatus | null | undefined): void => {
    if (!status || typeof status.has_key !== "boolean") {
      setTavilyKeyStatus(null);
      setTavilyKeyError(t("settings.errors.tavilyKeyStatusLoadFailed"));
      setTavilyKeyMasked(false);
      setTavilyKeyInput("");
      setWebSearchEnabled(false);
      return;
    }
    setTavilyKeyStatus(status);
    setTavilyKeyError(null);
    if (status.has_key) {
      setTavilyKeyMasked(true);
      setTavilyKeyInput(API_KEY_MASK);
    } else {
      setTavilyKeyMasked(false);
      setTavilyKeyInput("");
      setWebSearchEnabled(false);
    }
  }, [t]);

  const applyEmbeddingOpenAiKeyStatus = useCallback((status: ApiKeyStatus | null | undefined): void => {
    if (!status || typeof status.has_key !== "boolean") {
      setEmbeddingOpenAiKeyStatus(null);
      setEmbeddingOpenAiKeyError(t("settings.errors.embeddingOpenAiKeyStatusLoadFailed"));
      setEmbeddingOpenAiKeyMasked(false);
      setEmbeddingOpenAiKeyInput("");
      return;
    }
    setEmbeddingOpenAiKeyStatus(status);
    if (status.warning) {
      setEmbeddingOpenAiKeyError(status.warning);
    } else {
      setEmbeddingOpenAiKeyError(null);
    }
    if (status.has_key) {
      setEmbeddingOpenAiKeyMasked(true);
      setEmbeddingOpenAiKeyInput(API_KEY_MASK);
    } else {
      setEmbeddingOpenAiKeyMasked(false);
      setEmbeddingOpenAiKeyInput("");
    }
  }, [t]);

  const readStoredEmbeddingConfig = useCallback((): EmbeddingRuntimeConfig | null => {
    if (typeof window === "undefined") return null;
    const mode = localStorage.getItem(STORAGE_KEYS.EMBEDDING_MODE);
    const openaiBaseUrl = localStorage.getItem(STORAGE_KEYS.EMBEDDING_OPENAI_BASE_URL);
    const ollamaBaseUrl = localStorage.getItem(STORAGE_KEYS.EMBEDDING_OLLAMA_BASE_URL);
    const openaiModel = localStorage.getItem(STORAGE_KEYS.EMBEDDING_OPENAI_MODEL);
    const ollamaModel = localStorage.getItem(STORAGE_KEYS.EMBEDDING_OLLAMA_MODEL);
    if (!mode && !openaiBaseUrl && !ollamaBaseUrl && !openaiModel && !ollamaModel) {
      return null;
    }
    return normalizeEmbeddingConfig({
      mode: (mode || "auto") as EmbeddingMode,
      openai_base_url: openaiBaseUrl || "",
      ollama_base_url: ollamaBaseUrl || "",
      openai_model: openaiModel || "",
      ollama_model: ollamaModel || "",
    });
  }, []);

  const persistEmbeddingConfig = useCallback((config: EmbeddingRuntimeConfig): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.EMBEDDING_MODE, config.mode);
    localStorage.setItem(STORAGE_KEYS.EMBEDDING_OPENAI_BASE_URL, (config.openai_base_url || "").trim());
    localStorage.setItem(STORAGE_KEYS.EMBEDDING_OLLAMA_BASE_URL, (config.ollama_base_url || "").trim());
    localStorage.setItem(STORAGE_KEYS.EMBEDDING_OPENAI_MODEL, (config.openai_model || "").trim());
    localStorage.setItem(STORAGE_KEYS.EMBEDDING_OLLAMA_MODEL, (config.ollama_model || "").trim());
  }, []);

  const refreshEmbeddingSettings = useCallback(async (announce = false): Promise<void> => {
    if (!isDesktop) return;
    try {
      const runtime = await invoke<EmbeddingRuntimeConfig>("get_embedding_runtime_config");
      setEmbeddingDraft(normalizeEmbeddingConfig(runtime));
      setEmbeddingError(null);
      if (announce) {
        toast.showSuccess(t("toast.refreshed"), 2500);
      }
    } catch (error) {
      setEmbeddingError(error instanceof Error ? error.message : String(error));
      setEmbeddingDraft((prev) => prev ?? normalizeEmbeddingConfig(DEFAULT_EMBEDDING_CONFIG));
      if (announce) {
        toast.showError(t("toast.refreshFailed"), 3000);
      }
    }
  }, [isDesktop, t, toast]);

  const isValidUrl = (value: string): boolean => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const onEmbeddingModeChange = useCallback((mode: EmbeddingMode): void => {
    setEmbeddingDraft((prev) => normalizeEmbeddingConfig({ ...(prev ?? DEFAULT_EMBEDDING_CONFIG), mode }));
  }, []);

  const onEmbeddingOpenAiBaseUrlChange = useCallback((value: string): void => {
    setEmbeddingDraft((prev) =>
      normalizeEmbeddingConfig({ ...(prev ?? DEFAULT_EMBEDDING_CONFIG), openai_base_url: value })
    );
  }, []);

  const onEmbeddingOllamaBaseUrlChange = useCallback((value: string): void => {
    setEmbeddingDraft((prev) =>
      normalizeEmbeddingConfig({ ...(prev ?? DEFAULT_EMBEDDING_CONFIG), ollama_base_url: value })
    );
  }, []);

  const onEmbeddingOpenAiModelChange = useCallback((value: string): void => {
    setEmbeddingDraft((prev) =>
      normalizeEmbeddingConfig({ ...(prev ?? DEFAULT_EMBEDDING_CONFIG), openai_model: value })
    );
  }, []);

  const onEmbeddingOllamaModelChange = useCallback((value: string): void => {
    setEmbeddingDraft((prev) =>
      normalizeEmbeddingConfig({ ...(prev ?? DEFAULT_EMBEDDING_CONFIG), ollama_model: value })
    );
  }, []);

  const saveEmbeddingSettings = useCallback(async (): Promise<void> => {
    if (!isDesktop || !embeddingDraft) return;
    setEmbeddingSaving(true);
    setEmbeddingError(null);
    try {
      const next = normalizeEmbeddingConfig(embeddingDraft);
      if (next.openai_base_url && !isValidUrl(next.openai_base_url)) {
        throw new Error(t("settings.errors.openAiEmbeddingUrlInvalid"));
      }
      if (next.ollama_base_url && !isValidUrl(next.ollama_base_url)) {
        throw new Error(t("settings.errors.ollamaEmbeddingUrlInvalid"));
      }
      const applied = await invoke<EmbeddingRuntimeConfig>("set_embedding_runtime_config", {
        config: {
          mode: next.mode,
          openai_base_url: next.openai_base_url?.trim() || null,
          ollama_base_url: next.ollama_base_url?.trim() || null,
          openai_model: next.openai_model?.trim() || null,
          ollama_model: next.ollama_model?.trim() || null,
        },
      });
      const normalized = normalizeEmbeddingConfig(applied);
      setEmbeddingDraft(normalized);
      persistEmbeddingConfig(normalized);
      toast.showSuccess(t("toast.saved"), 2500);
    } catch (e: unknown) {
      setEmbeddingError(e instanceof Error ? e.message : String(e));
    } finally {
      setEmbeddingSaving(false);
    }
  }, [isDesktop, embeddingDraft, persistEmbeddingConfig, t, toast]);

  const onEmbeddingOpenAiKeyFocus = useCallback((): void => {
    if (embeddingOpenAiKeyMasked) {
      setEmbeddingOpenAiKeyInput("");
      setEmbeddingOpenAiKeyMasked(false);
    }
  }, [embeddingOpenAiKeyMasked]);

  const onEmbeddingOpenAiKeyChange = useCallback((value: string): void => {
    setEmbeddingOpenAiKeyInput(value);
  }, []);

  const saveEmbeddingOpenAiKey = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setEmbeddingOpenAiKeySaving(true);
    setEmbeddingOpenAiKeyError(null);
    try {
      const trimmed = embeddingOpenAiKeyInput.trim();
      if (!trimmed || (embeddingOpenAiKeyMasked && trimmed === API_KEY_MASK)) {
        throw new Error(t("settings.errors.embeddingOpenAiKeyEmpty"));
      }
      await invoke("set_user_api_key", { apiKey: trimmed, providerId: "openai" });
      const status = await invoke<ApiKeyStatus>("get_api_key_status", { providerId: "openai" });
      applyEmbeddingOpenAiKeyStatus(status);
      toast.showSuccess(t("toast.saved"), 2500);
    } catch (e: unknown) {
      setEmbeddingOpenAiKeyError(e instanceof Error ? e.message : String(e));
    } finally {
      setEmbeddingOpenAiKeySaving(false);
    }
  }, [isDesktop, embeddingOpenAiKeyInput, embeddingOpenAiKeyMasked, applyEmbeddingOpenAiKeyStatus, t, toast]);

  const clearEmbeddingOpenAiKey = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setEmbeddingOpenAiKeySaving(true);
    setEmbeddingOpenAiKeyError(null);
    try {
      await invoke("clear_user_api_key", { providerId: "openai" });
      const status = await invoke<ApiKeyStatus>("get_api_key_status", { providerId: "openai" });
      applyEmbeddingOpenAiKeyStatus(status);
      toast.showSuccess(t("toast.saved"), 2500);
    } catch (e: unknown) {
      setEmbeddingOpenAiKeyError(e instanceof Error ? e.message : String(e));
    } finally {
      setEmbeddingOpenAiKeySaving(false);
    }
  }, [isDesktop, applyEmbeddingOpenAiKeyStatus, t, toast]);

  const onProviderChange = useCallback((nextId: string): void => {
    const defaults = getProviderDefaults(nextId);
    const snapshot = { provider_id: nextId, base_url: defaults.baseUrl, model: "" };
    setProviderModels([]);
    setProviderModelError(null);
    setProviderTestMessage(null);
    setProviderTestError(null);
    setProviderDraft(prev => prev ? {
      ...prev,
      provider_id: nextId,
      base_url: defaults.baseUrl,
      model: "",
    } : prev);
    void refreshProviderModels(true, true, snapshot, false);
  }, []);

  const onBaseUrlChange = useCallback((value: string): void => {
    setProviderTestMessage(null);
    setProviderTestError(null);
    setProviderDraft(prev => prev ? { ...prev, base_url: value } : prev);
  }, []);

  const onModelChange = useCallback((value: string): void => {
    setProviderTestMessage(null);
    setProviderTestError(null);
    setProviderDraft(prev => prev ? { ...prev, model: value } : prev);
  }, []);

  const refreshProviderModels = useCallback(async (
    force = false,
    resetModel = false,
    override?: ProviderConfig,
    announce = false
  ): Promise<void> => {
    const snapshot = override ?? providerDraft;
    if (!isDesktop || !snapshot) return;
    const baseUrl = snapshot.base_url.trim() || getProviderDefaults(snapshot.provider_id).baseUrl;
    const cacheKey = `${snapshot.provider_id}::${baseUrl}`;
    if (!force) {
      const cached = providerModelCacheRef.current.get(cacheKey);
      if (cached && cached.length > 0) {
        setProviderModels(cached);
        const fallback = pickDefaultModel(cached);
        if (resetModel) {
          setProviderDraft(prev => prev && prev.provider_id === snapshot.provider_id ? { ...prev, model: fallback } : prev);
        } else if (!cached.includes(snapshot.model)) {
          setProviderDraft(prev => prev && prev.provider_id === snapshot.provider_id ? { ...prev, model: fallback } : prev);
        }
        return;
      }
    }
    setProviderModelLoading(true);
    setProviderModelError(null);
    try {
      const models = await invoke<string[]>("list_provider_models", {
        providerId: snapshot.provider_id,
        baseUrl,
      });
      if (models.length > 0) {
        setProviderModels(models);
        providerModelCacheRef.current.set(cacheKey, models);
        if (resetModel || !models.includes(snapshot.model)) {
          const fallback = pickDefaultModel(models);
          setProviderDraft(prev => prev && prev.provider_id === snapshot.provider_id ? { ...prev, model: fallback } : prev);
        }
      }
      if (announce) {
        toast.showSuccess(t("toast.refreshed"), 2500);
      }
    } catch (e: unknown) {
      setProviderModelError(e instanceof Error ? e.message : String(e));
      if (announce) {
        toast.showError(t("toast.refreshFailed"), 3000);
      }
    } finally {
      setProviderModelLoading(false);
    }
  }, [isDesktop, providerDraft, t, toast]);

  const saveProviderSettings = useCallback(async (): Promise<void> => {
    if (!isDesktop || !providerDraft) return;
    setProviderSaving(true);
    setProviderError(null);
    try {
      const defaults = getProviderDefaults(providerDraft.provider_id);
      const baseUrl = providerDraft.base_url.trim() || defaults.baseUrl;
      const model = providerDraft.model.trim();
      if (!baseUrl || !model) {
        throw new Error(t("settings.errors.providerBaseUrlModelRequired"));
      }
      if (!isValidUrl(baseUrl)) {
        throw new Error(t("settings.errors.providerBaseUrlInvalid"));
      }
      const res = await invoke<ProviderConfig>("set_provider_config", {
        config: {
          ...providerDraft,
          base_url: baseUrl,
          model,
        },
      });
      setProviderDraft(res);
      toast.showSuccess(t("toast.providerSaved"), 2500);
    } catch (e: unknown) {
      setProviderError(e instanceof Error ? e.message : String(e));
    } finally {
      setProviderSaving(false);
    }
  }, [isDesktop, providerDraft, t, toast]);

  const testProviderConnection = useCallback(async (): Promise<void> => {
    if (!isDesktop || !providerDraft) return;
    setProviderTestLoading(true);
    setProviderTestMessage(null);
    setProviderTestError(null);
    try {
      const defaults = getProviderDefaults(providerDraft.provider_id);
      const baseUrl = providerDraft.base_url.trim() || defaults.baseUrl;
      const model = providerDraft.model.trim();
      if (!baseUrl || !model) {
        throw new Error(t("settings.errors.providerBaseUrlModelRequired"));
      }
      if (!isValidUrl(baseUrl)) {
        throw new Error(t("settings.errors.providerBaseUrlInvalid"));
      }

      const res = await invoke<ProviderConnectionTestResult>("test_provider_connection", {
        config: {
          ...providerDraft,
          base_url: baseUrl,
          model,
        },
      });
      // UX: keep success messaging short and consistent (toast only).
      // Backend message can contain details; we intentionally do not show it here.
      toast.showSuccess(t("toast.connectionOk"), 3000);
      setProviderTestMessage(t("toast.connectionOk"));

      if (providerTestMessageTimerRef.current) {
        window.clearTimeout(providerTestMessageTimerRef.current);
      }
      providerTestMessageTimerRef.current = window.setTimeout(() => {
        setProviderTestMessage(null);
      }, 3000);
      void res;
    } catch (e: unknown) {
      setProviderTestError(e instanceof Error ? e.message : String(e));
    } finally {
      setProviderTestLoading(false);
    }
  }, [isDesktop, providerDraft, t, toast]);

  const onApiKeyFocus = useCallback((): void => {
    if (apiKeyMasked) {
      setApiKeyInput("");
      setApiKeyMasked(false);
    }
  }, [apiKeyMasked]);

  const onApiKeyChange = useCallback((value: string): void => {
    setApiKeyInput(value);
  }, []);

  const saveApiKey = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    if (!providerDraft) {
      setApiKeyError(t("settings.errors.providerConfigLoading"));
      return;
    }
    setApiKeySaving(true);
    setApiKeyError(null);
    try {
      const trimmed = apiKeyInput.trim();
      if (!trimmed || (apiKeyMasked && trimmed === API_KEY_MASK)) {
        throw new Error(t("settings.errors.apiKeyEmpty"));
      }
      await invoke("set_user_api_key", { apiKey: trimmed, providerId: providerDraft?.provider_id });
      const status = await invoke<ApiKeyStatus>("get_api_key_status", {
        providerId: providerDraft?.provider_id,
      });
      applyApiKeyStatus(status);
      toast.showSuccess(t("toast.saved"), 2500);
    } catch (e: unknown) {
      setApiKeyError(e instanceof Error ? e.message : String(e));
    } finally {
      setApiKeySaving(false);
    }
  }, [isDesktop, providerDraft, apiKeyInput, apiKeyMasked, applyApiKeyStatus, t, toast]);

  const clearApiKey = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    if (!providerDraft) {
      setApiKeyError(t("settings.errors.providerConfigLoading"));
      return;
    }
    setApiKeySaving(true);
    setApiKeyError(null);
    try {
      await invoke("clear_user_api_key", { providerId: providerDraft?.provider_id });
      const status = await invoke<ApiKeyStatus>("get_api_key_status", {
        providerId: providerDraft?.provider_id,
      });
      applyApiKeyStatus(status);
      toast.showSuccess(t("toast.saved"), 2500);
    } catch (e: unknown) {
      setApiKeyError(e instanceof Error ? e.message : String(e));
    } finally {
      setApiKeySaving(false);
    }
  }, [isDesktop, providerDraft, applyApiKeyStatus, t, toast]);

  const onTavilyKeyFocus = useCallback((): void => {
    if (tavilyKeyMasked) {
      setTavilyKeyInput("");
      setTavilyKeyMasked(false);
    }
  }, [tavilyKeyMasked]);

  const onTavilyKeyChange = useCallback((value: string): void => {
    setTavilyKeyInput(value);
  }, []);

  const saveTavilyKey = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setTavilyKeySaving(true);
    setTavilyKeyError(null);
    try {
      const trimmed = tavilyKeyInput.trim();
      if (!trimmed || (tavilyKeyMasked && trimmed === API_KEY_MASK)) {
        throw new Error(t("settings.errors.tavilyKeyEmpty"));
      }
      await invoke("set_tavily_key", { key: trimmed });
      const status = await invoke<TavilyKeyStatus>("get_tavily_key_status");
      applyTavilyStatus(status);
      toast.showSuccess(t("toast.saved"), 2500);
    } catch (e: unknown) {
      setTavilyKeyError(e instanceof Error ? e.message : String(e));
    } finally {
      setTavilyKeySaving(false);
    }
  }, [isDesktop, tavilyKeyInput, tavilyKeyMasked, applyTavilyStatus, t, toast]);

  const clearTavilyKey = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setTavilyKeySaving(true);
    setTavilyKeyError(null);
    try {
      await invoke("clear_tavily_key");
      const status = await invoke<TavilyKeyStatus>("get_tavily_key_status");
      applyTavilyStatus(status);
      toast.showSuccess(t("toast.saved"), 2500);
    } catch (e: unknown) {
      setTavilyKeyError(e instanceof Error ? e.message : String(e));
    } finally {
      setTavilyKeySaving(false);
    }
  }, [isDesktop, applyTavilyStatus, t, toast]);

  const onWebSearchToggle = useCallback((): void => {
    setWebSearchEnabled(prev => {
      const next = !prev;
      patchUserPreferences({ web_search_enabled: next });
      return next;
    });
  }, [patchUserPreferences]);

  const onAutoVerifyToggle = useCallback((): void => {
    // SECURITY: Auto-verify runs project commands inside the monitored workspace.
    if (!autoVerifyEnabled) {
      const ok = window.confirm(
        t("settings.errors.autoVerifyConfirm")
      );
      if (!ok) return;
    }
    setAutoVerifyEnabled(prev => {
      const next = !prev;
      patchUserPreferences({ auto_verify_enabled: next });
      return next;
    });
  }, [autoVerifyEnabled, patchUserPreferences, t]);

  const onGuruReplySoundToggle = useCallback((): void => {
    setGuruReplySoundEnabled((prev) => {
      const next = !prev;
      patchUserPreferences({ guru_reply_sound_enabled: next });
      return next;
    });
  }, [patchUserPreferences]);

  const onLocalePreferenceChange = useCallback((locale: "en" | "tr"): void => {
    patchUserPreferences({ language: locale });
  }, [patchUserPreferences]);

  const onExportPDF = useCallback((logs: Record<string, Critique>, path: string): void => {
    if (exportPdfInProgress) return;

    // Clear any existing timer
    if (exportStatusTimerRef.current) {
      window.clearTimeout(exportStatusTimerRef.current);
      exportStatusTimerRef.current = null;
    }

    void (async () => {
      setExportPdfInProgress(true);
      setExportPdfError(null);
      setExportPdfMessage(null);
      try {
        const result = await exportPdfFn({ logs, path });
        if (result.mode === "tauri") {
          const savedPath = result.savedPath || "your Downloads folder";
          const openedText = result.folderOpened ? t("toast.folderOpened") : "";
          toast.showSuccess(
            t("toast.exportSaved", { path: savedPath, opened: openedText }).trim(),
            3000
          );
        } else {
          toast.showSuccess(t("toast.saved"), 2500);
        }
      } catch (e: unknown) {
        setExportPdfError(e instanceof Error ? e.message : String(e));

        // Auto-dismiss error message after 5 seconds
        exportStatusTimerRef.current = window.setTimeout(() => {
          setExportPdfError(null);
          exportStatusTimerRef.current = null;
        }, 5000);
      } finally {
        setExportPdfInProgress(false);
      }
    })();
  }, [exportPdfFn, exportPdfInProgress, toast]);

  const checkForUpdates = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setUpdateChecking(true);
    setUpdateError(null);
    const checkedAt = new Date().toISOString();
    try {
      const res = await invoke<UpdateCheckResult | null>("check_app_update");
      if (res && typeof res.status === "string") {
        const currentVersion = res.current_version || appVersion || "Unknown";
        const latestVersion =
          res.latest_version ??
          (res.status === "up_to_date" ? currentVersion : appVersion ?? currentVersion);
        setUpdateInfo({
          ...res,
          current_version: currentVersion,
          latest_version: latestVersion,
          last_checked_at: res.last_checked_at ?? checkedAt,
        });
        setUpdateError(res.error ?? null);
      } else {
        const msg = t("settings.errors.updateUnavailable");
        setUpdateInfo(buildFallbackUpdateInfo(appVersion ?? "Unknown", "unavailable", msg));
        setUpdateError(msg);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const displayMessage = t("settings.errors.updateUnavailableHint");
      setUpdateError(displayMessage);
      setUpdateInfo(buildFallbackUpdateInfo(appVersion ?? "Unknown", "unavailable", displayMessage));
      console.warn("[Guardian] Update check failed:", message);
    } finally {
      setUpdateChecking(false);
    }
  }, [isDesktop, appVersion]);

  const installUpdate = useCallback(async (): Promise<void> => {
    if (!isDesktop || updateInfo?.status !== "available") return;
    setUpdateInstalling(true);
    setUpdateError(null);
    try {
      await invoke("install_app_update");
    } catch (e: unknown) {
      setUpdateError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdateInstalling(false);
    }
  }, [isDesktop, updateInfo?.status]);

  useEffect(() => {
    if (!isDesktop) return;

    const onForeground = (): void => {
      if (document.visibilityState === "visible") {
        void checkForUpdates();
      }
    };

    const interval = window.setInterval(() => {
      void checkForUpdates();
    }, 15 * 60 * 1000);

    window.addEventListener("focus", onForeground);
    document.addEventListener("visibilitychange", onForeground);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onForeground);
      document.removeEventListener("visibilitychange", onForeground);
    };
  }, [isDesktop, checkForUpdates]);

  const providerLabel = providerDraft ? getProviderDefaults(providerDraft.provider_id).label : "provider";
  const providerId = (providerDraft?.provider_id ?? "").toLowerCase();
  const requiresApiKey =
    isDesktop &&
    Boolean(providerDraft) &&
    providerId !== "ollama" &&
    apiKeyStatus?.has_key === false;
  const webSearchReady = Boolean(tavilyKeyStatus?.has_key);

  return {
    providerDraft,
    providerError,
    providerSaving,
    providerModels,
    providerModelLoading,
    providerModelError,
    providerTestLoading,
    providerTestMessage,
    providerTestError,
    embeddingDraft,
    embeddingError,
    embeddingSaving,
    embeddingOpenAiKeyStatus,
    embeddingOpenAiKeyInput,
    embeddingOpenAiKeyMasked,
    embeddingOpenAiKeyError,
    embeddingOpenAiKeySaving,
    apiKeyStatus,
    apiKeyInput,
    apiKeyMasked,
    apiKeyError,
    apiKeySaving,
    tavilyKeyStatus,
    tavilyKeyInput,
    tavilyKeyMasked,
    tavilyKeyError,
    tavilyKeySaving,
    webSearchEnabled,
    webSearchDepth,
    autoVerifyEnabled,
    guruReplySoundEnabled,
    scanProfile,
    scanProfileSaving,
    scanProfileError,
    userPreferences,
    userPreferencesSaving,
    userPreferencesError,
    updateInfo,
    updateDismissed,
    updateInstalling,
    updateError,
    updateChecking,
    settingsTab,
    setSettingsTab,
    setProviderDraft,
    onProviderChange,
    onBaseUrlChange,
    onModelChange,
    refreshProviderModels,
    saveProviderSettings,
    testProviderConnection,
    onEmbeddingModeChange,
    onEmbeddingOpenAiBaseUrlChange,
    onEmbeddingOllamaBaseUrlChange,
    onEmbeddingOpenAiModelChange,
    onEmbeddingOllamaModelChange,
    saveEmbeddingSettings,
    refreshEmbeddingSettings,
    onEmbeddingOpenAiKeyFocus,
    onEmbeddingOpenAiKeyChange,
    saveEmbeddingOpenAiKey,
    clearEmbeddingOpenAiKey,
    onApiKeyFocus,
    onApiKeyChange,
    saveApiKey,
    clearApiKey,
    onTavilyKeyFocus,
    onTavilyKeyChange,
    saveTavilyKey,
    clearTavilyKey,
    setWebSearchEnabled,
    onWebSearchToggle,
    setWebSearchDepth,
    onWebSearchDepthChange,
    setAutoVerifyEnabled,
    onAutoVerifyToggle,
    setGuruReplySoundEnabled,
    onGuruReplySoundToggle,
    onLocalePreferenceChange,
    setScanProfile,
    saveScanProfile,
    updateUserPreferences: patchUserPreferences,
    refreshUserPreferences,
    resetUserPreferences,
    onExportPDF,
    setUpdateDismissed,
    checkForUpdates,
    installUpdate,
    providerLabel,
    requiresApiKey,
    webSearchReady,
    exportPdfInProgress,
    exportPdfMessage,
    exportPdfError,
  };
}

export default useSettings;
