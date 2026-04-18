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
import { Button } from "../ui/Button";
import { Field, TextArea } from "../ui/Field";
import { Panel } from "../ui/Panel";
import { SectionHeader } from "../ui/SectionHeader";

export interface ThemeTabProps {
  isDesktop: boolean;
  theme: "dark" | "light";
  open: boolean;
  personalizationProps: PersonalizationSettingsProps;
}

export function ThemeTab({
  isDesktop,
  theme,
  open,
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

  return (
    <div className="pt-4 border-t border-border-main space-y-4">
      <SectionHeader
        title={t("settings.general.personalizationTitle")}
        icon={<Sun className="w-4 h-4 text-[var(--accent-500)]" />}
        action={(
          <InfoPopover
            title={t("settings.general.personalizationTitle")}
            note={t("settings.general.personalizationNote")}
          />
        )}
      />
      <div className="text-xs text-text-muted">
        {t("settings.general.personalizationDescription")}
      </div>

      <Panel surface="muted" padding="sm" rounded="xl" className="space-y-3">
        <div className="text-xs text-text-muted">
          {t("settings.general.appearanceTitle")}
        </div>
        <div
          className="rounded-lg border px-3 py-2 text-xs"
          style={{
            backgroundColor: previewPalette.panel,
            borderColor: previewPalette.accent,
          }}
        >
          <div
            className="text-xs font-medium"
            style={{ color: previewPalette.accent }}
          >
            {t("settings.general.appearancePreviewLabel", {
              mode:
                previewPaletteMode === "dark"
                  ? t("settings.general.themeModeDark")
                  : t("settings.general.themeModeLight"),
            })}
          </div>
          <div className="mt-1 text-xs" style={{ color: previewPalette.text }}>
            {t("settings.general.appearancePreviewDescription")}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Panel surface="background" padding="sm" rounded="lg" className="space-y-2">
            <div className="text-xs text-text-muted">
              {t("settings.general.lightPaletteTitle")}
            </div>
            <div className="space-y-1">
              <div className="text-[11px]  text-text-muted">
                {t("settings.general.palettePresetsLabel")}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {LIGHT_PALETTE_PRESETS.map((preset) => (
                  <Button
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
                    variant="secondary"
                    size="sm"
                    className="justify-start"
                  >
                    <span className="inline-flex items-center gap-1.5 text-text-main">
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-border-main"
                        style={{ backgroundColor: preset.accent }}
                      />
                      {t(preset.labelKey)}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              <label className="text-xs text-text-muted">
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
              <label className="text-xs text-text-muted">
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
              <label className="text-xs text-text-muted">
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
            <Button
              onClick={() =>
                onUpdateUserPreferences({
                  light_palette: { ...DEFAULT_LIGHT_PALETTE },
                })
              }
              disabled={personalizationUiDisabled}
              variant="secondary"
              size="sm"
              fullWidth
            >
              {t("settings.general.restoreLightPalette")}
            </Button>
          </Panel>

          <Panel surface="background" padding="sm" rounded="lg" className="space-y-2">
            <div className="text-xs text-text-muted">
              {t("settings.general.darkPaletteTitle")}
            </div>
            <div className="space-y-1">
              <div className="text-[11px]  text-text-muted">
                {t("settings.general.palettePresetsLabel")}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {DARK_PALETTE_PRESETS.map((preset) => (
                  <Button
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
                    variant="secondary"
                    size="sm"
                    className="justify-start"
                  >
                    <span className="inline-flex items-center gap-1.5 text-text-main">
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-border-main"
                        style={{ backgroundColor: preset.accent }}
                      />
                      {t(preset.labelKey)}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              <label className="text-xs text-text-muted">
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
              <label className="text-xs text-text-muted">
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
              <label className="text-xs text-text-muted">
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
            <Button
              onClick={() =>
                onUpdateUserPreferences({
                  dark_palette: { ...DEFAULT_DARK_PALETTE },
                })
              }
              disabled={personalizationUiDisabled}
              variant="secondary"
              size="sm"
              fullWidth
            >
              {t("settings.general.restoreDarkPalette")}
            </Button>
          </Panel>
        </div>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Field label={t("settings.general.themeModeLabel")}>
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
        </Field>

        <Field label={t("settings.general.fontFamilyLabel")}>
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
        </Field>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-text-muted">
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

      <Field label={t("settings.general.modelInstructionLabel")}>
        <TextArea
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
        />
        <div className="text-xs text-text-muted flex items-center justify-between">
          <span>{t("settings.general.modelInstructionHint")}</span>
          <span>{modelInstructionDraft.length}/1200</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={personalizationUiDisabled}
            onClick={() => {
              const next = t("settings.general.modelInstructionPresetExplainFirst");
              setModelInstructionDraft(next);
              onUpdateUserPreferences({ model_custom_instructions: next });
            }}
            variant="secondary"
            size="sm"
          >
            {t("settings.general.modelInstructionPresetExplainFirstLabel")}
          </Button>
          <Button
            type="button"
            disabled={personalizationUiDisabled}
            onClick={() => {
              const next = t("settings.general.modelInstructionPresetTerse");
              setModelInstructionDraft(next);
              onUpdateUserPreferences({ model_custom_instructions: next });
            }}
            variant="secondary"
            size="sm"
          >
            {t("settings.general.modelInstructionPresetTerseLabel")}
          </Button>
        </div>
      </Field>

      {userPreferencesError && (
        <div className="text-xs text-[color:var(--tone-critical-text)]">{userPreferencesError}</div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => void onRefreshUserPreferences()}
          disabled={!isDesktop || userPreferencesSaving}
          variant="secondary"
          size="md"
        >
          {t("settings.general.refreshPreferences")}
        </Button>
        <Button
          onClick={() => void onResetUserPreferences()}
          disabled={!isDesktop || userPreferencesSaving}
          variant="primary"
          size="md"
        >
          {userPreferencesSaving
            ? t("settings.general.savingPreferences")
            : t("settings.general.resetPreferences")}
        </Button>
      </div>
    </div>
  );
}
