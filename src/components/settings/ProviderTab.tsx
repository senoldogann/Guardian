import type { ReactElement } from "react";
import { Server } from "lucide-react";
import { useI18n } from "../../i18n";
import type { ProviderSettingsProps } from "./types";
import { InfoPopover, StyledSelect, PROVIDER_OPTIONS, getProviderDefaults } from "./shared";

export interface ProviderTabProps {
  isDesktop: boolean;
  providerProps: ProviderSettingsProps;
}

export function ProviderTab({ isDesktop, providerProps }: ProviderTabProps): ReactElement {
  const { t } = useI18n();
  const {
    providerDraft,
    providerError,
    providerSaving,
    providerModels,
    providerModelLoading,
    providerModelError,
    providerTestLoading,
    providerTestMessage,
    providerTestError,
    onProviderChange,
    onBaseUrlChange,
    onModelChange,
    onRefreshModels,
    onSaveProvider,
    onTestProviderConnection,
    apiKeyStatus,
  } = providerProps;

  const providerLabel = providerDraft ? getProviderDefaults(providerDraft.provider_id).label : t("common.loading");
  const requiresApiKey = isDesktop && Boolean(providerDraft) && apiKeyStatus?.has_key === false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
          <Server className="w-4 h-4 text-[var(--accent-500)]" />
          {t("settings.provider.title")}
        </div>
        <InfoPopover
          title={t("settings.provider.popoverTitle")}
          note={t("settings.provider.popoverNote")}
        />
      </div>
      <div className="space-y-3">
        <div className="text-[10px] text-text-muted">
          {t("settings.provider.currentProvider", {
            provider: providerDraft ? getProviderDefaults(providerDraft.provider_id).label : t("common.loading"),
          })}
        </div>
        {!providerDraft ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-3 w-20 bg-border-main rounded" />
            <div className="h-9 w-full bg-border-main rounded" />
            <div className="h-3 w-24 bg-border-main rounded" />
            <div className="h-9 w-full bg-border-main rounded" />
            <div className="h-3 w-16 bg-border-main rounded" />
            <div className="h-9 w-full bg-border-main rounded" />
          </div>
        ) : (
          <>
            <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.provider.providerLabel")}</label>
            <StyledSelect
              disabled={!isDesktop}
              value={providerDraft.provider_id}
              onChange={(e) => onProviderChange(e.target.value)}
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </StyledSelect>
            <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.provider.baseUrlLabel")}</label>
            {providerDraft.provider_id === "ollama" ? (
              <StyledSelect
                disabled={!isDesktop}
                value={providerDraft.base_url}
                onChange={(e) => onBaseUrlChange(e.target.value)}
              >
                <option value="http://localhost:11434">Local (http://localhost:11434)</option>
                <option value="https://ollama.com">Cloud (https://ollama.com)</option>
              </StyledSelect>
            ) : (
              <input
                disabled={!isDesktop}
                value={providerDraft.base_url}
                onChange={(e) => onBaseUrlChange(e.target.value)}
                className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                placeholder={getProviderDefaults(providerDraft.provider_id).baseUrl}
              />
            )}
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.provider.modelLabel")}</label>
              <button
                onClick={onRefreshModels}
                disabled={!isDesktop || providerModelLoading}
                className="text-[10px] uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
              >
                {providerModelLoading ? t("settings.provider.modelsLoading") : t("settings.provider.refreshModels")}
              </button>
            </div>
            {providerModelLoading ? (
              <div className="h-9 w-full bg-border-main rounded animate-pulse" />
            ) : providerModels.length > 0 ? (
              <StyledSelect
                disabled={!isDesktop}
                value={providerDraft.model}
                onChange={(e) => onModelChange(e.target.value)}
              >
                {providerModels.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </StyledSelect>
            ) : (
              <input
                disabled={!isDesktop}
                value={providerDraft.model}
                onChange={(e) => onModelChange(e.target.value)}
                className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                placeholder={t("settings.provider.modelPlaceholder")}
              />
            )}
            {providerModelError && (
              <div className="text-[10px] text-[color:var(--tone-critical-text)]">
                {requiresApiKey
                  ? t("settings.provider.requiresKeyLoadModels", { provider: providerLabel })
                  : providerModelError}
              </div>
            )}
            {providerError && <div className="text-[10px] text-[color:var(--tone-critical-text)]">{providerError}</div>}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onSaveProvider}
                disabled={!isDesktop || providerSaving}
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {providerSaving ? t("common.saving") : t("settings.provider.saveProvider")}
              </button>
              <button
                onClick={onTestProviderConnection}
                disabled={!isDesktop || providerSaving || providerTestLoading}
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] rounded-md transition-colors disabled:opacity-50"
              >
                {providerTestLoading ? t("settings.provider.testing") : t("settings.provider.testConnection")}
              </button>
            </div>
            {providerTestMessage && (
              <div className="text-[10px] text-[color:var(--tone-success-text)] bg-[color:var(--tone-success-bg)] border border-[color:var(--tone-success-border)] rounded-md px-3 py-2">
                {providerTestMessage}
              </div>
            )}
            {providerTestError && (
              <div className="text-[10px] text-[color:var(--tone-critical-text)] bg-[color:var(--tone-critical-bg)] border border-[color:var(--tone-critical-border)] rounded-md px-3 py-2">
                {providerTestError}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
