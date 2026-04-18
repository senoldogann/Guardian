import type { ReactElement } from "react";
import { Database, KeyRound } from "lucide-react";
import { useI18n } from "../../i18n";
import type { EmbeddingMode } from "../../types";
import type { EmbeddingSettingsProps } from "./types";
import { InfoPopover, StyledSelect, API_KEY_MASK } from "./shared";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/Field";
import { Panel } from "../ui/Panel";
import { SectionHeader } from "../ui/SectionHeader";

export interface EmbeddingTabProps {
  isDesktop: boolean;
  embeddingProps: EmbeddingSettingsProps;
}

export function EmbeddingTab({ isDesktop, embeddingProps }: EmbeddingTabProps): ReactElement {
  const { t } = useI18n();
  const {
    embeddingDraft,
    embeddingError,
    embeddingSaving,
    embeddingOpenAiKeyStatus,
    embeddingOpenAiKeyInput,
    embeddingOpenAiKeyMasked,
    embeddingOpenAiKeyError,
    embeddingOpenAiKeySaving,
    onEmbeddingModeChange,
    onEmbeddingOpenAiBaseUrlChange,
    onEmbeddingOllamaBaseUrlChange,
    onEmbeddingOpenAiModelChange,
    onEmbeddingOllamaModelChange,
    onSaveEmbeddingSettings,
    onRefreshEmbeddingSettings,
    onEmbeddingOpenAiKeyFocus,
    onEmbeddingOpenAiKeyChange,
    onSaveEmbeddingOpenAiKey,
    onClearEmbeddingOpenAiKey,
  } = embeddingProps;

  const currentMode = embeddingDraft?.mode ?? "auto";
  const showOpenAiInputs = currentMode === "auto" || currentMode === "openai";
  const showOllamaInputs = currentMode === "auto" || currentMode === "ollama";
  const showOpenAiKeySection = currentMode === "auto" || currentMode === "openai";

  return (
    <div className="space-y-5">
      <SectionHeader
        title={t("settings.embedding.title")}
        icon={<Database className="w-4 h-4 text-[var(--accent-500)]" />}
        action={(
          <InfoPopover
            title={t("settings.embedding.popoverTitle")}
            note={t("settings.embedding.popoverNote")}
          />
        )}
      />
      <div className="text-xs text-text-muted">
        {t("settings.embedding.note")}
      </div>
      <Panel surface="muted" padding="md" rounded="xl" className="space-y-3">
        <Field
          label={t("settings.embedding.modeLabel")}
          action={(
            <Button onClick={onRefreshEmbeddingSettings} variant="ghost" size="sm">
              {t("settings.embedding.refresh")}
            </Button>
          )}
        >
          <StyledSelect
            disabled={!isDesktop || !embeddingDraft}
            value={embeddingDraft?.mode ?? "auto"}
            onChange={(e) => onEmbeddingModeChange(e.target.value as EmbeddingMode)}
          >
            <option value="auto">{t("settings.embedding.modeAuto")}</option>
            <option value="openai">{t("settings.embedding.modeOpenAi")}</option>
            <option value="ollama">{t("settings.embedding.modeOllama")}</option>
            <option value="local">{t("settings.embedding.modeLocal")}</option>
          </StyledSelect>
        </Field>

        <div className="grid grid-cols-1 gap-3">
          {showOpenAiInputs && (
            <Field label={t("settings.embedding.openAiBaseUrl")}>
              <TextInput
                disabled={!isDesktop || !embeddingDraft}
                value={embeddingDraft?.openai_base_url ?? ""}
                onChange={(e) => onEmbeddingOpenAiBaseUrlChange(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </Field>
          )}
          {showOpenAiInputs && (
            <Field label={t("settings.embedding.openAiModel")}>
              <TextInput
                disabled={!isDesktop || !embeddingDraft}
                value={embeddingDraft?.openai_model ?? ""}
                onChange={(e) => onEmbeddingOpenAiModelChange(e.target.value)}
                placeholder="text-embedding-3-small"
              />
            </Field>
          )}
          {showOllamaInputs && (
            <Field label={t("settings.embedding.ollamaBaseUrl")}>
              <TextInput
                disabled={!isDesktop || !embeddingDraft}
                value={embeddingDraft?.ollama_base_url ?? ""}
                onChange={(e) => onEmbeddingOllamaBaseUrlChange(e.target.value)}
                placeholder="http://localhost:11434"
              />
            </Field>
          )}
          {showOllamaInputs && (
            <Field label={t("settings.embedding.ollamaModel")}>
              <TextInput
                disabled={!isDesktop || !embeddingDraft}
                value={embeddingDraft?.ollama_model ?? ""}
                onChange={(e) => onEmbeddingOllamaModelChange(e.target.value)}
                placeholder="nomic-embed-text"
              />
            </Field>
          )}
        </div>

        {showOllamaInputs && (
          <div className="text-xs text-text-muted">
            {t("settings.embedding.localSetupNote", {
              command: "ollama pull nomic-embed-text",
            })}
          </div>
        )}

        {embeddingError && (
          <div className="text-xs text-[color:var(--tone-critical-text)]">{embeddingError}</div>
        )}

        <Button
          onClick={onSaveEmbeddingSettings}
          disabled={!isDesktop || embeddingSaving || !embeddingDraft}
          variant="primary"
          size="md"
        >
          {embeddingSaving ? t("common.saving") : t("settings.embedding.saveEmbeddingSettings")}
        </Button>
      </Panel>

      {showOpenAiKeySection && (
        <Panel surface="muted" padding="md" rounded="xl" className="space-y-3">
          <SectionHeader
            title={t("settings.embedding.openAiKeyTitle")}
            icon={<KeyRound className="w-4 h-4 text-[var(--accent-500)]" />}
            action={(
              <InfoPopover
                title={t("settings.embedding.openAiKeyPopoverTitle")}
                note={t("settings.embedding.openAiKeyPopoverNote")}
              />
            )}
          />
          <div className="text-xs text-text-muted">
            {t("settings.embedding.openAiKeyNote")}
          </div>
          <div className="text-xs text-text-muted">
            {embeddingOpenAiKeyStatus?.has_key
              ? t("settings.embedding.openAiKeyStored", { source: embeddingOpenAiKeyStatus.source })
              : t("settings.embedding.openAiKeyMissing")}
          </div>
          <Field error={embeddingOpenAiKeyError}>
            <TextInput
              disabled={!isDesktop}
              type="password"
              value={embeddingOpenAiKeyInput}
              onFocus={onEmbeddingOpenAiKeyFocus}
              onChange={(e) => onEmbeddingOpenAiKeyChange(e.target.value)}
              placeholder={t("settings.embedding.openAiKeyPlaceholder")}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              onClick={onSaveEmbeddingOpenAiKey}
              disabled={
                !isDesktop ||
                embeddingOpenAiKeySaving ||
                !embeddingOpenAiKeyInput.trim() ||
                (embeddingOpenAiKeyMasked && embeddingOpenAiKeyInput === API_KEY_MASK)
              }
              variant="primary"
              size="md"
            >
              {embeddingOpenAiKeySaving ? t("common.saving") : t("settings.embedding.saveOpenAiKey")}
            </Button>
            <Button
              onClick={onClearEmbeddingOpenAiKey}
              disabled={!isDesktop || embeddingOpenAiKeySaving}
              variant="secondary"
              size="md"
            >
              {t("settings.embedding.clearOpenAiKey")}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
