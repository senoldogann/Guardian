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
  Bell,
} from "lucide-react";
import { openExternal } from "../lib/tauri";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useI18n } from "../i18n";
import type {
  EmbeddingMode,
  SettingsTab,
  ProviderConfig,
  ApiKeyStatus,
  TavilyKeyStatus,
  EmbeddingRuntimeConfig,
  UpdateCheckResult,
} from "../types";

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

const DEFAULT_LIGHT_PALETTE = {
  accent: "#5f879a",
  panel: "#f7f9fc",
  text: "#1f2b38",
} as const;

const DEFAULT_DARK_PALETTE = {
  accent: "#5f8fa5",
  panel: "#141a21",
  text: "#e6edf5",
} as const;

type PalettePreset = {
  id: string;
  accent: string;
  panel: string;
  text: string;
  labelKey: string;
};

const LIGHT_PALETTE_PRESETS: PalettePreset[] = [
  { id: "cloud", accent: "#5f879a", panel: "#f7f9fc", text: "#1f2b38", labelKey: "settings.general.paletteCloud" },
  { id: "stone", accent: "#6f7f92", panel: "#f4f6f9", text: "#2a3440", labelKey: "settings.general.paletteStone" },
  { id: "mint", accent: "#4f8b79", panel: "#f3faf7", text: "#1e342d", labelKey: "settings.general.paletteMint" },
  { id: "sand", accent: "#9a7858", panel: "#faf6f1", text: "#3d2d1f", labelKey: "settings.general.paletteSand" },
];

const DARK_PALETTE_PRESETS: PalettePreset[] = [
  { id: "midnight", accent: "#5f8fa5", panel: "#141a21", text: "#e6edf5", labelKey: "settings.general.paletteMidnight" },
  { id: "graphite", accent: "#7a8ea8", panel: "#151821", text: "#e8ecf4", labelKey: "settings.general.paletteGraphite" },
  { id: "aurora", accent: "#5d9b88", panel: "#131a1a", text: "#deefe8", labelKey: "settings.general.paletteAurora" },
  { id: "ember", accent: "#a87f5f", panel: "#1a1613", text: "#f1e6d8", labelKey: "settings.general.paletteEmber" },
];

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
      <div className="absolute right-0 bottom-full mb-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-border-main bg-surface p-3 shadow-2xl z-[70]">
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
          "appearance-none w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 pl-3 pr-8 text-xs text-text-main outline-none focus:border-[var(--focus-border)] cursor-pointer transition-colors group-hover:border-[var(--accent-500)]",
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

