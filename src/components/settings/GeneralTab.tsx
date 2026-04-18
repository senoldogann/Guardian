import type { ReactElement } from "react";
import clsx from "clsx";
import { Bell, ShieldAlert } from "lucide-react";
import { useI18n } from "../../i18n";
import { InfoPopover, StyledSelect } from "./shared";

export interface GeneralTabProps {
  isDesktop: boolean;
  autoVerifyEnabled: boolean;
  onAutoVerifyToggle: () => void;
  guruReplySoundEnabled: boolean;
  onGuruReplySoundToggle: () => void;
  onLocaleChange?: (locale: "en" | "tr") => void;
}

export function GeneralTab({
  isDesktop,
  autoVerifyEnabled,
  onAutoVerifyToggle,
  guruReplySoundEnabled,
  onGuruReplySoundToggle,
  onLocaleChange,
}: GeneralTabProps): ReactElement {
  const { locale, setLocale, t } = useI18n();

  return (
    <>
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
    </>
  );
}
