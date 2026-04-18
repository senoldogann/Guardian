import type { ReactElement } from "react";
import { Server } from "lucide-react";
import { useI18n } from "../../i18n";
import type { ProviderSettingsProps } from "./types";
import { InfoPopover, StyledSelect, PROVIDER_OPTIONS, getProviderDefaults } from "./shared";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/Field";
import { SectionHeader } from "../ui/SectionHeader";

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
  const isOllamaLocal = providerDraft?.provider_id === "ollama";
  const requiresApiKey = isDesktop && Boolean(providerDraft) && !isOllamaLocal && apiKeyStatus?.has_key === false;

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("settings.provider.title")}
        icon={<Server className="w-4 h-4 text-[var(--accent-500)]" />}
        action={(
          <InfoPopover
            title={t("settings.provider.popoverTitle")}
            note={t("settings.provider.popoverNote")}
          />
        )}
      />
      <div className="space-y-3">
        <div className="text-xs text-text-muted">
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
            <Field label={t("settings.provider.providerLabel")}>
              <StyledSelect
                disabled={!isDesktop}
                value={providerDraft.provider_id}
                onChange={(e) => onProviderChange(e.target.value)}
              >
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </StyledSelect>
            </Field>
            <Field label={t("settings.provider.baseUrlLabel")}>
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
                <TextInput
                  disabled={!isDesktop}
                  value={providerDraft.base_url}
                  onChange={(e) => onBaseUrlChange(e.target.value)}
                  placeholder={getProviderDefaults(providerDraft.provider_id).baseUrl}
                />
              )}
            </Field>
            <Field
              label={t("settings.provider.modelLabel")}
              action={(
                <Button
                  onClick={onRefreshModels}
                  disabled={!isDesktop || providerModelLoading}
                  variant="ghost"
                  size="sm"
                >
                  {providerModelLoading ? t("settings.provider.modelsLoading") : t("settings.provider.refreshModels")}
                </Button>
              )}
            >
              {providerModelLoading ? (
                <div className="h-9 w-full bg-border-main rounded-lg animate-pulse" />
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
                <TextInput
                  disabled={!isDesktop}
                  value={providerDraft.model}
                  onChange={(e) => onModelChange(e.target.value)}
                  placeholder={t("settings.provider.modelPlaceholder")}
                />
              )}
            </Field>
            {providerModelError && (
              <div className="text-xs text-[color:var(--tone-critical-text)]">
                {requiresApiKey
                  ? t("settings.provider.requiresKeyLoadModels", { provider: providerLabel })
                  : providerModelError}
              </div>
            )}
            {providerError && <div className="text-xs text-[color:var(--tone-critical-text)]">{providerError}</div>}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={onSaveProvider}
                disabled={!isDesktop || providerSaving}
                variant="primary"
                size="md"
              >
                {providerSaving ? t("common.saving") : t("settings.provider.saveProvider")}
              </Button>
              <Button
                onClick={onTestProviderConnection}
                disabled={!isDesktop || providerSaving || providerTestLoading}
                variant="secondary"
                size="md"
              >
                {providerTestLoading ? t("settings.provider.testing") : t("settings.provider.testConnection")}
              </Button>
            </div>
            {providerTestMessage && (
              <div className="text-xs text-[color:var(--tone-success-text)] bg-[color:var(--tone-success-bg)] border border-[color:var(--tone-success-border)] rounded-md px-3 py-2">
                {providerTestMessage}
              </div>
            )}
            {providerTestError && (
              <div className="text-xs text-[color:var(--tone-critical-text)] bg-[color:var(--tone-critical-bg)] border border-[color:var(--tone-critical-border)] rounded-md px-3 py-2">
                {providerTestError}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
