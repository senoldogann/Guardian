import type { ReactElement } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { useI18n } from "../../i18n";
import { openExternal } from "../../lib/tauri";
import type { UpdateSettingsProps } from "./types";

export interface AboutTabProps {
  isDesktop: boolean;
  updateProps: UpdateSettingsProps;
}

export function AboutTab({ isDesktop, updateProps }: AboutTabProps): ReactElement {
  const { t } = useI18n();
  const {
    updateInfo,
    updateChecking,
    updateInstalling,
    updateError,
    onCheckUpdates,
    onInstallUpdate,
  } = updateProps;

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

  return (
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
  );
}
