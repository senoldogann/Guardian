import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import clsx from "clsx";
import {
  Moon,
  Sun,
  Server,
  KeyRound,
  ShieldAlert,
  RefreshCw,
  Search,
  Download,
  Database,
  CircleHelp,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { openExternal } from "../lib/tauri";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useI18n } from "../i18n";

export type EmbeddingMode = "auto" | "openai" | "ollama" | "local";
export type SettingsTab = "general" | "provider" | "embedding" | "web" | "updates" | "export";

export interface ProviderConfig {
  provider_id: string;
  base_url: string;
  model: string;
}

export interface ApiKeyStatus {
  has_key: boolean;
  source: string;
  warning?: string | null;
}

export interface TavilyKeyStatus {
  has_key: boolean;
  source: string;
}

export interface EmbeddingRuntimeConfig {
  mode: EmbeddingMode;
  openai_base_url?: string | null;
  ollama_base_url?: string | null;
  openai_model?: string | null;
  ollama_model?: string | null;
}

export interface UpdateCheckResult {
  status: string;
  current_version: string;
  latest_version?: string | null;
  notes?: string | null;
  error?: string | null;
  last_checked_at?: string | null;
}

const PROVIDER_OPTIONS = [
  { id: "ollama", label: "Ollama (Local/Hosted)", baseUrl: "http://localhost:11434" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", label: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com/v1" },
  { id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { id: "github-models", label: "GitHub Models", baseUrl: "https://models.github.ai" },
] as const;

const getProviderDefaults = (providerId: string) => {
  const match = PROVIDER_OPTIONS.find((p) => p.id === providerId);
  return match ?? PROVIDER_OPTIONS[0];
};

interface InfoPopoverProps {
  title: string;
  note: string;
}

function InfoPopover({ title, note }: InfoPopoverProps): ReactElement {
  return (
    <details className="relative inline-block">
      <summary className="list-none cursor-pointer select-none text-text-muted hover:text-text-main transition-colors">
        <CircleHelp className="w-3.5 h-3.5" />
      </summary>
      <div className="absolute right-0 mt-2 w-72 rounded-lg border border-border-main bg-surface p-3 shadow-2xl z-20">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-main">{title}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-text-muted">{note}</p>
      </div>
    </details>
  );
}

interface StyledSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

function StyledSelect({ children, className, ...props }: StyledSelectProps) {
  return (
    <div className="relative group">
      <select
        className={clsx(
          "appearance-none w-full bg-background border border-border-main rounded-lg py-2 pl-3 pr-8 text-xs text-text-main outline-none focus:border-[var(--focus-border)] cursor-pointer transition-colors group-hover:border-[var(--accent-500)]",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none group-hover:text-text-main transition-colors" />
    </div>
  );
}

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

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  theme: "dark" | "light";
  onThemeToggle: () => void;
  isDesktop: boolean;
  providerProps: ProviderSettingsProps;
  webProps: WebSettingsProps;
  embeddingProps: EmbeddingSettingsProps;
  updateProps: UpdateSettingsProps;
  onExportPDF: () => void;
  exportPdfInProgress: boolean;
  exportPdfMessage: string | null;
  exportPdfError: string | null;
  settingsTab: SettingsTab;
  onSettingsTabChange: (tab: SettingsTab) => void;
}

export function SettingsModal({
  open,
  onClose,
  theme,
  onThemeToggle,
  isDesktop,
  providerProps,
  webProps,
  embeddingProps,
  updateProps,
  onExportPDF,
  exportPdfInProgress,
  exportPdfError,
  settingsTab,
  onSettingsTabChange,
}: SettingsModalProps): ReactElement | null {
  const { locale, setLocale, t } = useI18n();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const exportStatusMessages = useMemo(
    () => [
      t("settings.export.preparing"),
      t("settings.export.rendering"),
      t("settings.export.finalizing"),
      t("settings.export.openingFolder"),
    ],
    [t],
  );

  useFocusTrap({
    active: open,
    containerRef: modalRef,
    onEscape: onClose,
    initialFocusRef: closeButtonRef,
  });

  const {
    providerDraft,
    providerError,
    providerSaving,
    providerModels,
    providerModelLoading,
    providerModelError,
    providerTestLoading,
    providerTestMessage,
    providerTestError,
    onProviderChange,
    onBaseUrlChange,
    onModelChange,
    onRefreshModels,
    onSaveProvider,
    onTestProviderConnection,
    apiKeyStatus,
    apiKeyInput,
    apiKeyError,
    apiKeySaving,
    onApiKeyFocus,
    onApiKeyChange,
    onSaveApiKey,
    onClearApiKey,
  } = providerProps;

  const {
    tavilyKeyStatus,
    tavilyKeyInput,
    tavilyKeyMasked,
    tavilyKeyError,
    tavilyKeySaving,
    webSearchEnabled,
    webSearchDepth,
    webSearchReady,
    onWebSearchToggle,
    onWebSearchDepthChange,
    autoVerifyEnabled,
    onAutoVerifyToggle,
    scanProfile,
    scanProfileSaving,
    scanProfileError,
    onScanProfileChange,
    onSaveScanProfile,
    onTavilyKeyFocus,
    onTavilyKeyChange,
    onSaveTavilyKey,
    onClearTavilyKey,
  } = webProps;

  const {
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
    onSaveEmbeddingSettings,
    onRefreshEmbeddingSettings,
    onEmbeddingOpenAiKeyFocus,
    onEmbeddingOpenAiKeyChange,
    onSaveEmbeddingOpenAiKey,
    onClearEmbeddingOpenAiKey,
  } = embeddingProps;

  const {
    updateInfo,
    updateChecking,
    updateInstalling,
    updateError,
    onCheckUpdates,
    onInstallUpdate,
  } = updateProps;

  const API_KEY_MASK = "••••••";
  const providerLabel = providerDraft ? getProviderDefaults(providerDraft.provider_id).label : "provider";
  const requiresApiKey = isDesktop && Boolean(providerDraft) && apiKeyStatus?.has_key === false;
  const currentVersionLabel = updateInfo?.current_version ?? "Unknown";
  const latestVersionLabel = updateInfo?.latest_version
    ?? (updateInfo?.status === "up_to_date"
      ? updateInfo.current_version
      : (updateChecking ? "Checking..." : "Unavailable"));
  const updateStatusLabel = updateChecking
    ? "checking"
    : updateInfo?.status
      ? updateInfo.status.replace(/_/g, " ")
      : "idle";
  const lastCheckLabel = updateInfo?.last_checked_at
    ? new Date(updateInfo.last_checked_at).toLocaleString()
    : "Not checked yet";

  const settingsTabClass = (tab: SettingsTab) =>
    clsx(
      "px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors",
      settingsTab === tab
        ? "bg-[var(--accent-500)] text-background"
        : "bg-white/10 text-text-main hover:bg-white/20"
    );

  const [exportStatusMessageIndex, setExportStatusMessageIndex] = useState(0);

  useEffect(() => {
    if (!exportPdfInProgress) {
      setExportStatusMessageIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      setExportStatusMessageIndex((prev) => (prev + 1) % exportStatusMessages.length);
    }, 1200);
    return () => window.clearInterval(interval);
  }, [exportPdfInProgress, exportStatusMessages.length]);

  const openGithubModelsTokenPage = (): void => {
    if (!isDesktop) return;
    void openExternal("https://github.com/settings/personal-access-tokens/new");
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guardian-settings-title"
        className="max-w-3xl w-[92%] bg-surface border border-border-main rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3
              id="guardian-settings-title"
              className="text-sm font-black uppercase tracking-widest text-text-main"
            >
              {t("settings.title")}
            </h3>
            <p className="text-xs text-text-muted">{t("settings.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onThemeToggle}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-text-main transition-all cursor-pointer"
              title={t("settings.toggleTheme")}
            >
              {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors cursor-pointer text-xs uppercase tracking-widest"
              ref={closeButtonRef}
            >
              {t("common.close")}
            </button>
          </div>
        </div>

        {!isDesktop && (
          <div className="text-[10px] text-amber-400">
            {t("settings.desktopRequired")}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-border-main pb-4">
          <button onClick={() => onSettingsTabChange("general")} className={settingsTabClass("general")}>{t("settings.tabs.general")}</button>
          <button onClick={() => onSettingsTabChange("provider")} className={settingsTabClass("provider")}>{t("settings.tabs.provider")}</button>
          <button onClick={() => onSettingsTabChange("embedding")} className={settingsTabClass("embedding")}>{t("settings.tabs.embedding")}</button>
          <button onClick={() => onSettingsTabChange("web")} className={settingsTabClass("web")}>{t("settings.tabs.web")}</button>
          <button onClick={() => onSettingsTabChange("updates")} className={settingsTabClass("updates")}>{t("settings.tabs.updates")}</button>
          <button onClick={() => onSettingsTabChange("export")} className={settingsTabClass("export")}>{t("settings.tabs.export")}</button>
        </div>

        {settingsTab === "general" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                <ShieldAlert className="w-4 h-4 text-[var(--accent-500)]" />
                {t("settings.general.safety")}
              </div>
              <InfoPopover
                title={t("settings.general.autoVerifyTitle")}
                note={t("settings.general.autoVerifyNote")}
              />
            </div>
            <div className="text-[10px] text-text-muted">
              {t("settings.general.autoVerifyDescription")}
            </div>
            <div className="flex items-center justify-between bg-background border border-border-main rounded-lg px-3 py-2">
              <div className="text-[10px] text-text-muted">
                {t("settings.general.autoVerifyStatus", {
                  status: autoVerifyEnabled ? t("common.enabled") : t("common.disabled"),
                })}
              </div>
              <button
                onClick={onAutoVerifyToggle}
                disabled={!isDesktop}
                className={clsx(
                  "px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors",
                  autoVerifyEnabled ? "bg-[var(--accent-500)] text-background" : "bg-white/10 text-text-main",
                  !isDesktop && "opacity-50 cursor-not-allowed"
                )}
              >
                {autoVerifyEnabled ? t("common.on") : t("common.off")}
              </button>
            </div>

            <div className="pt-4 border-t border-border-main space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                  <ShieldAlert className="w-4 h-4 text-[var(--accent-500)]" />
                  {t("settings.general.scanScopeTitle")}
                </div>
                <InfoPopover
                  title={t("settings.general.scanScopeTitle")}
                  note={t("settings.general.scanScopeNote")}
                />
              </div>
              <div className="text-[10px] text-text-muted">
                {t("settings.general.scanScopeCurrent", { profile: scanProfile })}
              </div>
              <div className="grid grid-cols-1 gap-2">
                <StyledSelect
                  disabled={!isDesktop || scanProfileSaving}
                  value={scanProfile}
                  onChange={(e) => onScanProfileChange(e.target.value as "source" | "extended" | "full")}
                >
                  <option value="source">{t("settings.general.scanScopeSource")}</option>
                  <option value="extended">{t("settings.general.scanScopeExtended")}</option>
                  <option value="full">{t("settings.general.scanScopeFull")}</option>
                </StyledSelect>
                {scanProfileError && (
                  <div className="text-[10px] text-rose-400">{scanProfileError}</div>
                )}
                <button
                  onClick={onSaveScanProfile}
                  disabled={!isDesktop || scanProfileSaving}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {scanProfileSaving ? t("common.saving") : t("settings.general.saveScanScope")}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-border-main space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                  <ShieldAlert className="w-4 h-4 text-[var(--accent-500)]" />
                  {t("settings.general.languageTitle")}
                </div>
                <InfoPopover title={t("settings.general.languageTitle")} note={t("settings.general.languageNote")} />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <StyledSelect
                  disabled={!isDesktop}
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as "en" | "tr")}
                >
                  <option value="en">{t("language.english")}</option>
                  <option value="tr">{t("language.turkish")}</option>
                </StyledSelect>
              </div>
            </div>
          </div>
        )}

        {settingsTab === "provider" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                <Server className="w-4 h-4 text-[var(--accent-500)]" />
                {t("settings.provider.title")}
              </div>
              <InfoPopover
                title={t("settings.provider.popoverTitle")}
                note={t("settings.provider.popoverNote")}
              />
            </div>
            <div className="space-y-3">
              <div className="text-[10px] text-text-muted">
                {t("settings.provider.currentProvider", {
                  provider: providerDraft ? getProviderDefaults(providerDraft.provider_id).label : t("common.loading"),
                })}
              </div>
              {!providerDraft ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-3 w-20 bg-border-main rounded" />
                  <div className="h-9 w-full bg-border-main rounded" />
                  <div className="h-3 w-24 bg-border-main rounded" />
                  <div className="h-9 w-full bg-border-main rounded" />
                  <div className="h-3 w-16 bg-border-main rounded" />
                  <div className="h-9 w-full bg-border-main rounded" />
                </div>
              ) : (
                <>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500">{t("settings.provider.providerLabel")}</label>
                  <StyledSelect
                    disabled={!isDesktop}
                    value={providerDraft.provider_id}
                    onChange={(e) => onProviderChange(e.target.value)}
                  >
                    {PROVIDER_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </StyledSelect>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500">{t("settings.provider.baseUrlLabel")}</label>
                  {providerDraft.provider_id === "ollama" ? (
                    <StyledSelect
                      disabled={!isDesktop}
                      value={providerDraft.base_url}
                      onChange={(e) => onBaseUrlChange(e.target.value)}
                    >
                      <option value="http://localhost:11434">Local (http://localhost:11434)</option>
                      <option value="https://ollama.com">Cloud (https://ollama.com)</option>
                    </StyledSelect>
                  ) : (
                    <input
                      disabled={!isDesktop}
                      value={providerDraft.base_url}
                      onChange={(e) => onBaseUrlChange(e.target.value)}
                      className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                      placeholder={getProviderDefaults(providerDraft.provider_id).baseUrl}
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500">{t("settings.provider.modelLabel")}</label>
                    <button
                      onClick={onRefreshModels}
                      disabled={!isDesktop || providerModelLoading}
                      className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-text-main transition-colors"
                    >
                      {providerModelLoading ? t("settings.provider.modelsLoading") : t("settings.provider.refreshModels")}
                    </button>
                  </div>
                  {providerModelLoading ? (
                    <div className="h-9 w-full bg-border-main rounded animate-pulse" />
                  ) : providerModels.length > 0 ? (
                    <StyledSelect
                      disabled={!isDesktop}
                      value={providerDraft.model}
                      onChange={(e) => onModelChange(e.target.value)}
                    >
                      {providerModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </StyledSelect>
                  ) : (
                    <input
                      disabled={!isDesktop}
                      value={providerDraft.model}
                      onChange={(e) => onModelChange(e.target.value)}
                      className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                      placeholder={t("settings.provider.modelPlaceholder")}
                    />
                  )}
                  {providerModelError && (
                    <div className="text-[10px] text-rose-400">
                      {requiresApiKey
                        ? t("settings.provider.requiresKeyLoadModels", { provider: providerLabel })
                        : providerModelError}
                    </div>
                  )}
                  {providerError && <div className="text-[10px] text-rose-400">{providerError}</div>}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={onSaveProvider}
                      disabled={!isDesktop || providerSaving}
                      className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
                    >
                      {providerSaving ? t("common.saving") : t("settings.provider.saveProvider")}
                    </button>
                    <button
                      onClick={onTestProviderConnection}
                      disabled={!isDesktop || providerSaving || providerTestLoading}
                      className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 rounded-md transition-colors disabled:opacity-50"
                    >
                      {providerTestLoading ? t("settings.provider.testing") : t("settings.provider.testConnection")}
                    </button>
                  </div>
                  {providerTestMessage && (
                    <div className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2">
                      {providerTestMessage}
                    </div>
                  )}
                  {providerTestError && (
                    <div className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2">
                      {providerTestError}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pt-4 border-t border-border-main space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                  <KeyRound className="w-4 h-4 text-[var(--accent-500)]" />
                  {t("settings.provider.apiKeyTitle")}
                </div>
                <InfoPopover
                  title={t("settings.provider.apiKeyPopoverTitle")}
                  note={t("settings.provider.apiKeyPopoverNote")}
                />
              </div>
              <div className="text-[10px] text-text-muted">
                {apiKeyStatus?.has_key
                  ? t("settings.provider.keyStored", {
                      provider: providerDraft ? getProviderDefaults(providerDraft.provider_id).label : "provider",
                      source: apiKeyStatus.source,
                    })
                  : t("settings.provider.noKeyStored", {
                      provider: providerDraft ? getProviderDefaults(providerDraft.provider_id).label : "provider",
                    })}
              </div>
              {providerDraft?.provider_id === "github-models" && (
                <div className="space-y-2">
                  <div className="text-[10px] text-text-muted">
                    GitHub Models requires a fine‑grained GitHub token with <span className="font-semibold">models:read</span> permission.
                  </div>
                  <ol className="text-[10px] text-text-muted list-decimal pl-4 space-y-1">
                    <li>Create a fine‑grained GitHub token.</li>
                    <li>Repository access: choose <span className="font-semibold">Public repositories</span>.</li>
                    <li>Permissions → Account: enable <span className="font-semibold">Models (read‑only)</span>.</li>
                    <li>Ignore Copilot‑related permissions (Copilot Chat/Requests/Editor Context).</li>
                    <li>Paste the token here and click Save Key.</li>
                  </ol>
                  <div className="text-[10px] text-text-muted">Model visibility checklist:</div>
                  <ol className="text-[10px] text-text-muted list-decimal pl-4 space-y-1">
                    <li>Confirm your Copilot plan supports the target models.</li>
                    <li>Check organization model access (allowlist/publishers).</li>
                    <li>Ensure the token is created under the account/org with access.</li>
                  </ol>
                  <button
                    onClick={openGithubModelsTokenPage}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-200)] hover:opacity-90 text-text-main rounded-md transition-colors"
                  >
                    Open Token Settings
                  </button>
                </div>
              )}
              {requiresApiKey && (
                <div className="text-[10px] text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2">
                  {t("settings.provider.setupRequired", { provider: providerLabel })}
                </div>
              )}
              <input
                disabled={!isDesktop}
                type="password"
                value={apiKeyInput}
                onFocus={onApiKeyFocus}
                onChange={(e) => onApiKeyChange(e.target.value)}
                className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                placeholder={t("settings.provider.apiKeyPlaceholder")}
              />
              {apiKeyError && <div className="text-[10px] text-rose-400">{apiKeyError}</div>}
              <div className="flex gap-2">
                <button
                  onClick={onSaveApiKey}
                  disabled={!isDesktop || apiKeySaving}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {apiKeySaving ? t("common.saving") : t("settings.provider.saveKey")}
                </button>
                <button
                  onClick={onClearApiKey}
                  disabled={!isDesktop || apiKeySaving}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 rounded-md transition-colors disabled:opacity-50"
                >
                  {t("common.clear")}
                </button>
              </div>
            </div>
          </div>
        )}

        {settingsTab === "embedding" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                <Database className="w-4 h-4 text-[var(--accent-500)]" />
                {t("settings.embedding.title")}
              </div>
              <InfoPopover
                title={t("settings.embedding.popoverTitle")}
                note={t("settings.embedding.popoverNote")}
              />
            </div>
            <div className="text-[10px] text-text-muted">
              {t("settings.embedding.note")}
            </div>
            <div className="rounded-xl border border-border-main bg-background/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-widest text-zinc-500">{t("settings.embedding.modeLabel")}</label>
                <button
                  onClick={onRefreshEmbeddingSettings}
                  className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-text-main transition-colors"
                >
                  {t("settings.embedding.refresh")}
                </button>
              </div>
              <StyledSelect
                disabled={!isDesktop || !embeddingDraft}
                value={embeddingDraft?.mode ?? "auto"}
                onChange={(e) => onEmbeddingModeChange(e.target.value as EmbeddingMode)}
              >
                <option value="auto">{t("settings.embedding.modeAuto")}</option>
                <option value="openai">{t("settings.embedding.modeOpenAi")}</option>
                <option value="ollama">{t("settings.embedding.modeOllama")}</option>
                <option value="local">{t("settings.embedding.modeLocal")}</option>
              </StyledSelect>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500">{t("settings.embedding.openAiBaseUrl")}</label>
                  <input
                    disabled={!isDesktop || !embeddingDraft}
                    value={embeddingDraft?.openai_base_url ?? ""}
                    onChange={(e) => onEmbeddingOpenAiBaseUrlChange(e.target.value)}
                    className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500">{t("settings.embedding.openAiModel")}</label>
                  <input
                    disabled={!isDesktop || !embeddingDraft}
                    value={embeddingDraft?.openai_model ?? ""}
                    onChange={(e) => onEmbeddingOpenAiModelChange(e.target.value)}
                    className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                    placeholder="text-embedding-3-small"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500">{t("settings.embedding.ollamaBaseUrl")}</label>
                  <input
                    disabled={!isDesktop || !embeddingDraft}
                    value={embeddingDraft?.ollama_base_url ?? ""}
                    onChange={(e) => onEmbeddingOllamaBaseUrlChange(e.target.value)}
                    className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                    placeholder="http://localhost:11434"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500">{t("settings.embedding.ollamaModel")}</label>
                  <input
                    disabled={!isDesktop || !embeddingDraft}
                    value={embeddingDraft?.ollama_model ?? ""}
                    onChange={(e) => onEmbeddingOllamaModelChange(e.target.value)}
                    className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                    placeholder="nomic-embed-text"
                  />
                </div>
              </div>

              <div className="text-[10px] text-text-muted">
                {t("settings.embedding.localSetupNote", {
                  command: "ollama pull nomic-embed-text",
                })}
              </div>

              {embeddingError && (
                <div className="text-[10px] text-rose-400">{embeddingError}</div>
              )}

              <button
                onClick={onSaveEmbeddingSettings}
                disabled={!isDesktop || embeddingSaving || !embeddingDraft}
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {embeddingSaving ? t("common.saving") : t("settings.embedding.saveEmbeddingSettings")}
              </button>
            </div>

            <div className="rounded-xl border border-border-main bg-background/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                  <KeyRound className="w-4 h-4 text-[var(--accent-500)]" />
                  {t("settings.embedding.openAiKeyTitle")}
                </div>
                <InfoPopover
                  title={t("settings.embedding.openAiKeyPopoverTitle")}
                  note={t("settings.embedding.openAiKeyPopoverNote")}
                />
              </div>
              <div className="text-[10px] text-text-muted">
                {t("settings.embedding.openAiKeyNote")}
              </div>
              <div className="text-[10px] text-text-muted">
                {embeddingOpenAiKeyStatus?.has_key
                  ? t("settings.embedding.openAiKeyStored", { source: embeddingOpenAiKeyStatus.source })
                  : t("settings.embedding.openAiKeyMissing")}
              </div>
              <input
                disabled={!isDesktop}
                type="password"
                value={embeddingOpenAiKeyInput}
                onFocus={onEmbeddingOpenAiKeyFocus}
                onChange={(e) => onEmbeddingOpenAiKeyChange(e.target.value)}
                className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                placeholder={t("settings.embedding.openAiKeyPlaceholder")}
              />
              {embeddingOpenAiKeyError && (
                <div className="text-[10px] text-rose-400">{embeddingOpenAiKeyError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={onSaveEmbeddingOpenAiKey}
                  disabled={
                    !isDesktop ||
                    embeddingOpenAiKeySaving ||
                    !embeddingOpenAiKeyInput.trim() ||
                    (embeddingOpenAiKeyMasked && embeddingOpenAiKeyInput === API_KEY_MASK)
                  }
                  className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {embeddingOpenAiKeySaving ? t("common.saving") : t("settings.embedding.saveOpenAiKey")}
                </button>
                <button
                  onClick={onClearEmbeddingOpenAiKey}
                  disabled={!isDesktop || embeddingOpenAiKeySaving}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 rounded-md transition-colors disabled:opacity-50"
                >
                  {t("settings.embedding.clearOpenAiKey")}
                </button>
              </div>
            </div>
          </div>
        )}

        {settingsTab === "web" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                <Search className="w-4 h-4 text-[var(--accent-500)]" />
                {t("settings.web.title")}
              </div>
              <InfoPopover
                title={t("settings.web.popoverTitle")}
                note={t("settings.web.popoverNote")}
              />
            </div>
            <div className="text-[10px] text-text-muted">
              {t("settings.web.note")}
            </div>
            <div className="flex items-center justify-between bg-background border border-border-main rounded-lg px-3 py-2">
              <div className="text-[10px] text-text-muted">
                {t("settings.web.status", { status: webSearchEnabled ? t("common.enabled") : t("common.disabled") })}
              </div>
              <button
                onClick={onWebSearchToggle}
                disabled={!webSearchReady}
                className={clsx(
                  "px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors",
                  webSearchEnabled ? "bg-[var(--accent-500)] text-background" : "bg-white/10 text-text-main",
                  !webSearchReady && "opacity-50 cursor-not-allowed"
                )}
              >
                {webSearchEnabled ? t("common.on") : t("common.off")}
              </button>
            </div>
            <div className="flex items-center justify-between bg-background border border-border-main rounded-lg px-3 py-2">
              <div className="text-[10px] text-text-muted">
                {t("settings.web.searchDepth")}:{" "}
                <span className="text-text-main font-semibold">{webSearchDepth}</span>
              </div>
              <StyledSelect
                value={webSearchDepth}
                onChange={(e) => onWebSearchDepthChange(e.target.value as typeof webSearchDepth)}
                aria-label={t("settings.web.depthAria")}
              >
                <option value="basic">Basic (Default)</option>
                <option value="advanced">Advanced</option>
                <option value="fast">Fast</option>
                <option value="ultra-fast">Ultra-fast</option>
                <option value="auto">Auto</option>
              </StyledSelect>
            </div>
            {!webSearchReady && (
              <div className="text-[10px] text-amber-400">
                {t("settings.web.tavilyKeyHint")}
              </div>
            )}
            <div className="text-[10px] text-text-muted">
              {tavilyKeyStatus?.has_key
                ? t("settings.web.keyStored", { source: tavilyKeyStatus.source })
                : t("settings.web.keyMissing")}
            </div>
            <input
              disabled={!isDesktop}
              type="password"
              value={tavilyKeyInput}
              onFocus={onTavilyKeyFocus}
              onChange={(e) => onTavilyKeyChange(e.target.value)}
              className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
              placeholder={t("settings.web.tavilyKeyPlaceholder")}
            />
            {!tavilyKeyInput.trim() && !tavilyKeyMasked && (
              <div className="text-[10px] text-amber-400">{t("settings.web.keyRequired")}</div>
            )}
            {tavilyKeyError && <div className="text-[10px] text-rose-400">{tavilyKeyError}</div>}
            <div className="flex gap-2">
              <button
                onClick={onSaveTavilyKey}
                disabled={!isDesktop || tavilyKeySaving || !tavilyKeyInput.trim() || (tavilyKeyMasked && tavilyKeyInput === API_KEY_MASK)}
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {tavilyKeySaving ? t("common.saving") : t("settings.web.saveKey")}
              </button>
              <button
                onClick={onClearTavilyKey}
                disabled={!isDesktop || tavilyKeySaving}
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 rounded-md transition-colors disabled:opacity-50"
              >
                {t("common.clear")}
              </button>
            </div>
          </div>
        )}

        {settingsTab === "updates" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <RefreshCw className="w-4 h-4 text-[var(--accent-500)]" />
              {t("settings.updates.title")}
            </div>
            <div className="text-[10px] text-text-muted">
              {t("settings.updates.note")}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-text-muted">
              <span>{t("settings.updates.current")}: {currentVersionLabel}</span>
              <span>{t("settings.updates.latest")}: {latestVersionLabel}</span>
              <span>{t("settings.updates.lastCheck")}: {lastCheckLabel}</span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-[9px] uppercase tracking-widest text-text-main">
                {updateStatusLabel}
              </span>
            </div>
            {updateInfo?.status === "available" && (
              <button
                onClick={() => openExternal("https://www.guardianide.com/changelog")}
                className="flex items-center gap-2 text-[10px] text-[var(--accent-500)] hover:text-[var(--accent-400)] transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="underline">{t("settings.updates.viewChangelog")}</span>
              </button>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onCheckUpdates}
                disabled={!isDesktop || updateChecking}
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 text-text-main rounded-md transition-colors disabled:opacity-50"
              >
                {updateChecking ? t("settings.updates.checking") : t("settings.updates.checkNow")}
              </button>
              {updateInfo?.status === "available" && (
                <button
                  onClick={onInstallUpdate}
                  disabled={!isDesktop || updateInstalling}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {updateInstalling ? t("settings.updates.updating") : t("settings.updates.installUpdate")}
                </button>
              )}
            </div>
            {updateError && <div className="text-[10px] text-rose-400">{updateError}</div>}

            <div className="pt-4 border-t border-border-main space-y-2">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                {t("settings.updates.aboutTitle")}
              </div>
              <div className="text-[10px] text-text-muted bg-white/5 border border-border-main rounded-lg px-3 py-2">
                {t("settings.updates.builtBy", { name: "Senol Dogan" })}
              </div>
              <div className="flex flex-wrap gap-3 text-[10px]">
                <button
                  type="button"
                  onClick={() => openExternal("https://www.guardianide.com/")}
                  className="flex items-center gap-2 text-[10px] text-[var(--accent-500)] hover:text-[var(--accent-400)] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="underline">https://www.guardianide.com/</span>
                </button>
                <button
                  type="button"
                  onClick={() => openExternal("https://www.guardianide.com/contact")}
                  className="flex items-center gap-2 text-[10px] text-[var(--accent-500)] hover:text-[var(--accent-400)] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="underline">{t("settings.updates.feedback")}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {settingsTab === "export" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <Download className="w-4 h-4 text-[var(--accent-500)]" />
              {t("settings.export.title")}
            </div>
            <div className="text-[10px] text-text-muted bg-white/5 border border-border-main rounded-lg px-3 py-2">
              {t("settings.export.note")}
            </div>
            <button
              onClick={onExportPDF}
              disabled={exportPdfInProgress}
              className="w-full px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:opacity-60"
            >
              {exportPdfInProgress ? t("settings.export.exporting") : t("settings.export.exportPdf")}
            </button>
            {exportPdfInProgress && (
              <div className="rounded-lg border border-border-main bg-white/5 px-3 py-2 text-[10px] text-text-muted flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent-500)] shrink-0" />
                <span className="transition-opacity duration-300">
                  {exportStatusMessages[exportStatusMessageIndex]}
                </span>
              </div>
            )}
            {/* Success feedback is shown via top-right toast to reduce clutter in this tab. */}
            {exportPdfError && !exportPdfInProgress && (
              <div className="rounded-lg border border-rose-200 bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 px-3 py-2 text-[10px] text-rose-900 dark:text-rose-300 font-bold">
                {exportPdfError}
              </div>
            )}
          </div>
        )}
      </div>
    </div >
  );
}

export default SettingsModal;
