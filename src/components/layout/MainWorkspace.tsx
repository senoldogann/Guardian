import type { ReactElement } from "react";
import clsx from "clsx";
import { CheckCircle2, ClipboardList, EyeOff, Search, Shield } from "lucide-react";
import { CritiqueAccordionRow } from "../CritiqueAccordionRow";
import { ChatView, type AutoPrompt } from "../ChatView";
import DiagramView from "../DiagramView";
import { FixProposalsView } from "../FixProposalsView";
import { AIContextPreview } from "../AIContextPreview";
import { ReleaseDecisionPanel } from "../ReleaseDecisionPanel";
import type {
  AiContextSnapshot,
  BaselineFinding,
  BaselineStatusView,
  Critique,
  FixProposal,
  FixProposalsSnapshot,
  FixHistoryEntry,
  ProjectContext,
  ReleaseDecisionStatus,
  ReleaseDecisionView,
} from "../../types";
import { critiqueStateKey } from "../../lib/critiqueStateKey";
import { formatTimestamp } from "../../lib/uiFormat";
import { useToast } from "../../hooks/useToast";
import { useI18n } from "../../i18n";

export interface MainWorkspaceProps {
  view: "monitor" | "chat" | "diagram" | "ai-context" | "reviews";
  active: boolean;
  status: string;
  showFloatingFilter: boolean;
  filter: string;
  onFilterChange: (next: string) => void;
  baselineView: "all" | "new" | "resolved";
  baselineStatus: BaselineStatusView | null;
  baselineValid: boolean;
  resolvedFindings: BaselineFinding[];
  filteredLogs: Critique[];
  baselineIds: Set<string>;
  expandedLogKey: string | null;
  onToggleLog: (key: string) => void;
  onAskGuruForLog: (log: Critique, useWebSearch?: boolean) => void;
  path: string;
  onSelectScope: () => Promise<void> | void;
  chatAutoPrompt: AutoPrompt | null;
  onAutoPromptConsumed: () => void;
  onGuruReply: () => void;
  webSearchEnabled: boolean;
  webSearchDepth: "basic" | "advanced" | "fast" | "ultra-fast" | "auto";
  onWebSearchToggle: () => void;
  webSearchReady: boolean;
  fixProposals: FixProposalsSnapshot | null;
  fixProposalsLoading: boolean;
  fixProposalsError: string | null;
  onRequestReview: (proposal: FixProposal) => Promise<void>;
  onSetProposalStatus: (proposalId: string, status: string) => Promise<void>;
  fixHistory: FixHistoryEntry[];
  fixHistoryLoading: boolean;
  fixHistoryError: string | null;
  onRefreshFixHistory: () => Promise<void>;
  onUndoFix: (filePath: string) => Promise<void>;
  releaseDecision: ReleaseDecisionView | null;
  releaseDecisionLoading: boolean;
  releaseDecisionError: string | null;
  onRefreshReleaseDecision: () => Promise<void>;
  onSetReleaseDecision: (
    decision: Exclude<ReleaseDecisionStatus, "OVERRIDDEN">,
    approver: string,
    reason?: string,
  ) => Promise<void>;
  onOverrideReleaseDecision: (approver: string, reason: string) => Promise<void>;
  aiContext: AiContextSnapshot | null;
  aiContextLoading: boolean;
  aiContextError: string | null;
  onRefreshAiContext: () => Promise<void>;
  onRefreshContext: () => Promise<void>;
  contextLoading: boolean;
  contextError: string | null;
  context: ProjectContext | null;
  scopeLabel: string;
}

