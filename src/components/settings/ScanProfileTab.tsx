import type { ReactElement } from "react";
import { ShieldAlert } from "lucide-react";
import { useI18n } from "../../i18n";
import { InfoPopover, StyledSelect } from "./shared";

export interface ScanProfileTabProps {
  isDesktop: boolean;
  scanProfile: "source" | "extended" | "full";
  scanProfileSaving: boolean;
  scanProfileError: string | null;
  onScanProfileChange: (value: "source" | "extended" | "full") => void;
  onSaveScanProfile: () => void;
}

export function ScanProfileTab({
  isDesktop,
  scanProfile,
  scanProfileSaving,
  scanProfileError,
  onScanProfileChange,
  onSaveScanProfile,
}: ScanProfileTabProps): ReactElement {
  const { t } = useI18n();

  return (
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
  );
}
