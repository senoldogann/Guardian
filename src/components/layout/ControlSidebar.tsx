import type { ReactElement, ReactNode } from "react";
import clsx from "clsx";
import {
  Activity,
  AlertCircle,
  Box,
  ClipboardCheck,
  DatabaseZap,
  Files,
  Folder,
  MessageSquare,
  Play,
  Share2,
  Eye,
  Square,
} from "lucide-react";
import type { BaselineStatusView } from "../../types";

export interface ControlSidebarProps {
  view: "monitor" | "chat" | "diagram" | "ai-context" | "reviews";
  onViewChange: (view: "monitor" | "chat" | "diagram" | "ai-context" | "reviews") => void;
  hasAiContextData: boolean;
  hasReviewData: boolean;
  pendingFixProposalsCount: number;
  totalFiles: number;
  totalIssues: number;
  scopeLabel: string;
  onSelectScope: () => Promise<void> | void;
  tokens: number;
  calls: number;
  filesAnalyzed: number;
  queueWaitMs: number;
  scanProfileLabel: string;
  baselineLoading: boolean;
  baselineStatus: BaselineStatusView | null;
  baselineValid: boolean;
  baselineMetrics: { active: number; new: number; resolved: number } | null;
  baselineError: string | null;
  baselineView: "all" | "new" | "resolved";
  onSetBaselineNow: () => Promise<void> | void;
  onClearBaselineNow: () => Promise<void> | void;
  onBaselineViewChange: (view: "all" | "new" | "resolved") => void;
  path: string;
  engineModel: string;
  embeddingModeLabel: string;
  onOpenEmbeddingSettings: () => void;
  authBannerVisible: boolean;
  authShowGate: boolean;
  authRequiresVerified: boolean;
  authLoading: boolean;
  authError: string | null;
  authWarning: string | null;
  onVerifyAuth: () => Promise<unknown>;
  settingsRequiresApiKey: boolean;
  providerLabel: string;
  onOpenSettings: () => void;
  active: boolean;
  canToggleMonitoring: boolean;
  onToggleMonitoring: () => Promise<void>;
  launchBlockingReason: string | null;
}

