import type { ReactElement } from "react";
import clsx from "clsx";
import {
  Moon,
  Sun,
  Server,
  KeyRound,
  RefreshCw,
  Link,
  Search,
  Download,
} from "lucide-react";
import { openExternal } from "../lib/tauri";

export type SettingsTab = "provider" | "web" | "updates" | "export";

export interface ProviderConfig {
  provider_id: string;
  base_url: string;
  model: string;
}

export interface ApiKeyStatus {
  has_key: boolean;
  source: string;
  warning?: string | null;
}

export interface TavilyKeyStatus {
  has_key: boolean;
  source: string;
}

export interface UpdateCheckResult {
  status: string;
  current_version: string;
  latest_version?: string | null;
  download_url?: string | null;
  notes?: string | null;
  error?: string | null;
}

export const PROVIDER_OPTIONS = [
  { id: "ollama", label: "Ollama (Local/Hosted)", baseUrl: "https://ollama.com" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", label: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com/v1" },
  { id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { id: "github-models", label: "GitHub Models", baseUrl: "https://models.github.ai" },
] as const;

export const getProviderDefaults = (providerId: string) => {
  const match = PROVIDER_OPTIONS.find((p) => p.id === providerId);
  return match ?? PROVIDER_OPTIONS[0];
};

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  theme: "dark" | "light";
  onThemeToggle: () => void;
  isDesktop: boolean;
  
  // Provider
  providerDraft: ProviderConfig | null;
  providerError: string | null;
  providerSaving: boolean;
  providerModels: string[];
  providerModelLoading: boolean;
  providerModelError: string | null;
  onProviderChange: (nextId: string) => void;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onRefreshModels: () => void;
  onSaveProvider: () => void;
  
  // API Key
  apiKeyStatus: ApiKeyStatus | null;
  apiKeyInput: string;
  apiKeyError: string | null;
  apiKeySaving: boolean;
  onApiKeyFocus: () => void;
  onApiKeyChange: (value: string) => void;
  onSaveApiKey: () => void;
  onClearApiKey: () => void;
  
  // Tavily
  tavilyKeyStatus: TavilyKeyStatus | null;
  tavilyKeyInput: string;
  tavilyKeyMasked: boolean;
  tavilyKeyError: string | null;
  tavilyKeySaving: boolean;
  webSearchEnabled: boolean;
  webSearchReady: boolean;
  onWebSearchToggle: () => void;
  onTavilyKeyFocus: () => void;
  onTavilyKeyChange: (value: string) => void;
  onSaveTavilyKey: () => void;
  onClearTavilyKey: () => void;
  
  // Updates
  updateFeedUrl: string;
  updateFeedError: string | null;
  updateFeedSaving: boolean;
  onUpdateFeedChange: (value: string) => void;
  onSaveUpdateFeed: () => void;
  
  // Export
  onExportPDF: () => void;
  
  // Tab
  settingsTab: SettingsTab;
  onSettingsTabChange: (tab: SettingsTab) => void;
}

