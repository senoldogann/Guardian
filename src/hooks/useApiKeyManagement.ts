import { useState, useEffect, useCallback } from "react";
import { invoke, isTauriRuntime } from "../lib/tauri";
import { useToast } from "./useToast";
import { useI18n } from "../i18n";
import type { ApiKeyStatus, TavilyKeyStatus, ProviderConfig } from "../types";

const API_KEY_MASK = "••••••";

export interface UseApiKeyManagementReturn {
  apiKeyStatus: ApiKeyStatus | null;
  apiKeyInput: string;
  apiKeyMasked: boolean;
  apiKeyError: string | null;
  apiKeySaving: boolean;
  tavilyKeyStatus: TavilyKeyStatus | null;
  tavilyKeyInput: string;
  tavilyKeyMasked: boolean;
  tavilyKeyError: string | null;
  tavilyKeySaving: boolean;
  onApiKeyFocus: () => void;
  onApiKeyChange: (value: string) => void;
  saveApiKey: () => Promise<void>;
  clearApiKey: () => Promise<void>;
  onTavilyKeyFocus: () => void;
  onTavilyKeyChange: (value: string) => void;
  saveTavilyKey: () => Promise<void>;
  clearTavilyKey: () => Promise<void>;
  requiresApiKey: boolean;
  webSearchReady: boolean;
}

export function useApiKeyManagement(opts: {
  providerId?: string;
  settingsOpen: boolean;
  providerDraft: ProviderConfig | null;
  setWebSearchEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}): UseApiKeyManagementReturn {
  const { providerId, settingsOpen, providerDraft, setWebSearchEnabled } = opts;
  const isDesktop = isTauriRuntime();
  const toast = useToast();
  const { t } = useI18n();

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
  }, [t, setWebSearchEnabled]);

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

  const pId = (providerId ?? "").toLowerCase();
  const requiresApiKey =
    isDesktop &&
    Boolean(providerDraft) &&
    pId !== "ollama" &&
    apiKeyStatus?.has_key === false;
  const webSearchReady = Boolean(tavilyKeyStatus?.has_key);

  return {
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
    onApiKeyFocus,
    onApiKeyChange,
    saveApiKey,
    clearApiKey,
    onTavilyKeyFocus,
    onTavilyKeyChange,
    saveTavilyKey,
    clearTavilyKey,
    requiresApiKey,
    webSearchReady,
  };
}
