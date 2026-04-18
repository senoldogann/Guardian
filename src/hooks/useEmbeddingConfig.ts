import { useState, useEffect, useCallback } from "react";
import { invoke, isTauriRuntime } from "../lib/tauri";
import { STORAGE_KEYS } from "../constants";
import { useToast } from "./useToast";
import { useI18n } from "../i18n";
import type { ApiKeyStatus, EmbeddingMode, EmbeddingRuntimeConfig } from "../types";

const API_KEY_MASK = "••••••";

const DEFAULT_EMBEDDING_CONFIG: EmbeddingRuntimeConfig = {
  mode: "auto",
  openai_base_url: "",
  ollama_base_url: "http://localhost:11434",
  openai_model: "text-embedding-3-small",
  ollama_model: "nomic-embed-text",
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

const isValidUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export interface UseEmbeddingConfigReturn {
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
  saveEmbeddingSettings: () => Promise<void>;
  refreshEmbeddingSettings: (announce?: boolean) => Promise<void>;
  onEmbeddingOpenAiKeyFocus: () => void;
  onEmbeddingOpenAiKeyChange: (value: string) => void;
  saveEmbeddingOpenAiKey: () => Promise<void>;
  clearEmbeddingOpenAiKey: () => Promise<void>;
}

export function useEmbeddingConfig(settingsOpen: boolean): UseEmbeddingConfigReturn {
  const isDesktop = isTauriRuntime();
  const toast = useToast();
  const { t } = useI18n();

  const [embeddingDraft, setEmbeddingDraft] = useState<EmbeddingRuntimeConfig | null>(null);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);
  const [embeddingSaving, setEmbeddingSaving] = useState(false);
  const [embeddingOpenAiKeyStatus, setEmbeddingOpenAiKeyStatus] = useState<ApiKeyStatus | null>(null);
  const [embeddingOpenAiKeyInput, setEmbeddingOpenAiKeyInput] = useState("");
  const [embeddingOpenAiKeyMasked, setEmbeddingOpenAiKeyMasked] = useState(false);
  const [embeddingOpenAiKeyError, setEmbeddingOpenAiKeyError] = useState<string | null>(null);
  const [embeddingOpenAiKeySaving, setEmbeddingOpenAiKeySaving] = useState(false);

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

  // Sync embedding config on mount
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

  // Load embedding OpenAI key status
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

  return {
    embeddingDraft,
    embeddingError,
    embeddingSaving,
    embeddingOpenAiKeyStatus,
    embeddingOpenAiKeyInput,
    embeddingOpenAiKeyMasked,
    embeddingOpenAiKeyError,
    embeddingOpenAiKeySaving,
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
  };
}
