import type { ReactElement } from "react";
import { ShieldAlert, Layers } from "lucide-react";
import { useI18n } from "../../i18n";
import { InfoPopover, StyledSelect } from "./shared";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/Field";
import { SectionHeader } from "../ui/SectionHeader";

export interface ScanProfileTabProps {
  isDesktop: boolean;
  scanProfile: "source" | "extended" | "full";
  scanProfileSaving: boolean;
  scanProfileError: string | null;
  onScanProfileChange: (value: "source" | "extended" | "full") => void;
  onSaveScanProfile: () => void;
  scanTuning?: {
    max_files_per_scan: number;
    max_batch_size_hint: number;
    token_budget_hint: number;
  };
  onUpdateScanTuning?: (patch: {
    max_files_per_scan?: number;
    max_batch_size_hint?: number;
    token_budget_hint?: number;
  }) => void;
}

/* Profil bazlı üst sınırlar — backend'deki guardian-scan-policy ile senkron */
const PROFILE_CAPS: Record<string, { filesCap: number; batchCap: number }> = {
  source: { filesCap: 200, batchCap: 3 },
  extended: { filesCap: 300, batchCap: 4 },
  full: { filesCap: 500, batchCap: 4 },
};

export function ScanProfileTab({
  isDesktop,
  scanProfile,
  scanProfileSaving,
  scanProfileError,
  onScanProfileChange,
  onSaveScanProfile,
  scanTuning,
  onUpdateScanTuning,
}: ScanProfileTabProps): ReactElement {
  const { t } = useI18n();
  const caps = PROFILE_CAPS[scanProfile] ?? PROFILE_CAPS.source;

  return (
    <div className="pt-4 border-t border-border-main space-y-4">
      <SectionHeader
        title={t("settings.general.scanScopeTitle")}
        icon={<ShieldAlert className="w-4 h-4 text-[var(--accent-500)]" />}
        action={(
          <InfoPopover
            title={t("settings.general.scanScopeTitle")}
            note={t("settings.general.scanScopeNote")}
          />
        )}
      />
      <div className="text-xs text-text-muted">
        {t("settings.general.scanScopeCurrent", { profile: scanProfile })}
      </div>
      <div className="grid grid-cols-1 gap-2">
        <Field error={scanProfileError}>
          <StyledSelect
            disabled={!isDesktop || scanProfileSaving}
            value={scanProfile}
            onChange={(e) => onScanProfileChange(e.target.value as "source" | "extended" | "full")}
          >
            <option value="source">{t("settings.general.scanScopeSource")}</option>
            <option value="extended">{t("settings.general.scanScopeExtended")}</option>
            <option value="full">{t("settings.general.scanScopeFull")}</option>
          </StyledSelect>
        </Field>
        <Button
          onClick={onSaveScanProfile}
          disabled={!isDesktop || scanProfileSaving}
          variant="primary"
          size="md"
        >
          {scanProfileSaving ? t("common.saving") : t("settings.general.saveScanScope")}
        </Button>
      </div>

      {/* ── Scan Tuning kontrolleri ─────────────────────── */}
      {scanTuning && onUpdateScanTuning && (
        <div className="pt-4 border-t border-border-main space-y-3">
          <SectionHeader
            title={t("settings.general.scanTuningHint")}
            icon={<Layers className="w-4 h-4 text-[var(--accent-500)]" />}
          />
          <p className="text-[11px] text-text-muted">
            {t("settings.general.scanTuningPolicyCaps", {
              filesCap: String(caps.filesCap),
              batchCap: String(caps.batchCap),
            })}
          </p>

          <div className="grid grid-cols-3 gap-3">
            {/* Batch size hint */}
            <Field label={t("settings.general.maxBatchSizeHintLabel")}>
              <TextInput
                type="number"
                disabled={!isDesktop}
                min={1}
                max={10}
                value={scanTuning.max_batch_size_hint}
                onChange={(e) =>
                  onUpdateScanTuning({ max_batch_size_hint: Number(e.target.value) || 1 })
                }
              />
              <p className="text-[10px] text-text-muted mt-0.5">
                {t("settings.general.maxBatchSizeHintNote")}
              </p>
            </Field>

            {/* Max files per scan */}
            <Field label={t("settings.general.maxFilesPerScanLabel")}>
              <TextInput
                type="number"
                disabled={!isDesktop}
                min={50}
                max={400}
                step={50}
                value={scanTuning.max_files_per_scan}
                onChange={(e) =>
                  onUpdateScanTuning({ max_files_per_scan: Number(e.target.value) || 50 })
                }
              />
              <p className="text-[10px] text-text-muted mt-0.5">
                {t("settings.general.maxFilesPerScanNote")}
              </p>
            </Field>

            {/* Token budget hint */}
            <Field label={t("settings.general.tokenBudgetHintLabel")}>
              <TextInput
                type="number"
                disabled={!isDesktop}
                min={1500}
                max={12000}
                step={500}
                value={scanTuning.token_budget_hint}
                onChange={(e) =>
                  onUpdateScanTuning({ token_budget_hint: Number(e.target.value) || 1500 })
                }
              />
              <p className="text-[10px] text-text-muted mt-0.5">
                {t("settings.general.tokenBudgetHintNote")}
              </p>
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}
