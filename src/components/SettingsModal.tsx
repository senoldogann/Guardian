import { useRef, type ReactElement } from "react";
import clsx from "clsx";
import { Moon, Sun, Settings, Cpu, Brain, Globe, RefreshCw, FileDown, X } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useI18n } from "../i18n";
import type { SettingsTab } from "../types";
import { Button } from "./ui/Button";
import { DialogShell } from "./ui/DialogShell";
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

/* ── Sidebar tab tanımları ─────────────────────────────── */
const TAB_ITEMS: { id: SettingsTab; icon: typeof Settings; labelKey: string }[] = [
  { id: "general", icon: Settings, labelKey: "settings.tabs.general" },
  { id: "provider", icon: Cpu, labelKey: "settings.tabs.provider" },
  { id: "embedding", icon: Brain, labelKey: "settings.tabs.embedding" },
  { id: "web", icon: Globe, labelKey: "settings.tabs.web" },
  { id: "updates", icon: RefreshCw, labelKey: "settings.tabs.updates" },
  { id: "export", icon: FileDown, labelKey: "settings.tabs.export" },
];

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
    onEscape: onClose,
    initialFocusRef: closeButtonRef,
  });

  if (!open) {
    return null;
  }

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      dismissOnBackdrop={false}
      showCloseButton={false}
      panelClassName="max-w-6xl w-[96%] max-h-[88vh] flex overflow-hidden p-0"
      contentClassName="p-0"
    >
      <div
        ref={modalRef}
        aria-labelledby="guardian-settings-title"
        className="bg-surface flex max-h-[88vh] w-full overflow-hidden rounded-xl"
      >
        {/* ── Sol sidebar navigasyon ─────────────────────── */}
        <nav className="w-52 shrink-0 border-r border-border-main bg-[var(--panel-bg)] flex flex-col">
          <div className="px-4 pt-5 pb-4">
            <h3
              id="guardian-settings-title"
              className="text-sm font-semibold text-text-main"
            >
              {t("settings.title")}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">{t("settings.subtitle")}</p>
          </div>

          <div className="px-2 space-y-0.5">
            {TAB_ITEMS.map(({ id, icon: Icon, labelKey }) => (
              <Button
                key={id}
                onClick={() => onSettingsTabChange(id)}
                variant={settingsTab === id ? "accent" : "ghost"}
                size="md"
                fullWidth
                className={clsx(
                  "justify-start gap-2.5 text-[13px]",
                  settingsTab === id
                    ? "bg-[var(--accent-200)] text-[var(--accent-500)] border-transparent"
                    : "text-text-muted hover:bg-[var(--panel-muted)] hover:text-text-main"
                )}
                leadingIcon={<Icon className="w-4 h-4 shrink-0" />}
              >
                {t(labelKey)}
              </Button>
            ))}
          </div>

          {/* Sidebar alt kısım: tema toggle */}
          <div className="px-2 pt-2 pb-3 border-t border-border-main mt-3">
            <Button
              onClick={onThemeToggle}
              variant="ghost"
              size="md"
              fullWidth
              className="justify-start gap-2.5 text-[13px] text-text-muted"
              title={t("settings.toggleTheme")}
              leadingIcon={theme === "dark" ? <Moon className="w-4 h-4 shrink-0" /> : <Sun className="w-4 h-4 shrink-0" />}
            >
              {t("settings.toggleTheme")}
            </Button>
          </div>

          {/* Kalan yüksekliği doldur */}
          <div className="flex-1" />
        </nav>

        {/* ── Sağ içerik alanı ───────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Üst bar: kapat butonu */}
          <div className="flex items-center justify-end px-5 pt-4 pb-2">
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              ref={closeButtonRef}
              aria-label={t("common.close")}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* İçerik */}
          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 space-y-6">
            {!isDesktop && (
              <div className="text-xs text-[color:var(--tone-warning-text)]">
                {t("settings.desktopRequired")}
              </div>
            )}

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
                  scanTuning={personalizationProps?.userPreferences?.scan_tuning}
                  onUpdateScanTuning={personalizationProps ? (patch) => personalizationProps.onUpdateUserPreferences({ scan_tuning: patch }) : undefined}
                />
                <ThemeTab
                  isDesktop={isDesktop}
                  theme={theme}
                  open={open}
                  personalizationProps={personalizationProps}
                />
              </div>
            )}

            {settingsTab === "provider" && (
              <div className="space-y-6">
                <ProviderTab isDesktop={isDesktop} providerProps={providerProps} />
                <KeyManagementTab isDesktop={isDesktop} providerProps={providerProps} />
              </div>
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
        </div>
      </div>
    </DialogShell>
  );
}

export default SettingsModal;
