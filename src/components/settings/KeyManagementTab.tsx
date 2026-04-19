import type { ReactElement } from "react";
import { KeyRound } from "lucide-react";
import { useI18n } from "../../i18n";
import { openExternal } from "../../lib/tauri";
import { safeAsync } from "../../lib/safeAsync";
import type { ProviderSettingsProps } from "./types";
import { InfoPopover, getProviderDefaults } from "./shared";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/Field";
import { Panel } from "../ui/Panel";
import { SectionHeader } from "../ui/SectionHeader";

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
  const isOllamaLocal = providerDraft?.provider_id === "ollama";
  const requiresApiKey = isDesktop && Boolean(providerDraft) && !isOllamaLocal && apiKeyStatus?.has_key === false;

  const openGithubModelsTokenPage = (): void => {
    if (!isDesktop) return;
    safeAsync(openExternal("https://github.com/settings/personal-access-tokens/new"), "openExternal");
  };

  return (
    <div className="pt-4 border-t border-border-main space-y-4">
      <SectionHeader
        title={t("settings.provider.apiKeyTitle")}
        icon={<KeyRound className="w-4 h-4 text-[var(--accent-500)]" />}
        action={(
          <InfoPopover
            title={t("settings.provider.apiKeyPopoverTitle")}
            note={t("settings.provider.apiKeyPopoverNote")}
          />
        )}
      />
      <div className="text-xs text-text-muted">
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
        <Panel surface="muted" padding="md" rounded="xl" className="space-y-2">
          <div className="text-xs text-text-muted">
            GitHub Models requires a fine‑grained GitHub token with <span className="font-semibold">models:read</span> permission.
          </div>
          <ol className="text-xs text-text-muted list-decimal pl-4 space-y-1">
            <li>Create a fine‑grained GitHub token.</li>
            <li>Repository access: choose <span className="font-semibold">Public repositories</span>.</li>
            <li>Permissions → Account: enable <span className="font-semibold">Models (read‑only)</span>.</li>
            <li>Ignore Copilot‑related permissions (Copilot Chat/Requests/Editor Context).</li>
            <li>Paste the token here and click Save Key.</li>
          </ol>
          <div className="text-xs text-text-muted">Model visibility checklist:</div>
          <ol className="text-xs text-text-muted list-decimal pl-4 space-y-1">
            <li>Confirm your Copilot plan supports the target models.</li>
            <li>Check organization model access (allowlist/publishers).</li>
            <li>Ensure the token is created under the account/org with access.</li>
          </ol>
          <Button
            onClick={openGithubModelsTokenPage}
            variant="accent"
            size="sm"
          >
            Open Token Settings
          </Button>
        </Panel>
      )}
      {requiresApiKey && (
        <div className="text-xs text-[color:var(--tone-critical-text)] bg-[color:var(--tone-critical-bg)] border border-[color:var(--tone-critical-border)] rounded-md px-3 py-2">
          {t("settings.provider.setupRequired", { provider: providerLabel })}
        </div>
      )}
      <Field error={apiKeyError}>
        <TextInput
          disabled={!isDesktop}
          type="password"
          value={apiKeyInput}
          onFocus={onApiKeyFocus}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={t("settings.provider.apiKeyPlaceholder")}
        />
      </Field>
      <div className="flex gap-2">
        <Button
          onClick={onSaveApiKey}
          disabled={!isDesktop || apiKeySaving}
          variant="primary"
          size="md"
        >
          {apiKeySaving ? t("common.saving") : t("settings.provider.saveKey")}
        </Button>
        <Button
          onClick={onClearApiKey}
          disabled={!isDesktop || apiKeySaving}
          variant="secondary"
          size="md"
        >
          {t("common.clear")}
        </Button>
      </div>
    </div>
  );
}
