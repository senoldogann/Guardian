import { useEffect, useState, type ReactElement } from "react";
import { Sun } from "lucide-react";
import { useI18n } from "../../i18n";
import type { PersonalizationSettingsProps } from "./types";
import {
  InfoPopover,
  StyledSelect,
  DEFAULT_LIGHT_PALETTE,
  DEFAULT_DARK_PALETTE,
  LIGHT_PALETTE_PRESETS,
  DARK_PALETTE_PRESETS,
  normalizeHexColor,
} from "./shared";

export interface ThemeTabProps {
  isDesktop: boolean;
  theme: "dark" | "light";
  open: boolean;
  scanProfile: "source" | "extended" | "full";
  personalizationProps: PersonalizationSettingsProps;
}

export function ThemeTab({
  isDesktop,
  theme,
  open,
  scanProfile,
  personalizationProps,
}: ThemeTabProps): ReactElement {
  const { t } = useI18n();
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

  const personalizationUiDisabled = !isDesktop || !userPreferences;

  const previewPaletteMode: "light" | "dark" =
    userPreferences?.theme_mode === "system"
      ? theme
      : (userPreferences?.theme_mode ?? "dark");
  const previewPalette =
    previewPaletteMode === "light"
      ? {
          accent: normalizeHexColor(userPreferences?.light_palette.accent, DEFAULT_LIGHT_PALETTE.accent),
          panel: normalizeHexColor(userPreferences?.light_palette.panel, DEFAULT_LIGHT_PALETTE.panel),
          text: normalizeHexColor(userPreferences?.light_palette.text, DEFAULT_LIGHT_PALETTE.text),
        }
      : {
          accent: normalizeHexColor(userPreferences?.dark_palette.accent, DEFAULT_DARK_PALETTE.accent),
          panel: normalizeHexColor(userPreferences?.dark_palette.panel, DEFAULT_DARK_PALETTE.panel),
          text: normalizeHexColor(userPreferences?.dark_palette.text, DEFAULT_DARK_PALETTE.text),
        };

  const profileInitialScanLimit = scanProfile === "source" ? 200 : scanProfile === "extended" ? 300 : 500;
  const profileBatchSizeCap = scanProfile === "full" ? 2 : 3;
  const requestedMaxFilesPerScan = userPreferences?.scan_tuning.max_files_per_scan ?? 300;
  const requestedBatchSizeHint = userPreferences?.scan_tuning.max_batch_size_hint ?? 3;
  const effectiveMaxFilesPerScan = Math.min(requestedMaxFilesPerScan, profileInitialScanLimit);
  const effectiveBatchSizeHint = Math.min(requestedBatchSizeHint, profileBatchSizeCap);
  const scanTuningPolicyOverrideActive =
    effectiveMaxFilesPerScan !== requestedMaxFilesPerScan
    || effectiveBatchSizeHint !== requestedBatchSizeHint;

  return (
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
  );
}
