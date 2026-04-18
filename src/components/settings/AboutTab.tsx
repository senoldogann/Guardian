import type { ReactElement } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { useI18n } from "../../i18n";
import { openExternal } from "../../lib/tauri";
import type { UpdateSettingsProps } from "./types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { SectionHeader } from "../ui/SectionHeader";

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
      <SectionHeader
        title={t("settings.updates.title")}
        icon={<RefreshCw className="w-4 h-4 text-[var(--accent-500)]" />}
      />
      <div className="text-xs text-text-muted">
        {t("settings.updates.note")}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span>{t("settings.updates.current")}: {currentVersionLabel}</span>
        <span>{t("settings.updates.latest")}: {latestVersionLabel}</span>
        <span>{t("settings.updates.lastCheck")}: {lastCheckLabel}</span>
        <Badge variant="neutral" size="sm">
          {updateStatusBadge}
        </Badge>
      </div>
      {updateInfo?.status === "available" && (
        <button
          onClick={() => openExternal("https://www.guardianide.com/changelog")}
          className="flex items-center gap-2 text-xs text-[var(--accent-500)] hover:text-[var(--accent-400)] transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          <span className="underline">{t("settings.updates.viewChangelog")}</span>
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onCheckUpdates}
          disabled={!isDesktop || updateChecking}
          variant="accent"
          size="md"
        >
          {updateChecking ? t("settings.updates.checking") : t("settings.updates.checkNow")}
        </Button>
        {updateInfo?.status === "available" && (
          <Button
            onClick={onInstallUpdate}
            disabled={!isDesktop || updateInstalling}
            variant="primary"
            size="md"
          >
            {updateInstalling ? t("settings.updates.updating") : t("settings.updates.installUpdate")}
          </Button>
        )}
      </div>
      {updateError && <div className="text-xs text-[color:var(--tone-critical-text)]">{updateError}</div>}

      <div className="pt-4 border-t border-border-main space-y-2">
        <div className="text-xs font-medium text-text-muted">
          {t("settings.updates.aboutTitle")}
        </div>
        <Panel surface="muted" padding="sm" rounded="lg" className="text-xs text-text-muted">
          {t("settings.updates.builtBy", { name: "Senol Dogan" })}
        </Panel>
        <div className="flex flex-wrap gap-3 text-xs">
          <button
            type="button"
            onClick={() => openExternal("https://www.guardianide.com/")}
            className="flex items-center gap-2 text-xs text-[var(--accent-500)] hover:text-[var(--accent-400)] transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="underline">https://www.guardianide.com/</span>
          </button>
          <button
            type="button"
            onClick={() => openExternal("https://www.guardianide.com/contact")}
            className="flex items-center gap-2 text-xs text-[var(--accent-500)] hover:text-[var(--accent-400)] transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="underline">{t("settings.updates.feedback")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
