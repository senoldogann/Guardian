import { useRef, type ReactElement } from "react";
import clsx from "clsx";
import { Moon, Sun } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useI18n } from "../i18n";
import type { SettingsTab } from "../types";
import { GeneralTab } from "./settings/GeneralTab";
import { ScanProfileTab } from "./settings/ScanProfileTab";
import { ThemeTab } from "./settings/ThemeTab";
import { ProviderTab } from "./settings/ProviderTab";
import { KeyManagementTab } from "./settings/KeyManagementTab";
import { EmbeddingTab } from "./settings/EmbeddingTab";
import { WebSearchTab } from "./settings/WebSearchTab";
import { AboutTab } from "./settings/AboutTab";
import { ExportTab } from "./settings/ExportTab";

export type {
  ProviderSettingsProps,
  WebSettingsProps,
  EmbeddingSettingsProps,
  UpdateSettingsProps,
  PersonalizationSettingsProps,
  SettingsModalProps,
} from "./settings/types";

import type { SettingsModalProps } from "./settings/types";

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
  const { t } = useI18n();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useFocusTrap({
    active: open,
    containerRef: modalRef,
    onEscape: () => {},
    initialFocusRef: closeButtonRef,
  });

  const settingsTabClass = (tab: SettingsTab) =>
    clsx(
      "px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors",
      settingsTab === tab
        ? "bg-[var(--accent-500)] text-background"
        : "bg-[var(--panel-muted)] text-text-main hover:bg-[var(--panel-bg)]"
    );

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
            <GeneralTab
              isDesktop={isDesktop}
              autoVerifyEnabled={webProps.autoVerifyEnabled}
              onAutoVerifyToggle={webProps.onAutoVerifyToggle}
              guruReplySoundEnabled={webProps.guruReplySoundEnabled}
              onGuruReplySoundToggle={webProps.onGuruReplySoundToggle}
              onLocaleChange={onLocaleChange}
            />
            <ScanProfileTab
              isDesktop={isDesktop}
              scanProfile={webProps.scanProfile}
              scanProfileSaving={webProps.scanProfileSaving}
              scanProfileError={webProps.scanProfileError}
              onScanProfileChange={webProps.onScanProfileChange}
              onSaveScanProfile={webProps.onSaveScanProfile}
            />
            <ThemeTab
              isDesktop={isDesktop}
              theme={theme}
              open={open}
              scanProfile={webProps.scanProfile}
              personalizationProps={personalizationProps}
            />
          </div>
        )}

        {settingsTab === "provider" && (
          <>
            <ProviderTab isDesktop={isDesktop} providerProps={providerProps} />
            <KeyManagementTab isDesktop={isDesktop} providerProps={providerProps} />
          </>
        )}

        {settingsTab === "embedding" && (
          <EmbeddingTab isDesktop={isDesktop} embeddingProps={embeddingProps} />
        )}

        {settingsTab === "web" && (
          <WebSearchTab isDesktop={isDesktop} webProps={webProps} />
        )}

        {settingsTab === "updates" && (
          <AboutTab isDesktop={isDesktop} updateProps={updateProps} />
        )}

        {settingsTab === "export" && (
          <ExportTab
            onExportPDF={onExportPDF}
            exportPdfInProgress={exportPdfInProgress}
            exportPdfError={exportPdfError}
          />
        )}
      </div>
    </div >
  );
}

export default SettingsModal;