export function ControlSidebar({
  view,
  onViewChange,
  hasAiContextData,
  hasReviewData,
  pendingFixProposalsCount,
  totalFiles,
  totalIssues,
  scopeLabel,
  onSelectScope,
  tokens,
  calls,
  filesAnalyzed,
  queueWaitMs,
  scanProfileLabel,
  baselineLoading,
  baselineStatus,
  baselineValid,
  baselineMetrics,
  baselineError,
  baselineView,
  onSetBaselineNow,
  onClearBaselineNow,
  onBaselineViewChange,
  path,
  engineModel,
  embeddingModeLabel,
  onOpenEmbeddingSettings,
  authBannerVisible,
  authShowGate,
  authRequiresVerified,
  authLoading,
  authError,
  authWarning,
  onVerifyAuth,
  settingsRequiresApiKey,
  providerLabel,
  onOpenSettings,
  active,
  canToggleMonitoring,
  onToggleMonitoring,
  launchBlockingReason,
}: ControlSidebarProps): ReactElement {
  return (
    <aside className="w-72 xl:w-80 min-w-[17rem] bg-surface border-r border-border-main transition-colors duration-300 flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 custom-scrollbar">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border-main bg-background/45 p-2 space-y-1.5">
            <button
              onClick={() => onViewChange("monitor")}
              className={clsx(
                "w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 cursor-pointer",
                view === "monitor" ? "bg-surface shadow text-[var(--text-main)]" : "opacity-70 hover:opacity-100",
              )}
            >
              <Activity className="w-4 h-4" /> Monitor
            </button>
            <button
              onClick={() => onViewChange("chat")}
              className={clsx(
                "w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 cursor-pointer",
                view === "chat" ? "bg-surface shadow text-[var(--text-main)]" : "opacity-70 hover:opacity-100",
              )}
            >
              <MessageSquare className="w-4 h-4" /> Guru
            </button>
            <button
              onClick={() => onViewChange("diagram")}
              className={clsx(
                "w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 cursor-pointer",
                view === "diagram" ? "bg-surface shadow text-[var(--text-main)]" : "opacity-70 hover:opacity-100",
              )}
            >
              <Share2 className="w-4 h-4" /> Project Map
            </button>
            <button
              onClick={() => onViewChange("ai-context")}
              className={clsx(
                "w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer",
                view === "ai-context"
                  ? "bg-surface shadow text-[var(--text-main)]"
                  : "opacity-70 hover:opacity-100",
              )}
            >
              <span className="flex items-center gap-3">
                <Eye className="w-4 h-4" /> AI Context
              </span>
              <span
                className={clsx(
                  "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border",
                  hasAiContextData
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-white/5 text-text-muted border-border-main",
                )}
              >
                {hasAiContextData ? "READY" : "EMPTY"}
              </span>
            </button>
            <button
              onClick={() => onViewChange("reviews")}
              className={clsx(
                "w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer",
                view === "reviews" ? "bg-surface shadow text-[var(--text-main)]" : "opacity-70 hover:opacity-100",
              )}
            >
              <span className="flex items-center gap-3">
                <ClipboardCheck className="w-4 h-4" /> Reviews
              </span>
              {pendingFixProposalsCount > 0 ? (
                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border bg-amber-500/10 text-amber-200 border-amber-500/20 tabular-nums">
                  {pendingFixProposalsCount}
                </span>
              ) : (
                <span
                  className={clsx(
                    "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border",
                    hasReviewData
                      ? "bg-white/10 text-text-main border-border-main"
                      : "bg-white/5 text-text-muted border-border-main",
                  )}
                >
                  {hasReviewData ? "LOG" : "EMPTY"}
                </span>
              )}
            </button>
          </div>

          <div className="rounded-xl border border-border-main bg-background/35 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <StatMini
                label="Files"
                count={totalFiles}
                icon={<Files className="w-3.5 h-3.5 text-zinc-400" />}
                color="text-[var(--stat-strong)]"
              />
              <StatMini
                label="Issues"
                count={totalIssues}
                icon={<AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
                color="text-[var(--stat-strong)]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
                Scope
              </label>
              <div className="group relative">
                <Folder className="absolute left-3 top-3 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors pointer-events-none" />
                <input
                  readOnly
                  onClick={() => void onSelectScope()}
                  className="w-full bg-background border border-border-main rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-opacity-100 transition-all placeholder:opacity-50 cursor-pointer hover:bg-border-main"
                  value={scopeLabel}
                  placeholder="Select workspace"
                />
              </div>
            </div>
          </div>

          <CostMetric
            tokens={tokens}
            calls={calls}
            filesAnalyzed={filesAnalyzed}
            queueWaitMs={queueWaitMs}
            scanProfileLabel={scanProfileLabel}
          />

          <div className="p-3 rounded-xl bg-background/50 border border-border-main space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Baseline</span>
              <span
                className={clsx(
                  "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md border",
                  baselineLoading
                    ? "bg-white/5 text-text-muted border-border-main"
                    : baselineStatus?.valid
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : baselineStatus
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-white/5 text-text-muted border-border-main",
                )}
              >
                {baselineLoading
                  ? "LOADING"
                  : baselineStatus?.valid
                    ? "VALID"
                    : baselineStatus
                      ? "INVALID"
                      : "NONE"}
              </span>
            </div>

            {baselineStatus ? (
              <div className="text-[10px] font-mono text-text-muted space-y-1">
                <div>Age: {baselineStatus.baseline_age_days}d</div>
                <div>
                  {baselineMetrics
                    ? `${baselineMetrics.active} active • ${baselineMetrics.new} new • ${baselineMetrics.resolved} resolved`
                    : "Baseline loaded"}
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-text-muted">No baseline set for this workspace.</div>
            )}

            {baselineStatus && !baselineValid && (
              <div className="text-[10px] text-amber-400">
                Baseline invalid (rules changed). Reset baseline to re-enable filtering.
              </div>
            )}

            {baselineError && <div className="text-[10px] text-rose-400">{baselineError}</div>}

            <div className="flex gap-2">
              <button
                onClick={() => void onSetBaselineNow()}
                disabled={!path || baselineLoading}
                className="flex-1 px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Set Baseline
              </button>
              {baselineStatus && (
                <button
                  onClick={() => void onClearBaselineNow()}
                  disabled={!path || baselineLoading}
                  className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 text-text-main rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {baselineValid && (
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => onBaselineViewChange("all")}
                  className={clsx(
                    "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
                    baselineView === "all"
                      ? "bg-white/10 text-text-main border-border-main"
                      : "bg-transparent text-text-muted border-border-main hover:bg-white/5",
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => onBaselineViewChange("new")}
                  className={clsx(
                    "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
                    baselineView === "new"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-transparent text-text-muted border-border-main hover:bg-white/5",
                  )}
                >
                  New
                </button>
                <button
                  onClick={() => onBaselineViewChange("resolved")}
                  className={clsx(
                    "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
                    baselineView === "resolved"
                      ? "bg-white/10 text-text-main border-border-main"
                      : "bg-transparent text-text-muted border-border-main hover:bg-white/5",
                  )}
                >
                  Resolved
                </button>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-background/50 border border-border-main space-y-2">
            <div className="flex items-center gap-2">
              <Box className="w-3 h-3 opacity-50" />
              <span className="text-[10px] font-bold opacity-60 uppercase">Engine Status</span>
            </div>
            <p className="text-[10px] text-text-muted leading-relaxed font-mono">Model: {engineModel}</p>
            <div className="flex items-center justify-between rounded-lg border border-border-main bg-background/60 px-2.5 py-2">
              <span className="text-[10px] text-text-muted flex items-center gap-1.5">
                <DatabaseZap className="w-3.5 h-3.5" />
                Embedding: <span className="text-[var(--text-main)]">{embeddingModeLabel}</span>
              </span>
              <button
                onClick={onOpenEmbeddingSettings}
                className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
              >
                Setup
              </button>
            </div>
            <div className="h-1 w-full bg-border-main rounded-full overflow-hidden">
              <div
                className={clsx(
                  "h-full transition-all duration-1000",
                  active ? "w-full bg-[var(--accent-500)]" : "w-0 bg-border-main",
                )}
              />
            </div>
          </div>

          {authBannerVisible && (authShowGate || authRequiresVerified) && !active && (
            <div className="rounded-xl border border-amber-500/20 bg-white text-zinc-900 dark:bg-amber-500/10 dark:text-amber-200 px-3 py-2 text-[10px] space-y-2">
              <div>
                {authShowGate
                  ? "GitHub login is required before starting monitoring."
                  : "Cached session detected. Verify online to refresh GitHub access."}
              </div>
              <div className="flex gap-2">
                {!authShowGate && (
                  <button
                    onClick={() => void onVerifyAuth()}
                    disabled={authLoading}
                    className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Verify Now
                  </button>
                )}
                {authError && <span className="text-[10px] text-rose-500">{authError}</span>}
                {!authError && authWarning && <span className="text-[10px] text-amber-500">{authWarning}</span>}
              </div>
            </div>
          )}

          {settingsRequiresApiKey && !active && (
            <div className="rounded-xl border border-rose-500/20 bg-white text-rose-600 dark:bg-rose-500/10 dark:text-rose-500 px-3 py-2 text-[10px] space-y-2">
              <div>Setup required: add your {providerLabel} API key.</div>
              <button
                onClick={onOpenSettings}
                className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-rose-500 text-white rounded-md hover:opacity-90 transition-colors"
              >
                Open Settings
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="shrink-0 border-t border-border-main bg-surface/95 px-4 py-3 space-y-2">
        <button
          onClick={canToggleMonitoring ? () => void onToggleMonitoring() : undefined}
          disabled={!canToggleMonitoring}
          className={clsx(
            "w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all duration-300 transform active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
            active
              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20"
              : "bg-[var(--accent-500)] text-background hover:opacity-90",
          )}
        >
          {active ? (
            <>
              <Square className="w-3 h-3 fill-current" /> KILL GUARDIAN
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" /> LAUNCH GUARDIAN
            </>
          )}
        </button>
        {!active && !canToggleMonitoring && launchBlockingReason && (
          <p className="text-[10px] text-amber-400 px-1">{launchBlockingReason}</p>
        )}
      </section>
    </aside>
  );
}

function StatMini({
  icon,
  count,
  label,
  color,
}: {
  icon: ReactNode;
  count: number;
  label: string;
  color: string;
}): ReactElement {
  return (
    <div className="flex items-center gap-2 px-3 border-r border-white/5 last:border-r-0 hover:bg-white/[0.02] transition-colors rounded-md h-8 group cursor-default">
      <div className="group-hover:scale-110 transition-transform">{icon}</div>
      <div className="flex flex-col -space-y-1">
        <span className={clsx("text-sm font-black tabular-nums", color)}>{count}</span>
        <span className="text-[8px] font-bold uppercase tracking-widest opacity-30 group-hover:opacity-60 transition-opacity">
          {label}
        </span>
      </div>
    </div>
  );
}

function CostMetric({
  tokens,
  calls,
  filesAnalyzed,
  queueWaitMs,
  scanProfileLabel,
}: {
  tokens: number;
  calls: number;
  filesAnalyzed: number;
  queueWaitMs: number;
  scanProfileLabel: string;
}): ReactElement {
  const costUnits = (tokens / 1000).toFixed(2);
  const queueLabel = queueWaitMs > 0 ? `${Math.round(queueWaitMs)}ms` : "0ms";

  return (
    <div className="p-3 rounded-xl bg-background/50 border border-border-main space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Cost Metric</span>
        <span className="text-[10px] font-mono opacity-40">est</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-black text-[var(--accent-500)] tabular-nums">{costUnits}</span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">units</span>
      </div>
      <div className="text-[10px] font-mono text-zinc-500">
        Tokens: {tokens} • API calls: {calls} • Files: {filesAnalyzed}
      </div>
      <div className="text-[10px] font-mono text-zinc-500">
        Queue wait: {queueLabel} • Scope: {scanProfileLabel}
      </div>
    </div>
  );
}