export function MainWorkspace({
  view,
  active,
  status,
  showFloatingFilter,
  filter,
  onFilterChange,
  baselineView,
  baselineStatus,
  baselineValid,
  resolvedFindings,
  filteredLogs,
  baselineIds,
  expandedLogKey,
  onToggleLog,
  onAskGuruForLog,
  path,
  onSelectScope,
  chatAutoPrompt,
  onAutoPromptConsumed,
  onGuruReply,
  webSearchEnabled,
  webSearchDepth,
  onWebSearchToggle,
  webSearchReady,
  fixProposals,
  fixProposalsLoading,
  fixProposalsError,
  onRequestReview,
  onSetProposalStatus,
  fixHistory,
  fixHistoryLoading,
  fixHistoryError,
  onRefreshFixHistory,
  onUndoFix,
  releaseDecision,
  releaseDecisionLoading,
  releaseDecisionError,
  onRefreshReleaseDecision,
  onSetReleaseDecision,
  onOverrideReleaseDecision,
  aiContext,
  aiContextLoading,
  aiContextError,
  onRefreshAiContext,
  onRefreshContext,
  contextLoading,
  contextError,
  context,
  scopeLabel,
}: MainWorkspaceProps): ReactElement {
  const toast = useToast();
  const { t } = useI18n();
  const normalizeUndoKey = (value: string, root?: string): string => {
    let out = (value || "").trim().replace(/\\/g, "/");
    if (!out) return "";

    if (root) {
      const rootNorm = root.trim().replace(/\\/g, "/").replace(/\/+$/, "");
      if (rootNorm && (out === rootNorm || out.startsWith(`${rootNorm}/`))) {
        out = out.slice(rootNorm.length);
      }
    }

    out = out.replace(/^\.\/+/, "");
    out = out.replace(/^\/+/, "");
    return out;
  };

  const undoAvailableSet = new Set<string>(
    (fixHistory || []).map((entry) => normalizeUndoKey(entry.file_path)),
  );
  return (
    <main className="flex-1 flex overflow-hidden">
      <section
        className={clsx(
          "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300 relative",
          view === "monitor" ? "flex" : "hidden",
        )}
      >
        <div className="guardian-topbar guardian-topbar-text sticky top-0 z-10 transition-colors duration-300 shrink-0">
          <div className="w-8 shrink-0">{t("monitor.tableIndex")}</div>
          <div className="w-48 shrink-0">{t("monitor.tableFilePath")}</div>
          <div className="flex-1 min-w-0 px-4">{t("monitor.tableMessage")}</div>
          <div className="w-40 text-right shrink-0">{t("monitor.tableActions")}</div>
        </div>

        {showFloatingFilter && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4 pointer-events-none">
            <div className="pointer-events-auto mx-auto max-w-md rounded-xl border border-border-main bg-surface/90 backdrop-blur px-3 py-2 shadow-lg shadow-black/15">
              <div className="group relative flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  className="w-full bg-transparent text-xs outline-none placeholder:opacity-50"
                  value={filter}
                  onChange={(event) => onFilterChange(event.target.value)}
                  placeholder={t("monitor.searchPlaceholder")}
                />
                {filter.trim().length > 0 && (
                  <button
                    onClick={() => onFilterChange("")}
                    className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                  >
                    {t("common.clear")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {active && filteredLogs.length !== 0 && baselineView !== "resolved" && (
          <div
            className={clsx(
              "pointer-events-none absolute inset-0 top-14 flex items-center justify-center transition-opacity opacity-20",
            )}
          >
            <GuardianActivity status={status} active={active} compact showLabel={false} />
          </div>
        )}

        <div
          className={clsx(
            "flex-1 overflow-y-auto px-2 custom-scrollbar",
            showFloatingFilter ? "pt-16 pb-2" : "py-2",
          )}
        >
          {baselineView === "resolved" ? (
            <div className="space-y-2">
              {!baselineStatus ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4 py-12">
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-sm text-zinc-500">{t("monitor.resolved.noBaselineTitle")}</h3>
                    <p className="text-[10px] text-zinc-500 font-mono italic">
                      {t("monitor.resolved.noBaselineNote")}
                    </p>
                  </div>
                </div>
              ) : !baselineValid ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4 py-12">
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-sm text-zinc-500">{t("monitor.resolved.invalidTitle")}</h3>
                    <p className="text-[10px] text-zinc-500 font-mono italic">
                      {t("monitor.resolved.invalidNote")}
                    </p>
                  </div>
                </div>
              ) : resolvedFindings.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4 py-12">
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-sm text-zinc-500">{t("monitor.resolved.emptyTitle")}</h3>
                    <p className="text-[10px] text-zinc-500 font-mono italic">
                      {t("monitor.resolved.emptyNote")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {resolvedFindings.map((finding, index) => (
                    <div
                      key={finding.finding_id}
                      className="group overflow-hidden rounded-xl hover:bg-surface/50 transition-colors"
                    >
                      <div className="flex items-center px-6 py-4">
                        <div className="w-8 shrink-0 text-xs font-mono opacity-20">
                          {(index + 1).toString().padStart(2, "0")}
                        </div>
                        <div className="w-48 shrink-0 pr-4">
                          <div className="font-bold text-sm truncate" title={finding.file_path}>
                            {finding.file_path.split(/[/\\]/).pop() || finding.file_path}
                          </div>
                          <div className="text-xs opacity-30 font-mono truncate">{finding.file_path}</div>
                        </div>
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="text-sm opacity-80 font-medium truncate" title={finding.message ?? ""}>
                            {finding.message ?? t("monitor.resolved.defaultMessage")}
                          </div>
                        </div>
                        <div className="w-52 shrink-0 flex items-center justify-end gap-2">
                          <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            {t("critique.badgeResolved")}
                          </span>
                          <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border bg-white/5 text-text-muted border-border-main">
                            {finding.severity}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-6">
              {active ? (
                <GuardianActivity status={status} active={active} showLabel={false} />
              ) : (
                <div className="relative">
                  <CheckCircle2 className="w-16 h-16 text-zinc-500" />
                </div>
              )}
              <div className="text-center space-y-1">
                <h3 className="font-bold text-sm text-zinc-500">
                  {active ? t("monitor.guardianOnline") : t("monitor.systemSecure")}
                </h3>
                {(!active || status !== t("monitor.statusActive")) && (
                  <p className="text-[10px] text-zinc-500 font-mono italic">
                    {active ? status : t("monitor.offline")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log, index) => (
                <CritiqueAccordionRow
                  key={critiqueStateKey(log)}
                  log={log}
                  index={index + 1}
                  isExpanded={expandedLogKey === critiqueStateKey(log)}
                  onToggle={() => onToggleLog(critiqueStateKey(log))}
                  onAskGuru={() => onAskGuruForLog(log, false)}
                  rootPath={path}
                  undoAvailable={undoAvailableSet.has(normalizeUndoKey(log.file_path, path))}
                  onFixHistoryRefresh={onRefreshFixHistory}
                  findingStatus={
                    baselineValid && log.finding_id
                      ? baselineIds.has(log.finding_id)
                        ? "active"
                        : "new"
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        className={clsx(
          "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300",
          view === "chat" ? "flex" : "hidden",
        )}
      >
        <ChatView
          path={path}
          autoPrompt={chatAutoPrompt}
          onAutoPromptConsumed={onAutoPromptConsumed}
          onGuruReply={onGuruReply}
          onFixHistoryRefresh={onRefreshFixHistory}
          webSearchEnabled={webSearchEnabled}
          webSearchDepth={webSearchDepth}
          onWebSearchToggle={onWebSearchToggle}
          webSearchReady={webSearchReady}
        />
      </section>

      <section
        className={clsx(
          "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300",
          view === "reviews" ? "flex" : "hidden",
        )}
      >
        {!path ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted text-sm">
            <div className="w-16 h-16 rounded-2xl border border-border-main bg-background/40 flex items-center justify-center">
              <ClipboardList className="w-7 h-7 text-text-muted/80" />
            </div>
            <div className="text-xs uppercase tracking-widest">{t("common.noWorkspaceSelected")}</div>
            <div className="text-[10px] text-text-muted max-w-md text-center">
              {t("reviews.selectWorkspaceHint")}
            </div>
            <button
              onClick={() => void onSelectScope()}
              className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer"
            >
              {t("common.selectWorkspace")}
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border-main bg-surface/30 px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
                    {t("reviews.appliedFixesTitle")}
                  </h2>
                  <div className="text-[10px] text-text-muted">
                    {t("reviews.appliedFixesNote")}
                  </div>
                  {fixHistoryError && (
                    <div className="text-[10px] text-rose-400 font-mono">{fixHistoryError}</div>
                  )}
                </div>

                <button
                  onClick={async () => {
                    try {
                      await onRefreshFixHistory();
                      toast.showSuccess(t("toast.refreshed"), 2500);
                    } catch {
                      toast.showError(t("toast.refreshFailed"), 3000);
                    }
                  }}
                  disabled={fixHistoryLoading}
                  className={clsx(
                    "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors flex items-center gap-2 cursor-pointer",
                    "bg-background/60 text-text-muted border-border-main hover:bg-border-main",
                    fixHistoryLoading && "opacity-50 cursor-not-allowed"
                  )}
                  title={t("common.refresh")}
                >
                  {t("common.refresh")}
                </button>
              </div>
            </div>

            <div className="shrink-0 px-6 py-4 border-b border-border-main bg-background/20">
              <ReleaseDecisionPanel
                decision={releaseDecision}
                loading={releaseDecisionLoading}
                error={releaseDecisionError}
                onRefresh={onRefreshReleaseDecision}
                onSetDecision={onSetReleaseDecision}
                onOverride={onOverrideReleaseDecision}
              />
            </div>

            <div className="shrink-0 px-6 py-4 border-b border-border-main bg-background/20">
              {fixHistoryLoading ? (
                <div className="text-[10px] font-mono text-text-muted">{t("reviews.fixHistoryLoading")}</div>
              ) : fixHistory.length === 0 ? (
                <div className="text-[10px] text-text-muted">
                  {t("reviews.noAppliedFixes")}
                </div>
              ) : (
                <div className="space-y-2">
                  {fixHistory.slice(0, 12).map((entry) => (
                    <div
                      key={entry.file_path}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border-main bg-background/40 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-text-main truncate">
                          {entry.file_path}
                        </div>
                        <div className="text-[10px] font-mono text-text-muted truncate">
                          {t("reviews.appliedLabel")}:{" "}
                          <span className="text-[var(--text-main)]">{formatTimestamp(entry.applied_at)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => void onUndoFix(entry.file_path)}
                        className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/15"
                        title={t("reviews.undoTitle")}
                      >
                        {t("common.undo")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0">
              <FixProposalsView
                snapshot={fixProposals}
                loading={fixProposalsLoading}
                error={fixProposalsError}
                onRequestReview={onRequestReview}
                onSetStatus={onSetProposalStatus}
              />
            </div>
          </div>
        )}
      </section>

      <section
        className={clsx(
          "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300",
          view === "ai-context" ? "flex" : "hidden",
        )}
      >
        {!path ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted text-sm">
            <div className="w-16 h-16 rounded-2xl border border-border-main bg-background/40 flex items-center justify-center">
              <EyeOff className="w-7 h-7 text-text-muted/80" />
            </div>
            <div className="text-xs uppercase tracking-widest">{t("aiContext.titleEmpty")}</div>
            <div className="text-[10px] text-text-muted max-w-md text-center">
              {t("aiContext.noteEmpty")}
            </div>
            <button
              onClick={() => void onSelectScope()}
              className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer"
            >
              {t("common.selectWorkspace")}
            </button>
          </div>
        ) : (
          <AIContextPreview
            context={aiContext}
            loading={aiContextLoading}
            error={aiContextError}
            onRefresh={onRefreshAiContext}
          />
        )}
      </section>

      <section
        className={clsx(
          "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300",
          view === "diagram" ? "flex" : "hidden",
        )}
      >
        <div className="guardian-topbar justify-between">
          <div className="guardian-topbar-text">
            {t("diagram.title")}
            <span className="ml-2 text-text-main/70" title={path || t("common.noWorkspaceSelected")}>
              {scopeLabel || t("common.noWorkspaceSelected")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {contextError && (
              <span className="text-[10px] text-rose-500 max-w-[280px] truncate" title={contextError}>
                {contextError}
              </span>
            )}
            <button
              onClick={async () => {
                try {
                  await onRefreshContext();
                  toast.showSuccess(t("toast.refreshed"), 2500);
                } catch {
                  toast.showError(t("toast.refreshFailed"), 3000);
                }
              }}
              disabled={!path || contextLoading}
              className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 text-text-main rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {contextLoading ? t("diagram.scanning") : t("common.rescan")}
            </button>
          </div>
        </div>
        {path && context?.file_structure && context.file_structure.length > 0 ? (
          <DiagramView
            filePaths={context.file_structure}
            rootName={scopeLabel || t("diagram.projectRoot")}
            autoExpandAll={false}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted text-sm">
            <div className="text-xs uppercase tracking-widest">{t("diagram.emptyTitle")}</div>
            <div className="text-[10px] text-text-muted max-w-md text-center">
              {t("diagram.emptyNote")}
            </div>
            <button
              onClick={() => void onSelectScope()}
              className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer"
            >
              {t("common.selectWorkspace")}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function GuardianActivity({
  status,
  compact = false,
  showLabel = true,
  active = false,
}: {
  status: string;
  compact?: boolean;
  showLabel?: boolean;
  active?: boolean;
}): ReactElement {
  const label = active ? "" : status;
  return (
    <div
      className={clsx("flex flex-col items-center gap-5", compact && "scale-75")}
      data-testid="guardian-activity"
    >
      <div className="guardian-activity">
        <div className="guardian-pulse-ring" />
        <div className="guardian-pulse-ring delay" />
        <div className="guardian-orbit" />
        <div className="guardian-core">
          <Shield className="w-5 h-5 text-[var(--accent-500)]" />
        </div>
      </div>
      {!compact && showLabel && label && (
        <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[var(--accent-500)] opacity-70">
          {label}
        </div>
      )}
    </div>
  );
}
