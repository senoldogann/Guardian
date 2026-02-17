import type { ReactElement } from "react";
import clsx from "clsx";
import { CheckCircle2, ClipboardList, EyeOff, Search, Shield } from "lucide-react";
import { CritiqueAccordionRow } from "../CritiqueAccordionRow";
import { ChatView, type AutoPrompt } from "../ChatView";
import DiagramView from "../DiagramView";
import { FixProposalsView } from "../FixProposalsView";
import { AIContextPreview } from "../AIContextPreview";
import type {
  AiContextSnapshot,
  BaselineFinding,
  BaselineStatusView,
  Critique,
  FixProposal,
  FixProposalsSnapshot,
  FixHistoryEntry,
  ProjectContext,
} from "../../types";
import { critiqueStateKey } from "../../lib/critiqueStateKey";
import { formatTimestamp } from "../../lib/uiFormat";

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
  onRefreshFixProposals: () => Promise<void>;
  onRequestReview: (proposal: FixProposal) => Promise<void>;
  onSetProposalStatus: (proposalId: string, status: string) => Promise<void>;
  fixHistory: FixHistoryEntry[];
  fixHistoryLoading: boolean;
  fixHistoryError: string | null;
  onRefreshFixHistory: () => Promise<void>;
  onUndoFix: (filePath: string) => Promise<void>;
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
  onRefreshFixProposals,
  onRequestReview,
  onSetProposalStatus,
  fixHistory,
  fixHistoryLoading,
  fixHistoryError,
  onRefreshFixHistory,
  onUndoFix,
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
  return (
    <main className="flex-1 flex overflow-hidden">
      <section
        className={clsx(
          "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300 relative",
          view === "monitor" ? "flex" : "hidden",
        )}
      >
        <div className="guardian-topbar guardian-topbar-text sticky top-0 z-10 transition-colors duration-300 shrink-0">
          <div className="w-8 shrink-0">#</div>
          <div className="w-48 shrink-0">File Path</div>
          <div className="flex-1 min-w-0 px-4">Core Violation Message</div>
          <div className="w-40 text-right shrink-0">Actions / Sev</div>
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
                  placeholder="Search issues (file, message, severity)..."
                />
                {filter.trim().length > 0 && (
                  <button
                    onClick={() => onFilterChange("")}
                    className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                  >
                    Clear
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
            <GuardianActivity status={status} compact showLabel={false} />
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
                    <h3 className="font-bold text-sm text-zinc-500">No Baseline</h3>
                    <p className="text-[10px] text-zinc-500 font-mono italic">
                      Click "Set Baseline" to enable resolved tracking.
                    </p>
                  </div>
                </div>
              ) : !baselineValid ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4 py-12">
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-sm text-zinc-500">Baseline Invalid</h3>
                    <p className="text-[10px] text-zinc-500 font-mono italic">
                      Rules changed since baseline. Reset baseline to continue.
                    </p>
                  </div>
                </div>
              ) : resolvedFindings.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4 py-12">
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-sm text-zinc-500">No Resolved Findings</h3>
                    <p className="text-[10px] text-zinc-500 font-mono italic">
                      Nothing has been resolved since the current baseline.
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
                            {finding.message ?? "Resolved since baseline"}
                          </div>
                        </div>
                        <div className="w-52 shrink-0 flex items-center justify-end gap-2">
                          <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            RESOLVED
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
                <GuardianActivity status={status} showLabel={false} />
              ) : (
                <div className="relative">
                  <CheckCircle2 className="w-16 h-16 text-zinc-500" />
                </div>
              )}
              <div className="text-center space-y-1">
                <h3 className="font-bold text-sm text-zinc-500">
                  {active ? "Guardian Online" : "System Secure"}
                </h3>
                {(!active || status !== "Monitoring Active") && (
                  <p className="text-[10px] text-zinc-500 font-mono italic">
                    {active ? status : "Guardian is offline."}
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
            <div className="text-xs uppercase tracking-widest">No workspace selected.</div>
            <div className="text-[10px] text-text-muted max-w-md text-center">
              Select a workspace, then write proposals to{" "}
              <span className="text-[var(--text-main)]">.guardian-proposals/fix_proposals.jsonl</span>.
            </div>
            <button
              onClick={() => void onSelectScope()}
              className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer"
            >
              Select Workspace
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border-main bg-surface/30 px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
                    Applied Fixes (Undo Available)
                  </h2>
                  <div className="text-[10px] text-text-muted">
                    Undo is stored per file (last applied fix only).
                  </div>
                  {fixHistoryError && (
                    <div className="text-[10px] text-rose-400 font-mono">{fixHistoryError}</div>
                  )}
                </div>

                <button
                  onClick={() => void onRefreshFixHistory()}
                  disabled={fixHistoryLoading}
                  className={clsx(
                    "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors flex items-center gap-2 cursor-pointer",
                    "bg-background/60 text-text-muted border-border-main hover:bg-border-main",
                    fixHistoryLoading && "opacity-50 cursor-not-allowed"
                  )}
                  title="Refresh fix history"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="shrink-0 px-6 py-4 border-b border-border-main bg-background/20">
              {fixHistoryLoading ? (
                <div className="text-[10px] font-mono text-text-muted">Loading...</div>
              ) : fixHistory.length === 0 ? (
                <div className="text-[10px] text-text-muted">
                  No applied fixes yet. Apply a fix from Monitor or Guru to see Undo here.
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
                          Applied: <span className="text-[var(--text-main)]">{formatTimestamp(entry.applied_at)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => void onUndoFix(entry.file_path)}
                        className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/15"
                        title="Undo last applied fix for this file"
                      >
                        Undo
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
                onRefresh={onRefreshFixProposals}
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
            <div className="text-xs uppercase tracking-widest">No workspace selected.</div>
            <div className="text-[10px] text-text-muted max-w-md text-center">
              Select a workspace, start monitoring, and modify a file to capture the outbound AI payload.
            </div>
            <button
              onClick={() => void onSelectScope()}
              className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer"
            >
              Select Workspace
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
            Project Map
            <span className="ml-2 text-text-main/70" title={path || "No workspace selected"}>
              {scopeLabel || "No workspace selected"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {contextError && (
              <span className="text-[10px] text-rose-500 max-w-[280px] truncate" title={contextError}>
                {contextError}
              </span>
            )}
            <button
              onClick={() => void onRefreshContext()}
              disabled={!path || contextLoading}
              className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 text-text-main rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {contextLoading ? "Scanning..." : "Rescan"}
            </button>
          </div>
        </div>
        {path && context?.file_structure && context.file_structure.length > 0 ? (
          <DiagramView
            filePaths={context.file_structure}
            rootName={scopeLabel || "Project Root"}
            autoExpandAll={false}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted text-sm">
            <div className="text-xs uppercase tracking-widest">Project map is empty.</div>
            <div className="text-[10px] text-text-muted max-w-md text-center">
              Select a workspace to build the map, then rescan to verify the correct directory.
            </div>
            <button
              onClick={() => void onSelectScope()}
              className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer"
            >
              Select Workspace
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
}: {
  status: string;
  compact?: boolean;
  showLabel?: boolean;
}): ReactElement {
  const label = status === "Monitoring Active" ? "" : status;
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
