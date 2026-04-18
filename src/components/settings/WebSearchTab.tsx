import type { ReactElement } from "react";
import clsx from "clsx";
import { Search } from "lucide-react";
import { useI18n } from "../../i18n";
import type { WebSettingsProps } from "./types";
import { InfoPopover, StyledSelect, API_KEY_MASK } from "./shared";

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
          <Search className="w-4 h-4 text-[var(--accent-500)]" />
          {t("settings.web.title")}
        </div>
        <InfoPopover
          title={t("settings.web.popoverTitle")}
          note={t("settings.web.popoverNote")}
        />
      </div>
      <div className="text-[10px] text-text-muted">
        {t("settings.web.note")}
      </div>
      <div className="flex items-center justify-between bg-[var(--panel-muted)] border border-border-main rounded-lg px-3 py-2">
        <div className="text-[10px] text-text-muted">
          {t("settings.web.status", { status: webSearchEnabled ? t("common.enabled") : t("common.disabled") })}
        </div>
        <button
          onClick={onWebSearchToggle}
          disabled={!webSearchReady}
          className={clsx(
            "px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors",
            webSearchEnabled ? "bg-[var(--accent-500)] text-background" : "bg-[var(--panel-muted)] text-text-main",
            !webSearchReady && "opacity-50 cursor-not-allowed"
          )}
        >
          {webSearchEnabled ? t("common.on") : t("common.off")}
        </button>
      </div>
      <div className="flex items-center justify-between bg-[var(--panel-muted)] border border-border-main rounded-lg px-3 py-2">
        <div className="text-[10px] text-text-muted">
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
      </div>
      {!webSearchReady && (
        <div className="text-[10px] text-[color:var(--tone-warning-text)]">
          {t("settings.web.tavilyKeyHint")}
        </div>
      )}
      <div className="text-[10px] text-text-muted">
        {tavilyKeyStatus?.has_key
          ? t("settings.web.keyStored", { source: tavilyKeyStatus.source })
          : t("settings.web.keyMissing")}
      </div>
      <input
        disabled={!isDesktop}
        type="password"
        value={tavilyKeyInput}
        onFocus={onTavilyKeyFocus}
        onChange={(e) => onTavilyKeyChange(e.target.value)}
        className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
        placeholder={t("settings.web.tavilyKeyPlaceholder")}
      />
      {!tavilyKeyInput.trim() && !tavilyKeyMasked && (
        <div className="text-[10px] text-[color:var(--tone-warning-text)]">{t("settings.web.keyRequired")}</div>
      )}
      {tavilyKeyError && <div className="text-[10px] text-[color:var(--tone-critical-text)]">{tavilyKeyError}</div>}
      <div className="flex gap-2">
        <button
          onClick={onSaveTavilyKey}
          disabled={!isDesktop || tavilyKeySaving || !tavilyKeyInput.trim() || (tavilyKeyMasked && tavilyKeyInput === API_KEY_MASK)}
          className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {tavilyKeySaving ? t("common.saving") : t("settings.web.saveKey")}
        </button>
        <button
          onClick={onClearTavilyKey}
          disabled={!isDesktop || tavilyKeySaving}
          className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] rounded-md transition-colors disabled:opacity-50"
        >
          {t("common.clear")}
        </button>
      </div>
    </div>
  );
}
