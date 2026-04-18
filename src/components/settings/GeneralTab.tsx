import type { ReactElement } from "react";
import { Bell, ShieldAlert } from "lucide-react";
import { useI18n } from "../../i18n";
import { InfoPopover, StyledSelect } from "./shared";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { SectionHeader } from "../ui/SectionHeader";

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
      <SectionHeader
        title={t("settings.general.safety")}
        icon={<ShieldAlert className="w-4 h-4 text-[var(--accent-500)]" />}
        action={(
          <InfoPopover
            title={t("settings.general.autoVerifyTitle")}
            note={t("settings.general.autoVerifyNote")}
          />
        )}
      />
      <div className="text-xs text-text-muted">
        {t("settings.general.autoVerifyDescription")}
      </div>
      <Panel surface="muted" padding="sm" rounded="lg" className="flex items-center justify-between gap-3">
        <div className="text-xs text-text-muted">
          {t("settings.general.autoVerifyStatus", {
            status: autoVerifyEnabled ? t("common.enabled") : t("common.disabled"),
          })}
        </div>
        <Button
          onClick={onAutoVerifyToggle}
          disabled={!isDesktop}
          variant={autoVerifyEnabled ? "primary" : "secondary"}
          size="sm"
        >
          {autoVerifyEnabled ? t("common.on") : t("common.off")}
        </Button>
      </Panel>

      <div className="pt-4 border-t border-border-main space-y-3">
        <SectionHeader
          title={t("settings.general.languageTitle")}
          icon={<ShieldAlert className="w-4 h-4 text-[var(--accent-500)]" />}
          action={<InfoPopover title={t("settings.general.languageTitle")} note={t("settings.general.languageNote")} />}
        />
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
        <SectionHeader
          title={t("settings.general.guruReplySoundTitle")}
          icon={<Bell className="w-4 h-4 text-[var(--accent-500)]" />}
          action={(
            <InfoPopover
              title={t("settings.general.guruReplySoundTitle")}
              note={t("settings.general.guruReplySoundNote")}
            />
          )}
        />
        <div className="text-xs text-text-muted">
          {t("settings.general.guruReplySoundDescription")}
        </div>
        <Panel surface="muted" padding="sm" rounded="lg" className="flex items-center justify-between gap-3">
          <div className="text-xs text-text-muted">
            {t("settings.general.guruReplySoundStatus", {
              status: guruReplySoundEnabled ? t("common.enabled") : t("common.disabled"),
            })}
          </div>
          <Button
            onClick={onGuruReplySoundToggle}
            disabled={!isDesktop}
            variant={guruReplySoundEnabled ? "primary" : "secondary"}
            size="sm"
          >
            {guruReplySoundEnabled ? t("common.on") : t("common.off")}
          </Button>
        </Panel>
      </div>
    </>
  );
}
