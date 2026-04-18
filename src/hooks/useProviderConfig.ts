import { useState, useEffect, useCallback, useRef } from "react";
import { invoke, isTauriRuntime } from "../lib/tauri";
import { useToast } from "./useToast";
import { useI18n } from "../i18n";
import type { ProviderConfig } from "../types";

export type ProviderConnectionTestResult = {
  ok: boolean;
  provider_id: string;
  base_url: string;
  model: string;
  message: string;
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

const isValidUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export interface UseProviderConfigReturn {
  providerDraft: ProviderConfig | null;
  providerError: string | null;
  providerSaving: boolean;
  providerModels: string[];
  providerModelLoading: boolean;
  providerModelError: string | null;
  providerTestLoading: boolean;
  providerTestMessage: string | null;
  providerTestError: string | null;
  setProviderDraft: React.Dispatch<React.SetStateAction<ProviderConfig | null>>;
  onProviderChange: (nextId: string) => void;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  refreshProviderModels: (
    force?: boolean,
    resetModel?: boolean,
    override?: ProviderConfig,
    announce?: boolean,
  ) => Promise<void>;
  saveProviderSettings: () => Promise<void>;
  testProviderConnection: () => Promise<void>;
  providerLabel: string;
}

export function useProviderConfig(settingsOpen: boolean): UseProviderConfigReturn {
  const isDesktop = isTauriRuntime();
  const toast = useToast();
  const { t } = useI18n();

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

  // Provider identity tracking for model refresh
  useEffect(() => {
    if (!isDesktop || !providerDraft) return;
    const id = providerDraft.provider_id;
    const baseUrl = providerDraft.base_url.trim() || getProviderDefaults(id).baseUrl;
    const prev = providerIdentityRef.current;
    if (prev && prev.id === id && prev.base_url === baseUrl) return;
    providerIdentityRef.current = { id, base_url: baseUrl };
  }, [isDesktop, providerDraft?.provider_id, providerDraft?.base_url]);

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

  const providerLabel = providerDraft ? getProviderDefaults(providerDraft.provider_id).label : "provider";

  // suppress unused settingsOpen lint — kept for API parity
  void settingsOpen;

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
    setProviderDraft,
    onProviderChange,
    onBaseUrlChange,
    onModelChange,
    refreshProviderModels,
    saveProviderSettings,
    testProviderConnection,
    providerLabel,
  };
}