export function SettingsModal({
  open,
  onClose,
  theme,
  onThemeToggle,
  isDesktop,
  providerDraft,
  providerError,
  providerSaving,
  providerModels,
  providerModelLoading,
  providerModelError,
  onProviderChange,
  onBaseUrlChange,
  onModelChange,
  onRefreshModels,
  onSaveProvider,
  apiKeyStatus,
  apiKeyInput,
  apiKeyError,
  apiKeySaving,
  onApiKeyFocus,
  onApiKeyChange,
  onSaveApiKey,
  onClearApiKey,
  tavilyKeyStatus,
  tavilyKeyInput,
  tavilyKeyMasked,
  tavilyKeyError,
  tavilyKeySaving,
  webSearchEnabled,
  webSearchReady,
  onWebSearchToggle,
  onTavilyKeyFocus,
  onTavilyKeyChange,
  onSaveTavilyKey,
  onClearTavilyKey,
  updateFeedUrl,
  updateFeedError,
  updateFeedSaving,
  onUpdateFeedChange,
  onSaveUpdateFeed,
  onExportPDF,
  settingsTab,
  onSettingsTabChange,
}: SettingsModalProps): ReactElement | null {
  if (!open) return null;

  const API_KEY_MASK = "••••••";
  const providerLabel = providerDraft ? getProviderDefaults(providerDraft.provider_id).label : "provider";
  const requiresApiKey = isDesktop && Boolean(providerDraft) && apiKeyStatus?.has_key === false;

  const settingsTabClass = (tab: SettingsTab) =>
    clsx(
      "px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors",
      settingsTab === tab
        ? "bg-[var(--accent-500)] text-background"
        : "bg-white/10 text-text-main hover:bg-white/20"
    );

  const openGithubModelsTokenPage = (): void => {
    if (!isDesktop) return;
    void openExternal("https://github.com/settings/personal-access-tokens/new");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div className="max-w-3xl w-[92%] bg-surface border border-border-main rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-main">Setup & Settings</h3>
            <p className="text-xs text-text-muted">Configure provider, API key, and updates. Changes apply on next session or monitoring restart.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onThemeToggle}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-text-main transition-all cursor-pointer"
              title="Toggle Theme"
            >
              {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors cursor-pointer text-xs uppercase tracking-widest"
            >
              Close
            </button>
          </div>
        </div>

        {!isDesktop && (
          <div className="text-[10px] text-amber-400">
            Desktop app required to update settings.
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-border-main pb-4">
          <button onClick={() => onSettingsTabChange("provider")} className={settingsTabClass("provider")}>Provider</button>
          <button onClick={() => onSettingsTabChange("web")} className={settingsTabClass("web")}>Web Search</button>
          <button onClick={() => onSettingsTabChange("updates")} className={settingsTabClass("updates")}>Updates</button>
          <button onClick={() => onSettingsTabChange("export")} className={settingsTabClass("export")}>Export</button>
        </div>

        {settingsTab === "provider" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <Server className="w-4 h-4 text-[var(--accent-500)]" />
              AI Provider
            </div>
            <div className="space-y-3">
              <div className="text-[10px] text-text-muted">
                Current provider: {providerDraft ? getProviderDefaults(providerDraft.provider_id).label : "Loading"}.
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
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500">Provider</label>
                  <select
                    disabled={!isDesktop}
                    className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main"
                    value={providerDraft.provider_id}
                    onChange={(e) => onProviderChange(e.target.value)}
                  >
                    {PROVIDER_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500">Base URL</label>
                  <input
                    disabled={!isDesktop}
                    value={providerDraft.base_url}
                    onChange={(e) => onBaseUrlChange(e.target.value)}
                    className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                    placeholder={getProviderDefaults(providerDraft.provider_id).baseUrl}
                  />
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500">Model</label>
                    <button
                      onClick={onRefreshModels}
                      disabled={!isDesktop || providerModelLoading}
                      className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-text-main transition-colors"
                    >
                      {providerModelLoading ? "Loading..." : "Refresh"}
                    </button>
                  </div>
                  {providerModelLoading ? (
                    <div className="h-9 w-full bg-border-main rounded animate-pulse" />
                  ) : providerModels.length > 0 ? (
                    <select
                      disabled={!isDesktop}
                      value={providerDraft.model}
                      onChange={(e) => onModelChange(e.target.value)}
                      className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                    >
                      {providerModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      disabled={!isDesktop}
                      value={providerDraft.model}
                      onChange={(e) => onModelChange(e.target.value)}
                      className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                      placeholder="Enter model ID manually"
                    />
                  )}
                  {providerModelError && (
                    <div className="text-[10px] text-rose-400">
                      {requiresApiKey ? `Enter your ${providerLabel} API key to load models.` : providerModelError}
                    </div>
                  )}
                  {providerError && <div className="text-[10px] text-rose-400">{providerError}</div>}
                  <button
                    onClick={onSaveProvider}
                    disabled={!isDesktop || providerSaving}
                    className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
                  >
                    {providerSaving ? "Saving..." : "Save Provider"}
                  </button>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-border-main space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                <KeyRound className="w-4 h-4 text-[var(--accent-500)]" />
                API Key
              </div>
              <div className="text-[10px] text-text-muted">
                {apiKeyStatus?.has_key
                  ? `Key stored for ${providerDraft ? getProviderDefaults(providerDraft.provider_id).label : "provider"} (${apiKeyStatus.source}).`
                  : `No API key stored for ${providerDraft ? getProviderDefaults(providerDraft.provider_id).label : "provider"}. Environment keys are ignored.`}
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
                <div className="text-[10px] text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2">
                  Setup required: add your {providerLabel} API key to list models and start monitoring.
                </div>
              )}
              <input
                disabled={!isDesktop}
                type="password"
                value={apiKeyInput}
                onFocus={onApiKeyFocus}
                onChange={(e) => onApiKeyChange(e.target.value)}
                className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                placeholder="Enter your API key"
              />
              {apiKeyError && <div className="text-[10px] text-rose-400">{apiKeyError}</div>}
              <div className="flex gap-2">
                <button
                  onClick={onSaveApiKey}
                  disabled={!isDesktop || apiKeySaving}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {apiKeySaving ? "Saving..." : "Save Key"}
                </button>
                <button
                  onClick={onClearApiKey}
                  disabled={!isDesktop || apiKeySaving}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 rounded-md transition-colors disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {settingsTab === "web" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <Search className="w-4 h-4 text-[var(--accent-500)]" />
              Web Search (Tavily)
            </div>
            <div className="text-[10px] text-text-muted">
              Allow Guru to use Tavily web results when needed. Web search is optional and only used when your prompt suggests external context.
            </div>
            <div className="flex items-center justify-between bg-background border border-border-main rounded-lg px-3 py-2">
              <div className="text-[10px] text-text-muted">
                Web Search: {webSearchEnabled ? "Enabled" : "Disabled"}
              </div>
              <button
                onClick={onWebSearchToggle}
                disabled={!webSearchReady}
                className={clsx(
                  "px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors",
                  webSearchEnabled ? "bg-[var(--accent-500)] text-background" : "bg-white/10 text-text-main",
                  !webSearchReady && "opacity-50 cursor-not-allowed"
                )}
              >
                {webSearchEnabled ? "On" : "Off"}
              </button>
            </div>
            {!webSearchReady && (
              <div className="text-[10px] text-amber-400">
                Add your Tavily API key to enable web search.
              </div>
            )}
            <div className="text-[10px] text-text-muted">
              {tavilyKeyStatus?.has_key
                ? `Tavily key stored (${tavilyKeyStatus.source}).`
                : "No Tavily key stored. Add your own to enable web search."}
            </div>
            <input
              disabled={!isDesktop}
              type="password"
              value={tavilyKeyInput}
              onFocus={onTavilyKeyFocus}
              onChange={(e) => onTavilyKeyChange(e.target.value)}
              className="w-full bg-background border border-border-main rounded-lg py-2 px-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
              placeholder="Enter your Tavily API key"
            />
            {!tavilyKeyInput.trim() && !tavilyKeyMasked && (
              <div className="text-[10px] text-amber-400">Tavily key is required to save.</div>
            )}
            {tavilyKeyError && <div className="text-[10px] text-rose-400">{tavilyKeyError}</div>}
            <div className="flex gap-2">
              <button
                onClick={onSaveTavilyKey}
                disabled={!isDesktop || tavilyKeySaving || !tavilyKeyInput.trim() || (tavilyKeyMasked && tavilyKeyInput === API_KEY_MASK)}
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {tavilyKeySaving ? "Saving..." : "Save Key"}
              </button>
              <button
                onClick={onClearTavilyKey}
                disabled={!isDesktop || tavilyKeySaving}
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 rounded-md transition-colors disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {settingsTab === "updates" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <RefreshCw className="w-4 h-4 text-[var(--accent-500)]" />
              Updates
            </div>
            <div className="text-[10px] text-text-muted">Provide an update feed URL to enable in-app update checks.</div>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Link className="absolute left-3 top-2.5 w-3 h-3 text-zinc-500" />
                <input
                  disabled={!isDesktop}
                  value={updateFeedUrl}
                  onChange={(e) => onUpdateFeedChange(e.target.value)}
                  className="w-full bg-background border border-border-main rounded-lg py-2 pl-8 pr-3 text-xs text-text-main outline-none focus:border-[var(--focus-border)]"
                  placeholder="https://updates.guardian.app/feed.json"
                />
              </div>
              <button
                onClick={onSaveUpdateFeed}
                disabled={!isDesktop || updateFeedSaving}
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {updateFeedSaving ? "Saving..." : "Save Feed"}
              </button>
            </div>
            {updateFeedError && <div className="text-[10px] text-rose-400">{updateFeedError}</div>}
          </div>
        )}

        {settingsTab === "export" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <Download className="w-4 h-4 text-[var(--accent-500)]" />
              Export
            </div>
            <div className="text-[10px] text-text-muted bg-white/5 border border-border-main rounded-lg px-3 py-2">
              Export creates a PDF snapshot of the current workspace status, issues, and monitoring summary for sharing or archiving.
            </div>
            <button
              onClick={onExportPDF}
              className="w-full px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer"
            >
              Export PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsModal;