export function SettingsModal({
  open,
  onClose,
  theme,
  onThemeToggle,
  onLocaleChange,
  isDesktop,
  providerProps,
  webProps,
  embeddingProps,
  updateProps,
  personalizationProps,
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
    onEscape: () => {},
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
    guruReplySoundEnabled,
    onGuruReplySoundToggle,
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
    userPreferences,
    userPreferencesSaving,
    userPreferencesError,
    onUpdateUserPreferences,
    onRefreshUserPreferences,
    onResetUserPreferences,
  } = personalizationProps;

  const [modelInstructionDraft, setModelInstructionDraft] = useState("");

  useEffect(() => {
    setModelInstructionDraft(userPreferences?.model_custom_instructions ?? "");
  }, [userPreferences?.model_custom_instructions, open]);

  const normalizeHexColor = (value: string | undefined, fallback: string): string => {
    const raw = (value ?? "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
  };

  const previewPaletteMode: "light" | "dark" =
    userPreferences?.theme_mode === "system"
      ? theme
      : (userPreferences?.theme_mode ?? "dark");
  const previewPalette =
    previewPaletteMode === "light"
      ? {
          accent: normalizeHexColor(
            userPreferences?.light_palette.accent,
            DEFAULT_LIGHT_PALETTE.accent,
          ),
          panel: normalizeHexColor(
            userPreferences?.light_palette.panel,
            DEFAULT_LIGHT_PALETTE.panel,
          ),
          text: normalizeHexColor(
            userPreferences?.light_palette.text,
            DEFAULT_LIGHT_PALETTE.text,
          ),
        }
      : {
          accent: normalizeHexColor(
            userPreferences?.dark_palette.accent,
            DEFAULT_DARK_PALETTE.accent,
          ),
          panel: normalizeHexColor(
            userPreferences?.dark_palette.panel,
            DEFAULT_DARK_PALETTE.panel,
          ),
          text: normalizeHexColor(
            userPreferences?.dark_palette.text,
            DEFAULT_DARK_PALETTE.text,
          ),
        };
  const personalizationUiDisabled = !isDesktop || !userPreferences;
  const profileInitialScanLimit = scanProfile === "source" ? 200 : scanProfile === "extended" ? 300 : 500;
  const profileBatchSizeCap = scanProfile === "full" ? 2 : 3;
  const requestedMaxFilesPerScan = userPreferences?.scan_tuning.max_files_per_scan ?? 300;
  const requestedBatchSizeHint = userPreferences?.scan_tuning.max_batch_size_hint ?? 3;
  const effectiveMaxFilesPerScan = Math.min(requestedMaxFilesPerScan, profileInitialScanLimit);
  const effectiveBatchSizeHint = Math.min(requestedBatchSizeHint, profileBatchSizeCap);
  const scanTuningPolicyOverrideActive =
    effectiveMaxFilesPerScan !== requestedMaxFilesPerScan
    || effectiveBatchSizeHint !== requestedBatchSizeHint;

  const {
    updateInfo,
    updateChecking,
    updateInstalling,
    updateError,
    onCheckUpdates,
    onInstallUpdate,
  } = updateProps;

  const API_KEY_MASK = "••••••";
  const providerLabel = providerDraft ? getProviderDefaults(providerDraft.provider_id).label : t("common.loading");
  const requiresApiKey = isDesktop && Boolean(providerDraft) && apiKeyStatus?.has_key === false;
  const currentVersionLabel = updateInfo?.current_version ?? t("common.unknown");
  const latestVersionLabel = updateInfo?.latest_version
    ?? (updateInfo?.status === "up_to_date"
      ? updateInfo.current_version
      : (updateChecking ? t("settings.updates.checking") : t("settings.updates.unavailable")));
  const updateStatusBadge = updateChecking
    ? t("settings.updates.status.checking")
    : updateInfo?.status === "up_to_date"
      ? t("settings.updates.status.upToDate")
      : updateInfo?.status === "available"
        ? t("settings.updates.status.available")
        : updateInfo?.status === "error"
          ? t("settings.updates.status.error")
          : t("settings.updates.status.idle");
  const lastCheckLabel = updateInfo?.last_checked_at
    ? new Date(updateInfo.last_checked_at).toLocaleString()
    : t("settings.updates.notCheckedYet");

  const settingsTabClass = (tab: SettingsTab) =>
    clsx(
      "px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors",
      settingsTab === tab
        ? "bg-[var(--accent-500)] text-background"
        : "bg-[var(--panel-muted)] text-text-main hover:bg-[var(--panel-bg)]"
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
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
              className="p-2 rounded-lg bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] text-text-main transition-all cursor-pointer"
              title={t("settings.toggleTheme")}
            >
              {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-md bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] transition-colors cursor-pointer text-xs uppercase tracking-widest"
              ref={closeButtonRef}
            >
              {t("common.close")}
            </button>
          </div>
        </div>

        {!isDesktop && (
          <div className="text-[10px] text-[color:var(--tone-warning-text)]">
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
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
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
            <div className="flex items-center justify-between bg-[var(--panel-muted)] border border-border-main rounded-lg px-3 py-2">
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
                  autoVerifyEnabled ? "bg-[var(--accent-500)] text-background" : "bg-[var(--panel-muted)] text-text-main",
                  !isDesktop && "opacity-50 cursor-not-allowed"
                )}
              >
                {autoVerifyEnabled ? t("common.on") : t("common.off")}
              </button>
            </div>

            <div className="pt-4 border-t border-border-main space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
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
                  <div className="text-[10px] text-[color:var(--tone-critical-text)]">{scanProfileError}</div>
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
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
                  <ShieldAlert className="w-4 h-4 text-[var(--accent-500)]" />
                  {t("settings.general.languageTitle")}
                </div>
                <InfoPopover title={t("settings.general.languageTitle")} note={t("settings.general.languageNote")} />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <StyledSelect
                  disabled={!isDesktop}
                  value={locale}
                  onChange={(e) => {
                    const nextLocale = e.target.value as "en" | "tr";
                    setLocale(nextLocale);
                    onLocaleChange?.(nextLocale);
                  }}
                >
                  <option value="en">{t("language.english")}</option>
                  <option value="tr">{t("language.turkish")}</option>
                </StyledSelect>
              </div>
            </div>

            <div className="pt-4 border-t border-border-main space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
                  <Sun className="w-4 h-4 text-[var(--accent-500)]" />
                  {t("settings.general.personalizationTitle")}
                </div>
                <InfoPopover
                  title={t("settings.general.personalizationTitle")}
                  note={t("settings.general.personalizationNote")}
                />
              </div>
              <div className="text-[10px] text-text-muted">
                {t("settings.general.personalizationDescription")}
              </div>

              <div className="rounded-lg border border-border-main bg-[var(--panel-muted)] p-3 space-y-3">
                <div className="text-[10px] uppercase tracking-widest text-text-muted">
                  {t("settings.general.appearanceTitle")}
                </div>
                <div
                  className="rounded-lg border px-3 py-2 text-[10px]"
                  style={{
                    backgroundColor: previewPalette.panel,
                    borderColor: previewPalette.accent,
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: previewPalette.accent }}
                  >
                    {t("settings.general.appearancePreviewLabel", {
                      mode:
                        previewPaletteMode === "dark"
                          ? t("settings.general.themeModeDark")
                          : t("settings.general.themeModeLight"),
                    })}
                  </div>
                  <div className="mt-1 text-[10px]" style={{ color: previewPalette.text }}>
                    {t("settings.general.appearancePreviewDescription")}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2 rounded-lg border border-border-main bg-[var(--panel-muted)] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-widest text-text-muted">
                      {t("settings.general.lightPaletteTitle")}
                    </div>
                    <div className="space-y-1">
                      <div className="text-[9px] uppercase tracking-widest text-text-muted">
                        {t("settings.general.palettePresetsLabel")}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {LIGHT_PALETTE_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            disabled={personalizationUiDisabled}
                            onClick={() =>
                              onUpdateUserPreferences({
                                light_palette: {
                                  accent: preset.accent,
                                  panel: preset.panel,
                                  text: preset.text,
                                },
                              })
                            }
                            className="px-2 py-1.5 text-[9px] rounded-md border border-border-main bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] transition-colors disabled:opacity-50"
                          >
                            <span className="inline-flex items-center gap-1.5 text-text-main">
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-border-main"
                                style={{ backgroundColor: preset.accent }}
                              />
                              {t(preset.labelKey)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <label className="text-[10px] text-text-muted">
                        {t("settings.general.accentColorLabel")}
                      </label>
                      <input
                        type="color"
                        disabled={personalizationUiDisabled}
                        value={normalizeHexColor(
                          userPreferences?.light_palette.accent,
                          DEFAULT_LIGHT_PALETTE.accent,
                        )}
                        onChange={(e) =>
                          onUpdateUserPreferences({
                            light_palette: { accent: e.target.value },
                          })
                        }
                        className="h-7 w-10 rounded border border-border-main bg-[var(--panel-muted)] p-0.5"
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <label className="text-[10px] text-text-muted">
                        {t("settings.general.panelColorLabel")}
                      </label>
                      <input
                        type="color"
                        disabled={personalizationUiDisabled}
                        value={normalizeHexColor(
                          userPreferences?.light_palette.panel,
                          DEFAULT_LIGHT_PALETTE.panel,
                        )}
                        onChange={(e) =>
                          onUpdateUserPreferences({
                            light_palette: { panel: e.target.value },
                          })
                        }
                        className="h-7 w-10 rounded border border-border-main bg-[var(--panel-muted)] p-0.5"
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <label className="text-[10px] text-text-muted">
                        {t("settings.general.textColorLabel")}
                      </label>
                      <input
                        type="color"
                        disabled={personalizationUiDisabled}
                        value={normalizeHexColor(
                          userPreferences?.light_palette.text,
                          DEFAULT_LIGHT_PALETTE.text,
                        )}
                        onChange={(e) =>
                          onUpdateUserPreferences({
                            light_palette: { text: e.target.value },
                          })
                        }
                        className="h-7 w-10 rounded border border-border-main bg-[var(--panel-muted)] p-0.5"
                      />
                    </div>
                    <button
                      onClick={() =>
                        onUpdateUserPreferences({
                          light_palette: { ...DEFAULT_LIGHT_PALETTE },
                        })
                      }
                      disabled={personalizationUiDisabled}
                      className="w-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] text-text-main rounded-md transition-colors disabled:opacity-50"
                    >
                      {t("settings.general.restoreLightPalette")}
                    </button>
                  </div>

                  <div className="space-y-2 rounded-lg border border-border-main bg-[var(--panel-muted)] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-widest text-text-muted">
                      {t("settings.general.darkPaletteTitle")}
                    </div>
                    <div className="space-y-1">
                      <div className="text-[9px] uppercase tracking-widest text-text-muted">
                        {t("settings.general.palettePresetsLabel")}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DARK_PALETTE_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            disabled={personalizationUiDisabled}
                            onClick={() =>
                              onUpdateUserPreferences({
                                dark_palette: {
                                  accent: preset.accent,
                                  panel: preset.panel,
                                  text: preset.text,
                                },
                              })
                            }
                            className="px-2 py-1.5 text-[9px] rounded-md border border-border-main bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] transition-colors disabled:opacity-50"
                          >
                            <span className="inline-flex items-center gap-1.5 text-text-main">
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-border-main"
                                style={{ backgroundColor: preset.accent }}
                              />
                              {t(preset.labelKey)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <label className="text-[10px] text-text-muted">
                        {t("settings.general.accentColorLabel")}
                      </label>
                      <input
                        type="color"
                        disabled={personalizationUiDisabled}
                        value={normalizeHexColor(
                          userPreferences?.dark_palette.accent,
                          DEFAULT_DARK_PALETTE.accent,
                        )}
                        onChange={(e) =>
                          onUpdateUserPreferences({
                            dark_palette: { accent: e.target.value },
                          })
                        }
                        className="h-7 w-10 rounded border border-border-main bg-[var(--panel-muted)] p-0.5"
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <label className="text-[10px] text-text-muted">
                        {t("settings.general.panelColorLabel")}
                      </label>
                      <input
                        type="color"
                        disabled={personalizationUiDisabled}
                        value={normalizeHexColor(
                          userPreferences?.dark_palette.panel,
                          DEFAULT_DARK_PALETTE.panel,
                        )}
                        onChange={(e) =>
                          onUpdateUserPreferences({
                            dark_palette: { panel: e.target.value },
                          })
                        }
                        className="h-7 w-10 rounded border border-border-main bg-[var(--panel-muted)] p-0.5"
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <label className="text-[10px] text-text-muted">
                        {t("settings.general.textColorLabel")}
                      </label>
                      <input
                        type="color"
                        disabled={personalizationUiDisabled}
                        value={normalizeHexColor(
                          userPreferences?.dark_palette.text,
                          DEFAULT_DARK_PALETTE.text,
                        )}
                        onChange={(e) =>
                          onUpdateUserPreferences({
                            dark_palette: { text: e.target.value },
                          })
                        }
                        className="h-7 w-10 rounded border border-border-main bg-[var(--panel-muted)] p-0.5"
                      />
                    </div>
                    <button
                      onClick={() =>
                        onUpdateUserPreferences({
                          dark_palette: { ...DEFAULT_DARK_PALETTE },
                        })
                      }
                      disabled={personalizationUiDisabled}
                      className="w-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] text-text-main rounded-md transition-colors disabled:opacity-50"
                    >
                      {t("settings.general.restoreDarkPalette")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-text-muted">
                    {t("settings.general.themeModeLabel")}
                  </label>
                  <StyledSelect
                    disabled={personalizationUiDisabled}
                    value={userPreferences?.theme_mode ?? "dark"}
                    onChange={(e) =>
                      onUpdateUserPreferences({
                        theme_mode: e.target.value as "dark" | "light" | "system",
                      })
                    }
                  >
                    <option value="dark">{t("settings.general.themeModeDark")}</option>
                    <option value="light">{t("settings.general.themeModeLight")}</option>
                    <option value="system">{t("settings.general.themeModeSystem")}</option>
                  </StyledSelect>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-text-muted">
                    {t("settings.general.fontFamilyLabel")}
                  </label>
                  <StyledSelect
                    disabled={personalizationUiDisabled}
                    value={userPreferences?.font_family ?? "space-grotesk"}
                    onChange={(e) =>
                      onUpdateUserPreferences({
                        font_family: e.target.value,
                      })
                    }
                  >
                    <option value="space-grotesk">{t("settings.general.fontFamilySpaceGrotesk")}</option>
                    <option value="inter">{t("settings.general.fontFamilyInter")}</option>
                    <option value="system-ui">{t("settings.general.fontFamilySystem")}</option>
                    <option value="source-sans-3">{t("settings.general.fontFamilySourceSans")}</option>
                    <option value="ibm-plex-sans">{t("settings.general.fontFamilyIbmPlex")}</option>
                  </StyledSelect>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-text-muted">
                  {t("settings.general.fontSizeScaleLabel", {
                    scale: userPreferences?.font_size_scale ?? 100,
                  })}
                </label>
                <input
                  type="range"
                  min={85}
                  max={130}
                  step={5}
                  disabled={personalizationUiDisabled}
                  value={userPreferences?.font_size_scale ?? 100}
                  onChange={(e) =>
                    onUpdateUserPreferences({
                      font_size_scale: Number(e.target.value),
                    })
                  }
                  className="w-full accent-[var(--accent-500)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-text-muted">
                  {t("settings.general.modelInstructionLabel")}
                </label>
                <textarea
                  value={modelInstructionDraft}
                  onChange={(e) => setModelInstructionDraft(e.target.value)}
                  onBlur={() =>
                    onUpdateUserPreferences({
                      model_custom_instructions: modelInstructionDraft.trim() || null,
                    })
                  }
                  disabled={personalizationUiDisabled}
                  maxLength={1200}
                  rows={4}
                  placeholder={t("settings.general.modelInstructionPlaceholder")}
                  className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg px-3 py-2 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                />
                <div className="text-[10px] text-text-muted flex items-center justify-between">
                  <span>{t("settings.general.modelInstructionHint")}</span>
                  <span>{modelInstructionDraft.length}/1200</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={personalizationUiDisabled}
                    onClick={() => {
                      const next = t("settings.general.modelInstructionPresetExplainFirst");
                      setModelInstructionDraft(next);
                      onUpdateUserPreferences({ model_custom_instructions: next });
                    }}
                    className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest border border-[var(--panel-border-strong)] bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] text-text-main rounded-md transition-colors disabled:opacity-50"
                  >
                    {t("settings.general.modelInstructionPresetExplainFirstLabel")}
                  </button>
                  <button
                    type="button"
                    disabled={personalizationUiDisabled}
                    onClick={() => {
                      const next = t("settings.general.modelInstructionPresetTerse");
                      setModelInstructionDraft(next);
                      onUpdateUserPreferences({ model_custom_instructions: next });
                    }}
                    className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest border border-[var(--panel-border-strong)] bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] text-text-main rounded-md transition-colors disabled:opacity-50"
                  >
                    {t("settings.general.modelInstructionPresetTerseLabel")}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-widest text-text-muted">
                      {t("settings.general.maxFilesPerScanLabel")}
                    </label>
                    <InfoPopover
                      title={t("settings.general.maxFilesPerScanLabel")}
                      note={t("settings.general.maxFilesPerScanNote")}
                    />
                  </div>
                  <input
                    type="number"
                    min={50}
                    max={400}
                    step={10}
                    disabled={personalizationUiDisabled}
                    value={userPreferences?.scan_tuning.max_files_per_scan ?? 300}
                    onChange={(e) =>
                      onUpdateUserPreferences({
                        scan_tuning: { max_files_per_scan: Number(e.target.value) },
                      })
                    }
                    className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg px-3 py-2 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-widest text-text-muted">
                      {t("settings.general.maxBatchSizeHintLabel")}
                    </label>
                    <InfoPopover
                      title={t("settings.general.maxBatchSizeHintLabel")}
                      note={t("settings.general.maxBatchSizeHintNote")}
                    />
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    disabled={personalizationUiDisabled}
                    value={userPreferences?.scan_tuning.max_batch_size_hint ?? 3}
                    onChange={(e) =>
                      onUpdateUserPreferences({
                        scan_tuning: { max_batch_size_hint: Number(e.target.value) },
                      })
                    }
                    className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg px-3 py-2 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-widest text-text-muted">
                      {t("settings.general.tokenBudgetHintLabel")}
                    </label>
                    <InfoPopover
                      title={t("settings.general.tokenBudgetHintLabel")}
                      note={t("settings.general.tokenBudgetHintNote")}
                    />
                  </div>
                  <input
                    type="number"
                    min={1500}
                    max={12000}
                    step={100}
                    disabled={personalizationUiDisabled}
                    value={userPreferences?.scan_tuning.token_budget_hint ?? 5000}
                    onChange={(e) =>
                      onUpdateUserPreferences({
                        scan_tuning: { token_budget_hint: Number(e.target.value) },
                      })
                    }
                    className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg px-3 py-2 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                  />
                </div>
              </div>

              <div className="text-[10px] text-text-muted">
                {t("settings.general.scanTuningHint")}
              </div>
              <div className="rounded-md border border-border-main bg-[var(--panel-muted)] px-3 py-2 text-[10px] text-text-muted">
                <div>
                  {t("settings.general.scanTuningPolicyCaps", {
                    filesCap: profileInitialScanLimit,
                    batchCap: profileBatchSizeCap,
                  })}
                </div>
                <div className="mt-1">
                  {scanTuningPolicyOverrideActive
                    ? t("settings.general.scanTuningPolicyOverride", {
                        files: effectiveMaxFilesPerScan,
                        requestedFiles: requestedMaxFilesPerScan,
                        batch: effectiveBatchSizeHint,
                        requestedBatch: requestedBatchSizeHint,
                      })
                    : t("settings.general.scanTuningPolicyNoOverride")}
                </div>
              </div>

              {userPreferencesError && (
                <div className="text-[10px] text-[color:var(--tone-critical-text)]">{userPreferencesError}</div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void onRefreshUserPreferences()}
                  disabled={!isDesktop || userPreferencesSaving}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] text-text-main rounded-md transition-colors disabled:opacity-50"
                >
                  {t("settings.general.refreshPreferences")}
                </button>
                <button
                  onClick={() => void onResetUserPreferences()}
                  disabled={!isDesktop || userPreferencesSaving}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {userPreferencesSaving
                    ? t("settings.general.savingPreferences")
                    : t("settings.general.resetPreferences")}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-border-main space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
                  <Bell className="w-4 h-4 text-[var(--accent-500)]" />
                  {t("settings.general.guruReplySoundTitle")}
                </div>
                <InfoPopover
                  title={t("settings.general.guruReplySoundTitle")}
                  note={t("settings.general.guruReplySoundNote")}
                />
              </div>
              <div className="text-[10px] text-text-muted">
                {t("settings.general.guruReplySoundDescription")}
              </div>
              <div className="flex items-center justify-between bg-[var(--panel-muted)] border border-border-main rounded-lg px-3 py-2">
                <div className="text-[10px] text-text-muted">
                  {t("settings.general.guruReplySoundStatus", {
                    status: guruReplySoundEnabled ? t("common.enabled") : t("common.disabled"),
                  })}
                </div>
                <button
                  onClick={onGuruReplySoundToggle}
                  disabled={!isDesktop}
                  className={clsx(
                    "px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors",
                    guruReplySoundEnabled ? "bg-[var(--accent-500)] text-background" : "bg-[var(--panel-muted)] text-text-main",
                    !isDesktop && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {guruReplySoundEnabled ? t("common.on") : t("common.off")}
                </button>
              </div>
            </div>
          </div>
        )}

        {settingsTab === "provider" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
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
                  <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.provider.providerLabel")}</label>
                  <StyledSelect
                    disabled={!isDesktop}
                    value={providerDraft.provider_id}
                    onChange={(e) => onProviderChange(e.target.value)}
                  >
                    {PROVIDER_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </StyledSelect>
                  <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.provider.baseUrlLabel")}</label>
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
                      className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                      placeholder={getProviderDefaults(providerDraft.provider_id).baseUrl}
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.provider.modelLabel")}</label>
                    <button
                      onClick={onRefreshModels}
                      disabled={!isDesktop || providerModelLoading}
                      className="text-[10px] uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
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
                      className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                      placeholder={t("settings.provider.modelPlaceholder")}
                    />
                  )}
                  {providerModelError && (
                    <div className="text-[10px] text-[color:var(--tone-critical-text)]">
                      {requiresApiKey
                        ? t("settings.provider.requiresKeyLoadModels", { provider: providerLabel })
                        : providerModelError}
                    </div>
                  )}
                  {providerError && <div className="text-[10px] text-[color:var(--tone-critical-text)]">{providerError}</div>}
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
                      className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] rounded-md transition-colors disabled:opacity-50"
                    >
                      {providerTestLoading ? t("settings.provider.testing") : t("settings.provider.testConnection")}
                    </button>
                  </div>
                  {providerTestMessage && (
                    <div className="text-[10px] text-[color:var(--tone-success-text)] bg-[color:var(--tone-success-bg)] border border-[color:var(--tone-success-border)] rounded-md px-3 py-2">
                      {providerTestMessage}
                    </div>
                  )}
                  {providerTestError && (
                    <div className="text-[10px] text-[color:var(--tone-critical-text)] bg-[color:var(--tone-critical-bg)] border border-[color:var(--tone-critical-border)] rounded-md px-3 py-2">
                      {providerTestError}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pt-4 border-t border-border-main space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
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
                <div className="text-[10px] text-[color:var(--tone-critical-text)] bg-[color:var(--tone-critical-bg)] border border-[color:var(--tone-critical-border)] rounded-md px-3 py-2">
                  {t("settings.provider.setupRequired", { provider: providerLabel })}
                </div>
              )}
              <input
                disabled={!isDesktop}
                type="password"
                value={apiKeyInput}
                onFocus={onApiKeyFocus}
                onChange={(e) => onApiKeyChange(e.target.value)}
                className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                placeholder={t("settings.provider.apiKeyPlaceholder")}
              />
              {apiKeyError && <div className="text-[10px] text-[color:var(--tone-critical-text)]">{apiKeyError}</div>}
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
                  className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] rounded-md transition-colors disabled:opacity-50"
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
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
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
            <div className="rounded-xl border border-border-main bg-[var(--panel-muted)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.embedding.modeLabel")}</label>
                <button
                  onClick={onRefreshEmbeddingSettings}
                  className="text-[10px] uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
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
                  <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.embedding.openAiBaseUrl")}</label>
                  <input
                    disabled={!isDesktop || !embeddingDraft}
                    value={embeddingDraft?.openai_base_url ?? ""}
                    onChange={(e) => onEmbeddingOpenAiBaseUrlChange(e.target.value)}
                    className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.embedding.openAiModel")}</label>
                  <input
                    disabled={!isDesktop || !embeddingDraft}
                    value={embeddingDraft?.openai_model ?? ""}
                    onChange={(e) => onEmbeddingOpenAiModelChange(e.target.value)}
                    className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                    placeholder="text-embedding-3-small"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.embedding.ollamaBaseUrl")}</label>
                  <input
                    disabled={!isDesktop || !embeddingDraft}
                    value={embeddingDraft?.ollama_base_url ?? ""}
                    onChange={(e) => onEmbeddingOllamaBaseUrlChange(e.target.value)}
                    className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                    placeholder="http://localhost:11434"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.embedding.ollamaModel")}</label>
                  <input
                    disabled={!isDesktop || !embeddingDraft}
                    value={embeddingDraft?.ollama_model ?? ""}
                    onChange={(e) => onEmbeddingOllamaModelChange(e.target.value)}
                    className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
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
                <div className="text-[10px] text-[color:var(--tone-critical-text)]">{embeddingError}</div>
              )}

              <button
                onClick={onSaveEmbeddingSettings}
                disabled={!isDesktop || embeddingSaving || !embeddingDraft}
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {embeddingSaving ? t("common.saving") : t("settings.embedding.saveEmbeddingSettings")}
              </button>
            </div>

            <div className="rounded-xl border border-border-main bg-[var(--panel-muted)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
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
                className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                placeholder={t("settings.embedding.openAiKeyPlaceholder")}
              />
              {embeddingOpenAiKeyError && (
                <div className="text-[10px] text-[color:var(--tone-critical-text)]">{embeddingOpenAiKeyError}</div>
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
                  className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] rounded-md transition-colors disabled:opacity-50"
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
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
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
            <div className="flex items-center justify-between bg-[var(--panel-muted)] border border-border-main rounded-lg px-3 py-2">
              <div className="text-[10px] text-text-muted">
                {t("settings.web.status", { status: webSearchEnabled ? t("common.enabled") : t("common.disabled") })}
              </div>
              <button
                onClick={onWebSearchToggle}
                disabled={!webSearchReady}
                className={clsx(
                  "px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors",
                  webSearchEnabled ? "bg-[var(--accent-500)] text-background" : "bg-[var(--panel-muted)] text-text-main",
                  !webSearchReady && "opacity-50 cursor-not-allowed"
                )}
              >
                {webSearchEnabled ? t("common.on") : t("common.off")}
              </button>
            </div>
            <div className="flex items-center justify-between bg-[var(--panel-muted)] border border-border-main rounded-lg px-3 py-2">
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
              <div className="text-[10px] text-[color:var(--tone-warning-text)]">
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
              className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
              placeholder={t("settings.web.tavilyKeyPlaceholder")}
            />
            {!tavilyKeyInput.trim() && !tavilyKeyMasked && (
              <div className="text-[10px] text-[color:var(--tone-warning-text)]">{t("settings.web.keyRequired")}</div>
            )}
            {tavilyKeyError && <div className="text-[10px] text-[color:var(--tone-critical-text)]">{tavilyKeyError}</div>}
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
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] rounded-md transition-colors disabled:opacity-50"
              >
                {t("common.clear")}
              </button>
            </div>
          </div>
        )}

        {settingsTab === "updates" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
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
              <span className="px-2 py-0.5 rounded-full bg-[var(--panel-muted)] text-[9px] uppercase tracking-widest text-text-main">
                {updateStatusBadge}
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
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest border border-border-main bg-[var(--accent-200)] hover:bg-[var(--panel-bg)] text-text-main rounded-md transition-colors disabled:opacity-50"
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
            {updateError && <div className="text-[10px] text-[color:var(--tone-critical-text)]">{updateError}</div>}

            <div className="pt-4 border-t border-border-main space-y-2">
              <div className="text-xs font-bold uppercase tracking-widest text-text-muted">
                {t("settings.updates.aboutTitle")}
              </div>
              <div className="text-[10px] text-text-muted bg-[var(--panel-muted)] border border-border-main rounded-lg px-3 py-2">
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
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
              <Download className="w-4 h-4 text-[var(--accent-500)]" />
              {t("settings.export.title")}
            </div>
            <div className="text-[10px] text-text-muted bg-[var(--panel-muted)] border border-border-main rounded-lg px-3 py-2">
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
              <div className="rounded-lg border border-border-main bg-[var(--panel-muted)] px-3 py-2 text-[10px] text-text-muted flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent-500)] shrink-0" />
                <span className="transition-opacity duration-300">
                  {exportStatusMessages[exportStatusMessageIndex]}
                </span>
              </div>
            )}
            {/* Success feedback is shown via top-right toast to reduce clutter in this tab. */}
            {exportPdfError && !exportPdfInProgress && (
              <div className="rounded-lg border border-[color:var(--tone-critical-border)] bg-[color:var(--tone-critical-bg)] px-3 py-2 text-[10px] text-[color:var(--tone-critical-text)] font-bold">
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
