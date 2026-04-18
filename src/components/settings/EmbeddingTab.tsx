import type { ReactElement } from "react";
import { Database, KeyRound } from "lucide-react";
import { useI18n } from "../../i18n";
import type { EmbeddingMode } from "../../types";
import type { EmbeddingSettingsProps } from "./types";
import { InfoPopover, StyledSelect, API_KEY_MASK } from "./shared";

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
          <Database className="w-4 h-4 text-[var(--accent-500)]" />
          {t("settings.embedding.title")}
        </div>
        <InfoPopover
          title={t("settings.embedding.popoverTitle")}
          note={t("settings.embedding.popoverNote")}
        />
      </div>
      <div className="text-[10px] text-text-muted">
        {t("settings.embedding.note")}
      </div>
      <div className="rounded-xl border border-border-main bg-[var(--panel-muted)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.embedding.modeLabel")}</label>
          <button
            onClick={onRefreshEmbeddingSettings}
            className="text-[10px] uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
          >
            {t("settings.embedding.refresh")}
          </button>
        </div>
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

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.embedding.openAiBaseUrl")}</label>
            <input
              disabled={!isDesktop || !embeddingDraft}
              value={embeddingDraft?.openai_base_url ?? ""}
              onChange={(e) => onEmbeddingOpenAiBaseUrlChange(e.target.value)}
              className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.embedding.openAiModel")}</label>
            <input
              disabled={!isDesktop || !embeddingDraft}
              value={embeddingDraft?.openai_model ?? ""}
              onChange={(e) => onEmbeddingOpenAiModelChange(e.target.value)}
              className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
              placeholder="text-embedding-3-small"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.embedding.ollamaBaseUrl")}</label>
            <input
              disabled={!isDesktop || !embeddingDraft}
              value={embeddingDraft?.ollama_base_url ?? ""}
              onChange={(e) => onEmbeddingOllamaBaseUrlChange(e.target.value)}
              className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
              placeholder="http://localhost:11434"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-text-muted">{t("settings.embedding.ollamaModel")}</label>
            <input
              disabled={!isDesktop || !embeddingDraft}
              value={embeddingDraft?.ollama_model ?? ""}
              onChange={(e) => onEmbeddingOllamaModelChange(e.target.value)}
              className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
              placeholder="nomic-embed-text"
            />
          </div>
        </div>

        <div className="text-[10px] text-text-muted">
          {t("settings.embedding.localSetupNote", {
            command: "ollama pull nomic-embed-text",
          })}
        </div>

        {embeddingError && (
          <div className="text-[10px] text-[color:var(--tone-critical-text)]">{embeddingError}</div>
        )}

        <button
          onClick={onSaveEmbeddingSettings}
          disabled={!isDesktop || embeddingSaving || !embeddingDraft}
          className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {embeddingSaving ? t("common.saving") : t("settings.embedding.saveEmbeddingSettings")}
        </button>
      </div>

      <div className="rounded-xl border border-border-main bg-[var(--panel-muted)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
            <KeyRound className="w-4 h-4 text-[var(--accent-500)]" />
            {t("settings.embedding.openAiKeyTitle")}
          </div>
          <InfoPopover
            title={t("settings.embedding.openAiKeyPopoverTitle")}
            note={t("settings.embedding.openAiKeyPopoverNote")}
          />
        </div>
        <div className="text-[10px] text-text-muted">
          {t("settings.embedding.openAiKeyNote")}
        </div>
        <div className="text-[10px] text-text-muted">
          {embeddingOpenAiKeyStatus?.has_key
            ? t("settings.embedding.openAiKeyStored", { source: embeddingOpenAiKeyStatus.source })
            : t("settings.embedding.openAiKeyMissing")}
        </div>
        <input
          disabled={!isDesktop}
          type="password"
          value={embeddingOpenAiKeyInput}
          onFocus={onEmbeddingOpenAiKeyFocus}
          onChange={(e) => onEmbeddingOpenAiKeyChange(e.target.value)}
          className="w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
          placeholder={t("settings.embedding.openAiKeyPlaceholder")}
        />
        {embeddingOpenAiKeyError && (
          <div className="text-[10px] text-[color:var(--tone-critical-text)]">{embeddingOpenAiKeyError}</div>
        )}
        <div className="flex gap-2">
          <button
            onClick={onSaveEmbeddingOpenAiKey}
            disabled={
              !isDesktop ||
              embeddingOpenAiKeySaving ||
              !embeddingOpenAiKeyInput.trim() ||
              (embeddingOpenAiKeyMasked && embeddingOpenAiKeyInput === API_KEY_MASK)
            }
            className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
          >
            {embeddingOpenAiKeySaving ? t("common.saving") : t("settings.embedding.saveOpenAiKey")}
          </button>
          <button
            onClick={onClearEmbeddingOpenAiKey}
            disabled={!isDesktop || embeddingOpenAiKeySaving}
            className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] rounded-md transition-colors disabled:opacity-50"
          >
            {t("settings.embedding.clearOpenAiKey")}
          </button>
        </div>
      </div>
    </div>
  );
}
