import type { ReactElement } from "react";
import { KeyRound } from "lucide-react";
import { useI18n } from "../../i18n";
import { openExternal } from "../../lib/tauri";
import type { ProviderSettingsProps } from "./types";
import { InfoPopover, getProviderDefaults } from "./shared";

export interface KeyManagementTabProps {
  isDesktop: boolean;
  providerProps: ProviderSettingsProps;
}

export function KeyManagementTab({ isDesktop, providerProps }: KeyManagementTabProps): ReactElement {
  const { t } = useI18n();
  const {
    providerDraft,
    apiKeyStatus,
    apiKeyInput,
    apiKeyError,
    apiKeySaving,
    onApiKeyFocus,
    onApiKeyChange,
    onSaveApiKey,
    onClearApiKey,
  } = providerProps;

  const providerLabel = providerDraft ? getProviderDefaults(providerDraft.provider_id).label : t("common.loading");
  const requiresApiKey = isDesktop && Boolean(providerDraft) && apiKeyStatus?.has_key === false;

  const openGithubModelsTokenPage = (): void => {
    if (!isDesktop) return;
    void openExternal("https://github.com/settings/personal-access-tokens/new");
  };

  return (
    <div className="pt-4 border-t border-border-main space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
          <KeyRound className="w-4 h-4 text-[var(--accent-500)]" />
          {t("settings.provider.apiKeyTitle")}
        </div>
        <InfoPopover
          title={t("settings.provider.apiKeyPopoverTitle")}
          note={t("settings.provider.apiKeyPopoverNote")}
        />
      </div>
      <div className="text-[10px] text-text-muted">
        {apiKeyStatus?.has_key
          ? t("settings.provider.keyStored", {
              provider: providerDraft ? getProviderDefaults(providerDraft.provider_id).label : "provider",
              source: apiKeyStatus.source,
            })
          : t("settings.provider.noKeyStored", {
              provider: providerDraft ? getProviderDefaults(providerDraft.provider_id).label : "provider",
            })}
      </div>
      {providerDraft?.provider_id === "github-models" && (
        <div className="space-y-2">
          <div className="text-[10px] text-text-muted">
            GitHub Models requires a fine‑grained GitHub token with <span className="font-semibold">models:read</span> permission.
          </div>
          <ol className="text-[10px] text-text-muted list-decimal pl-4 space-y-1">
            <li>Create a fine‑grained GitHub token.</li>
            <li>Repository access: choose <span className="font-semibold">Public repositories</span>.</li>
            <li>Permissions → Account: enable <span className="font-semibold">Models (read‑only)</span>.</li>
            <li>Ignore Copilot‑related permissions (Copilot Chat/Requests/Editor Context).</li>
            <li>Paste the token here and click Save Key.</li>
          </ol>
          <div className="text-[10px] text-text-muted">Model visibility checklist:</div>
          <ol className="text-[10px] text-text-muted list-decimal pl-4 space-y-1">
            <li>Confirm your Copilot plan supports the target models.</li>
            <li>Check organization model access (allowlist/publishers).</li>
            <li>Ensure the token is created under the account/org with access.</li>
          </ol>
          <button
            onClick={openGithubModelsTokenPage}
            className="inline-flex items-center gap-2 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-200)] hover:opacity-90 text-text-main rounded-md transition-colors"
          >
            Open Token Settings
          </button>
        </div>
      )}
      {requiresApiKey && (
        <div className="text-[10px] text-[color:var(--tone-critical-text)] bg-[color:var(--tone-critical-bg)] border border-[color:var(--tone-critical-border)] rounded-md px-3 py-2">
          {t("settings.provider.setupRequired", { provider: providerLabel })}
        </div>
      )}
      <input
        disabled={!isDesktop}
        type="password"
        value={apiKeyInput}
        onFocus={onApiKeyFocus}
        onChange={(e) => onApiKeyChange(e.target.value)}
        className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
        placeholder={t("settings.provider.apiKeyPlaceholder")}
      />
      {apiKeyError && <div className="text-[10px] text-[color:var(--tone-critical-text)]">{apiKeyError}</div>}
      <div className="flex gap-2">
        <button
          onClick={onSaveApiKey}
          disabled={!isDesktop || apiKeySaving}
          className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {apiKeySaving ? t("common.saving") : t("settings.provider.saveKey")}
        </button>
        <button
          onClick={onClearApiKey}
          disabled={!isDesktop || apiKeySaving}
          className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] rounded-md transition-colors disabled:opacity-50"
        >
          {t("common.clear")}
        </button>
      </div>
    </div>
  );
}
