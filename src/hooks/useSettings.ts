import { useState, useEffect, useCallback, useRef } from "react";
import { invoke, isTauriRuntime } from "../lib/tauri";
import type { Critique } from "../components/CritiqueAccordionRow";

export type ProviderConfig = {
  provider_id: string;
  base_url: string;
  model: string;
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

export type SettingsTab = "provider" | "web" | "updates" | "export";

export type UpdateCheckResult = {
  status: string;
  current_version: string;
  latest_version?: string | null;
  notes?: string | null;
  error?: string | null;
};

export const PROVIDER_OPTIONS = [
  { id: "ollama", label: "Ollama (Local/Hosted)", baseUrl: "https://ollama.com" },
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

const buildFallbackUpdateInfo = (version: string): UpdateCheckResult => ({
  status: "up_to_date",
  current_version: version,
  latest_version: version,
  notes: null,
  error: null,
});

export interface UseSettingsReturn {
  // Provider
  providerDraft: ProviderConfig | null;
  providerError: string | null;
  providerSaving: boolean;
  providerModels: string[];
  providerModelLoading: boolean;
  providerModelError: string | null;

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
  refreshProviderModels: (force?: boolean, resetModel?: boolean, override?: ProviderConfig) => Promise<void>;
  saveProviderSettings: () => Promise<void>;
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
  onExportPDF: (logs: Record<string, Critique>, path: string) => void;
  setUpdateDismissed: React.Dispatch<React.SetStateAction<boolean>>;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;

  // Derived
  providerLabel: string;
  requiresApiKey: boolean;
  webSearchReady: boolean;
}

export function useSettings(
  exportPdfFn: (args: { logs: Record<string, Critique>; path: string }) => void,
  settingsOpen = false
): UseSettingsReturn {
  const isDesktop = isTauriRuntime();

  // Provider state
  const [providerDraft, setProviderDraft] = useState<ProviderConfig | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerModels, setProviderModels] = useState<string[]>([]);
  const [providerModelLoading, setProviderModelLoading] = useState(false);
  const [providerModelError, setProviderModelError] = useState<string | null>(null);
  const providerModelCacheRef = useRef<Map<string, string[]>>(new Map());
  const providerIdentityRef = useRef<{ id: string; base_url: string } | null>(null);

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
      return localStorage.getItem("guardian_web_search_enabled") === "true";
    }
    return false;
  });

  // Update state
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);

  // Tab state
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("provider");

  // Persist web search setting
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("guardian_web_search_enabled", String(webSearchEnabled));
  }, [webSearchEnabled]);

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

  // Check for updates on mount
  useEffect(() => {
    if (!isDesktop) return;
    const loadVersion = async (): Promise<void> => {
      try {
        const version = await invoke<string>("get_app_version");
        setAppVersion(version);
        setUpdateInfo(prev => prev ?? buildFallbackUpdateInfo(version));
      } catch {
        // Non-critical: update panel can still run on demand
      }
    };
    void loadVersion();
  }, [isDesktop]);

  // Check for updates on mount
  useEffect(() => {
    if (!isDesktop) return;
    void checkForUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setApiKeyError("API key status could not be loaded.");
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
  }, []);

  const applyTavilyStatus = useCallback((status: TavilyKeyStatus | null | undefined): void => {
    if (!status || typeof status.has_key !== "boolean") {
      setTavilyKeyStatus(null);
      setTavilyKeyError("Tavily key status could not be loaded.");
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
  }, []);

  const isValidUrl = (value: string): boolean => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const onProviderChange = useCallback((nextId: string): void => {
    const defaults = getProviderDefaults(nextId);
    const snapshot = { provider_id: nextId, base_url: defaults.baseUrl, model: "" };
    setProviderModels([]);
    setProviderModelError(null);
    setProviderDraft(prev => prev ? {
      ...prev,
      provider_id: nextId,
      base_url: defaults.baseUrl,
      model: "",
    } : prev);
    void refreshProviderModels(true, true, snapshot);
  }, []);

  const onBaseUrlChange = useCallback((value: string): void => {
    setProviderDraft(prev => prev ? { ...prev, base_url: value } : prev);
  }, []);

  const onModelChange = useCallback((value: string): void => {
    setProviderDraft(prev => prev ? { ...prev, model: value } : prev);
  }, []);

  const refreshProviderModels = useCallback(async (
    force = false,
    resetModel = false,
    override?: ProviderConfig
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
    } catch (e: unknown) {
      setProviderModelError(e instanceof Error ? e.message : String(e));
    } finally {
      setProviderModelLoading(false);
    }
  }, [isDesktop, providerDraft]);

  const saveProviderSettings = useCallback(async (): Promise<void> => {
    if (!isDesktop || !providerDraft) return;
    setProviderSaving(true);
    setProviderError(null);
    try {
      const defaults = getProviderDefaults(providerDraft.provider_id);
      const baseUrl = providerDraft.base_url.trim() || defaults.baseUrl;
      const model = providerDraft.model.trim();
      if (!baseUrl || !model) {
        throw new Error("Provider base URL and model are required.");
      }
      if (!isValidUrl(baseUrl)) {
        throw new Error("Provider base URL must be a valid http/https URL.");
      }
      const res = await invoke<ProviderConfig>("set_provider_config", {
        config: {
          ...providerDraft,
          base_url: baseUrl,
          model,
        },
      });
      setProviderDraft(res);
    } catch (e: unknown) {
      setProviderError(e instanceof Error ? e.message : String(e));
    } finally {
      setProviderSaving(false);
    }
  }, [isDesktop, providerDraft]);

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
      setApiKeyError("Provider configuration is still loading. Try again in a moment.");
      return;
    }
    setApiKeySaving(true);
    setApiKeyError(null);
    try {
      const trimmed = apiKeyInput.trim();
      if (!trimmed || (apiKeyMasked && trimmed === API_KEY_MASK)) {
        throw new Error("API key cannot be empty.");
      }
      await invoke("set_user_api_key", { apiKey: trimmed, providerId: providerDraft?.provider_id });
      const status = await invoke<ApiKeyStatus>("get_api_key_status", {
        providerId: providerDraft?.provider_id,
      });
      applyApiKeyStatus(status);
    } catch (e: unknown) {
      setApiKeyError(e instanceof Error ? e.message : String(e));
    } finally {
      setApiKeySaving(false);
    }
  }, [isDesktop, providerDraft, apiKeyInput, apiKeyMasked, applyApiKeyStatus]);

  const clearApiKey = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    if (!providerDraft) {
      setApiKeyError("Provider configuration is still loading. Try again in a moment.");
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
    } catch (e: unknown) {
      setApiKeyError(e instanceof Error ? e.message : String(e));
    } finally {
      setApiKeySaving(false);
    }
  }, [isDesktop, providerDraft, applyApiKeyStatus]);

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
        throw new Error("Tavily key cannot be empty.");
      }
      await invoke("set_tavily_key", { key: trimmed });
      const status = await invoke<TavilyKeyStatus>("get_tavily_key_status");
      applyTavilyStatus(status);
    } catch (e: unknown) {
      setTavilyKeyError(e instanceof Error ? e.message : String(e));
    } finally {
      setTavilyKeySaving(false);
    }
  }, [isDesktop, tavilyKeyInput, tavilyKeyMasked, applyTavilyStatus]);

  const clearTavilyKey = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setTavilyKeySaving(true);
    setTavilyKeyError(null);
    try {
      await invoke("clear_tavily_key");
      const status = await invoke<TavilyKeyStatus>("get_tavily_key_status");
      applyTavilyStatus(status);
    } catch (e: unknown) {
      setTavilyKeyError(e instanceof Error ? e.message : String(e));
    } finally {
      setTavilyKeySaving(false);
    }
  }, [isDesktop, applyTavilyStatus]);

  const onWebSearchToggle = useCallback((): void => {
    setWebSearchEnabled(prev => !prev);
  }, []);

  const onExportPDF = useCallback((logs: Record<string, Critique>, path: string): void => {
    void exportPdfFn({ logs, path });
  }, [exportPdfFn]);

  const checkForUpdates = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setUpdateChecking(true);
    setUpdateError(null);
    try {
      const res = await invoke<UpdateCheckResult | null>("check_app_update");
      if (res && typeof res.status === "string") {
        const latestVersion =
          res.latest_version ??
          (res.status === "up_to_date" ? res.current_version : appVersion ?? null);
        setUpdateInfo({
          ...res,
          latest_version: latestVersion,
        });
        setUpdateError(res.error ?? null);
      } else {
        if (appVersion) {
          setUpdateInfo(buildFallbackUpdateInfo(appVersion));
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setUpdateError(message);
      if (appVersion) {
        setUpdateInfo(buildFallbackUpdateInfo(appVersion));
      }
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
  const requiresApiKey = isDesktop && Boolean(providerDraft) && apiKeyStatus?.has_key === false;
  const webSearchReady = Boolean(tavilyKeyStatus?.has_key);

  return {
    providerDraft,
    providerError,
    providerSaving,
    providerModels,
    providerModelLoading,
    providerModelError,
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
    onExportPDF,
    setUpdateDismissed,
    checkForUpdates,
    installUpdate,
    providerLabel,
    requiresApiKey,
    webSearchReady,
  };
}

export default useSettings;
