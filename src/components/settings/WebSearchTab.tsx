import type { ReactElement } from "react";
import { Search } from "lucide-react";
import { useI18n } from "../../i18n";
import type { WebSettingsProps } from "./types";
import { InfoPopover, StyledSelect, API_KEY_MASK } from "./shared";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/Field";
import { Panel } from "../ui/Panel";
import { SectionHeader } from "../ui/SectionHeader";

export interface WebSearchTabProps {
  isDesktop: boolean;
  webProps: WebSettingsProps;
}

export function WebSearchTab({ isDesktop, webProps }: WebSearchTabProps): ReactElement {
  const { t } = useI18n();
  const {
    tavilyKeyStatus,
    tavilyKeyInput,
    tavilyKeyMasked,
    tavilyKeyError,
    tavilyKeySaving,
    webSearchEnabled,
    webSearchDepth,
    webSearchReady,
    onWebSearchToggle,
    onWebSearchDepthChange,
    onTavilyKeyFocus,
    onTavilyKeyChange,
    onSaveTavilyKey,
    onClearTavilyKey,
  } = webProps;

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("settings.web.title")}
        icon={<Search className="w-4 h-4 text-[var(--accent-500)]" />}
        action={(
          <InfoPopover
            title={t("settings.web.popoverTitle")}
            note={t("settings.web.popoverNote")}
          />
        )}
      />
      <div className="text-xs text-text-muted">
        {t("settings.web.note")}
      </div>
      <Panel surface="muted" padding="sm" rounded="lg" className="flex items-center justify-between gap-3">
        <div className="text-xs text-text-muted">
          {t("settings.web.status", { status: webSearchEnabled ? t("common.enabled") : t("common.disabled") })}
        </div>
        <Button
          onClick={onWebSearchToggle}
          disabled={!webSearchReady}
          variant={webSearchEnabled ? "primary" : "secondary"}
          size="sm"
        >
          {webSearchEnabled ? t("common.on") : t("common.off")}
        </Button>
      </Panel>
      <Panel surface="muted" padding="sm" rounded="lg" className="flex items-center justify-between gap-3">
        <div className="text-xs text-text-muted">
          {t("settings.web.searchDepth")}:{" "}
          <span className="text-text-main font-semibold">{webSearchDepth}</span>
        </div>
        <StyledSelect
          value={webSearchDepth}
          onChange={(e) => onWebSearchDepthChange(e.target.value as typeof webSearchDepth)}
          aria-label={t("settings.web.depthAria")}
        >
          <option value="basic">Basic (Default)</option>
          <option value="advanced">Advanced</option>
          <option value="fast">Fast</option>
          <option value="ultra-fast">Ultra-fast</option>
          <option value="auto">Auto</option>
        </StyledSelect>
      </Panel>
      {!webSearchReady && (
        <div className="text-xs text-[color:var(--tone-warning-text)]">
          {t("settings.web.tavilyKeyHint")}
        </div>
      )}
      <div className="text-xs text-text-muted">
        {tavilyKeyStatus?.has_key
          ? t("settings.web.keyStored", { source: tavilyKeyStatus.source })
          : t("settings.web.keyMissing")}
      </div>
      <Field
        error={tavilyKeyError}
        note={!tavilyKeyInput.trim() && !tavilyKeyMasked ? t("settings.web.keyRequired") : undefined}
      >
        <TextInput
          disabled={!isDesktop}
          type="password"
          value={tavilyKeyInput}
          onFocus={onTavilyKeyFocus}
          onChange={(e) => onTavilyKeyChange(e.target.value)}
          placeholder={t("settings.web.tavilyKeyPlaceholder")}
        />
      </Field>
      <div className="flex gap-2">
        <Button
          onClick={onSaveTavilyKey}
          disabled={!isDesktop || tavilyKeySaving || !tavilyKeyInput.trim() || (tavilyKeyMasked && tavilyKeyInput === API_KEY_MASK)}
          variant="primary"
          size="md"
        >
          {tavilyKeySaving ? t("common.saving") : t("settings.web.saveKey")}
        </Button>
        <Button
          onClick={onClearTavilyKey}
          disabled={!isDesktop || tavilyKeySaving}
          variant="secondary"
          size="md"
        >
          {t("common.clear")}
        </Button>
      </div>
    </div>
  );
}
