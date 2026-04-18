import {
  type ReactElement,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useState,
} from "react";
import clsx from "clsx";
import { VariableSizeList, type ListChildComponentProps } from "react-window";
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
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

/* ── Virtualization constants ── */
const CRITIQUE_ROW_HEIGHT = 72;
const CRITIQUE_EXPANDED_ESTIMATE = 600;
const VIRTUALIZE_THRESHOLD = 50;

function normalizeUndoKey(value: string, root?: string): string {
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
}

interface CritiqueListData {
  filteredLogs: Critique[];
  expandedLogKey: string | null;
  onToggleLog: (key: string) => void;
  onAskGuruForLog: (log: Critique, useWebSearch?: boolean) => void;
  path: string;
  undoAvailableSet: Set<string>;
  onRefreshFixHistory: () => Promise<void>;
  baselineValid: boolean;
  baselineIds: Set<string>;
  onRowHeightMeasured: (index: number, height: number) => void;
}

function CritiqueVirtualRow({
  index,
  style,
  data,
}: ListChildComponentProps<CritiqueListData>): ReactElement {
  const log = data.filteredLogs[index];
  const key = critiqueStateKey(log);
  const isExpanded = data.expandedLogKey === key;
  const measureRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isExpanded || !measureRef.current) return;
    const actual = measureRef.current.getBoundingClientRect().height;
    if (Math.abs(actual - ((style.height as number) ?? 0)) > 2) {
      data.onRowHeightMeasured(index, actual);
    }
  });

  return (
    <div style={style}>
      <div ref={measureRef} style={{ paddingBottom: 8 }}>
        <CritiqueAccordionRow
          log={log}
          index={index + 1}
          isExpanded={isExpanded}
          onToggle={() => data.onToggleLog(key)}
          onAskGuru={() => data.onAskGuruForLog(log, false)}
          rootPath={data.path}
          undoAvailable={data.undoAvailableSet.has(normalizeUndoKey(log.file_path, data.path))}
          onFixHistoryRefresh={data.onRefreshFixHistory}
          findingStatus={
            data.baselineValid && log.finding_id
              ? data.baselineIds.has(log.finding_id)
                ? "active"
                : "new"
              : undefined
          }
        />
      </div>
    </div>
  );
}

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

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categoryFilteredLogs = useMemo(() => {
    if (!categoryFilter) return filteredLogs;
    return filteredLogs.filter((c) => c.category === categoryFilter);
  }, [filteredLogs, categoryFilter]);

  const undoAvailableSet = useMemo(
    () => new Set<string>((fixHistory || []).map((entry) => normalizeUndoKey(entry.file_path))),
    [fixHistory],
  );

  /* ── Virtualization state ── */
  const listRef = useRef<VariableSizeList<CritiqueListData>>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollAreaHeight, setScrollAreaHeight] = useState(400);
  const expandedMeasuredHeight = useRef(CRITIQUE_EXPANDED_ESTIMATE);
  const shouldVirtualize =
    baselineView !== "resolved" && categoryFilteredLogs.length >= VIRTUALIZE_THRESHOLD;

  useEffect(() => {
    if (!shouldVirtualize) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScrollAreaHeight(entry.contentRect.height);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [shouldVirtualize]);

  useEffect(() => {
    if (!shouldVirtualize) return;
    expandedMeasuredHeight.current = CRITIQUE_EXPANDED_ESTIMATE;
    listRef.current?.resetAfterIndex(0);
    if (expandedLogKey) {
      const idx = categoryFilteredLogs.findIndex((l) => critiqueStateKey(l) === expandedLogKey);
      if (idx >= 0) {
        requestAnimationFrame(() => listRef.current?.scrollToItem(idx, "smart"));
      }
    }
  }, [expandedLogKey, categoryFilteredLogs, shouldVirtualize]);

  const critiqueItemSize = useCallback(
    (index: number): number => {
      const log = categoryFilteredLogs[index];
      return expandedLogKey === critiqueStateKey(log)
        ? expandedMeasuredHeight.current
        : CRITIQUE_ROW_HEIGHT;
    },
    [categoryFilteredLogs, expandedLogKey],
  );

  const handleRowHeightMeasured = useCallback((index: number, height: number) => {
    expandedMeasuredHeight.current = height;
    listRef.current?.resetAfterIndex(index);
  }, []);

  const critiqueItemData = useMemo<CritiqueListData>(
    () => ({
      filteredLogs: categoryFilteredLogs,
      expandedLogKey,
      onToggleLog,
      onAskGuruForLog,
      path,
      undoAvailableSet,
      onRefreshFixHistory,
      baselineValid,
      baselineIds,
      onRowHeightMeasured: handleRowHeightMeasured,
    }),
    [
      categoryFilteredLogs,
      expandedLogKey,
      onToggleLog,
      onAskGuruForLog,
      path,
      undoAvailableSet,
      onRefreshFixHistory,
      baselineValid,
      baselineIds,
      handleRowHeightMeasured,
    ],
  );

  return (
    <main className="flex-1 flex overflow-hidden gap-3">
      <section
        className={clsx(
          "flex-1 overflow-hidden flex flex-col bg-[var(--panel-bg)] rounded-2xl guardian-elevated-card transition-colors duration-300 relative",
          view === "monitor" ? "flex" : "hidden",
        )}
      >
        <div className="guardian-topbar guardian-topbar-text sticky top-0 z-10 transition-colors duration-300 shrink-0">
          <div className="w-8 shrink-0">{t("monitor.tableIndex")}</div>
          <div className="w-48 shrink-0">{t("monitor.tableFilePath")}</div>
          <div className="flex-1 min-w-0 px-4">{t("monitor.tableMessage")}</div>
          <div className="w-40 text-right shrink-0">{t("monitor.tableActions")}</div>
        </div>

        {baselineView !== "resolved" && filteredLogs.length > 0 && (
          <div className="flex items-center gap-1.5 px-6 py-2 border-b border-border-main overflow-x-auto shrink-0">
            <Button
              onClick={() => setCategoryFilter(null)}
              className={clsx(
                !categoryFilter
                  ? "bg-[var(--accent-200)] text-[var(--accent-500)] border-[var(--accent-400)]"
                  : "bg-transparent text-text-muted border-transparent hover:bg-[var(--panel-muted)]",
              )}
              variant="ghost"
              size="sm"
            >
              All
            </Button>
            {(["Security", "Architecture", "Performance", "Reliability", "Maintainability", "TypeSafety"] as const).map((cat) => {
              const count = filteredLogs.filter((c) => c.category === cat).length;
              if (count === 0) return null;
              return (
                <Button
                  key={cat}
                  onClick={() => setCategoryFilter((prev) => (prev === cat ? null : cat))}
                  className={clsx(
                    "gap-1 border",
                    categoryFilter === cat
                      ? cat === "Security" ? "bg-red-500/20 text-red-400 border-red-500/30"
                        : cat === "Performance" ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          : cat === "Architecture" ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                            : cat === "Reliability" ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                              : cat === "TypeSafety" ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                                : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-transparent text-text-muted border-transparent hover:bg-[var(--panel-muted)]",
                  )}
                  variant="ghost"
                  size="sm"
                >
                  {cat} <span className="opacity-50">({count})</span>
                </Button>
              );
            })}
          </div>
        )}

        {showFloatingFilter && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4 pointer-events-none">
            <Panel surface="elevated" padding="sm" rounded="xl" className="pointer-events-auto mx-auto max-w-md shadow-lg shadow-black/15">
              <div className="group relative flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-text-muted group-focus-within:text-text-main transition-colors" />
                <input
                  className="guardian-focus-ring w-full bg-transparent text-xs outline-none placeholder:opacity-50"
                  value={filter}
                  onChange={(event) => onFilterChange(event.target.value)}
                  placeholder={t("monitor.searchPlaceholder")}
                />
                {filter.trim().length > 0 && (
                  <Button
                    onClick={() => onFilterChange("")}
                    variant="secondary"
                    size="sm"
                  >
                    {t("common.clear")}
                  </Button>
                )}
              </div>
            </Panel>
          </div>
        )}

        {active && categoryFilteredLogs.length !== 0 && baselineView !== "resolved" && (
          <div
            className={clsx(
              "pointer-events-none absolute inset-0 top-14 flex items-center justify-center transition-opacity opacity-20",
            )}
          >
            <GuardianActivity status={status} active={active} compact showLabel={false} />
          </div>
        )}

        <div
          ref={scrollContainerRef}
          className={clsx(
            "flex-1 px-2 custom-scrollbar",
            shouldVirtualize ? "overflow-hidden" : "overflow-y-auto",
            showFloatingFilter ? "pt-16 pb-2" : "py-2",
          )}
        >
          {baselineView === "resolved" ? (
            <div className="space-y-2">
              {!baselineStatus ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted gap-4 py-12">
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-sm text-text-muted">{t("monitor.resolved.noBaselineTitle")}</h3>
                    <p className="text-xs text-text-muted font-mono italic">
                      {t("monitor.resolved.noBaselineNote")}
                    </p>
                  </div>
                </div>
              ) : !baselineValid ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted gap-4 py-12">
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-sm text-text-muted">{t("monitor.resolved.invalidTitle")}</h3>
                    <p className="text-xs text-text-muted font-mono italic">
                      {t("monitor.resolved.invalidNote")}
                    </p>
                  </div>
                </div>
              ) : resolvedFindings.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted gap-4 py-12">
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-sm text-text-muted">{t("monitor.resolved.emptyTitle")}</h3>
                    <p className="text-xs text-text-muted font-mono italic">
                      {t("monitor.resolved.emptyNote")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {resolvedFindings.map((finding, index) => (
                    <div
                      key={finding.finding_id}
                      className="group overflow-hidden rounded-xl hover:bg-[var(--panel-muted)] transition-colors"
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
                          <Badge variant="success" size="md">
                            {t("critique.badgeResolved")}
                          </Badge>
                          <Badge variant="neutral" size="md">
                            {finding.severity}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : categoryFilteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted gap-6">
              {active ? (
                <GuardianActivity status={status} active={active} showLabel={false} />
              ) : (
                <div className="relative">
                  <CheckCircle2 className="w-16 h-16 text-text-muted" />
                </div>
              )}
              <div className="text-center space-y-1">
                <h3 className="font-bold text-sm text-text-muted">
                  {active ? t("monitor.guardianOnline") : t("monitor.systemSecure")}
                </h3>
                {(!active || status !== t("monitor.statusActive")) && (
                  <p className="text-xs text-text-muted font-mono italic">
                    {active ? status : t("monitor.offline")}
                  </p>
                )}
              </div>
            </div>
          ) : shouldVirtualize ? (
            <VariableSizeList
              ref={listRef}
              height={scrollAreaHeight}
              width="100%"
              itemCount={categoryFilteredLogs.length}
              itemSize={critiqueItemSize}
              itemData={critiqueItemData}
              overscanCount={5}
              className="custom-scrollbar"
            >
              {CritiqueVirtualRow}
            </VariableSizeList>
          ) : (
            <div className="space-y-2">
              {categoryFilteredLogs.map((log, index) => (
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
          "flex-1 overflow-hidden flex flex-col bg-[var(--panel-bg)] rounded-2xl guardian-elevated-card transition-colors duration-300",
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
          "flex-1 overflow-hidden flex flex-col bg-[var(--panel-bg)] rounded-2xl guardian-elevated-card transition-colors duration-300",
          view === "reviews" ? "flex" : "hidden",
        )}
      >
        {!path ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted text-sm">
            <div className="w-16 h-16 rounded-2xl border border-border-main bg-[var(--panel-muted)] flex items-center justify-center">
              <ClipboardList className="w-7 h-7 text-text-muted/80" />
            </div>
            <div className="text-xs ">{t("common.noWorkspaceSelected")}</div>
            <div className="text-xs text-text-muted max-w-md text-center">
              {t("reviews.selectWorkspaceHint")}
            </div>
            <Button
              onClick={() => void onSelectScope()}
              variant="secondary"
              size="sm"
              className="text-[var(--accent-500)]"
            >
              {t("common.selectWorkspace")}
            </Button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border-main bg-[var(--panel-muted)] px-6 py-4">
              <div className="flex items-start gap-4">
                <div className="space-y-1 min-w-0">
                  <h2 className="text-xs font-medium text-text-muted">
                    {t("reviews.appliedFixesTitle")}
                  </h2>
                  <div className="text-xs text-text-muted">
                    {t("reviews.appliedFixesNote")}
                  </div>
                  {fixHistoryError && (
                    <div className="text-xs text-[color:var(--tone-critical-text)] font-mono">{fixHistoryError}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 px-6 py-4 border-b border-border-main bg-[var(--panel-muted)]">
              <ReleaseDecisionPanel
                decision={releaseDecision}
                loading={releaseDecisionLoading}
                error={releaseDecisionError}
                onRefresh={onRefreshReleaseDecision}
                onSetDecision={onSetReleaseDecision}
                onOverride={onOverrideReleaseDecision}
              />
            </div>

            <div className="shrink-0 px-6 py-4 border-b border-border-main bg-[var(--panel-muted)]">
              {fixHistoryLoading ? (
                <div className="text-xs font-mono text-text-muted">{t("reviews.fixHistoryLoading")}</div>
              ) : fixHistory.length === 0 ? (
                <div className="text-xs text-text-muted">
                  {t("reviews.noAppliedFixes")}
                </div>
              ) : (
                <div className="space-y-2">
                  {fixHistory.slice(0, 12).map((entry) => (
                    <div
                      key={entry.file_path}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border-main bg-[var(--panel-bg)] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-text-main truncate">
                          {entry.file_path}
                        </div>
                        <div className="text-xs font-mono text-text-muted truncate">
                          {t("reviews.appliedLabel")}:{" "}
                          <span className="text-[var(--text-main)]">{formatTimestamp(entry.applied_at)}</span>
                        </div>
                      </div>
                      <Button
                        onClick={() => void onUndoFix(entry.file_path)}
                        variant="danger"
                        size="md"
                        title={t("reviews.undoTitle")}
                      >
                        {t("common.undo")}
                      </Button>
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
          "flex-1 overflow-hidden flex flex-col bg-[var(--panel-bg)] rounded-2xl guardian-elevated-card transition-colors duration-300",
          view === "ai-context" ? "flex" : "hidden",
        )}
      >
        {!path ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted text-sm">
            <div className="w-16 h-16 rounded-2xl border border-border-main bg-[var(--panel-muted)] flex items-center justify-center">
              <EyeOff className="w-7 h-7 text-text-muted/80" />
            </div>
            <div className="text-xs ">{t("aiContext.titleEmpty")}</div>
            <div className="text-xs text-text-muted max-w-md text-center">
              {t("aiContext.noteEmpty")}
            </div>
            <Button
              onClick={() => void onSelectScope()}
              variant="secondary"
              size="sm"
              className="text-[var(--accent-500)]"
            >
              {t("common.selectWorkspace")}
            </Button>
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
          "flex-1 overflow-hidden flex flex-col bg-[var(--panel-bg)] rounded-2xl guardian-elevated-card transition-colors duration-300",
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
              <span className="text-xs text-[color:var(--tone-critical-text)] max-w-[280px] truncate" title={contextError}>
                {contextError}
              </span>
            )}
            <Button
              onClick={async () => {
                try {
                  await onRefreshContext();
                  toast.showSuccess(t("toast.refreshed"), 2500);
                } catch {
                  toast.showError(t("toast.refreshFailed"), 3000);
                }
              }}
              disabled={!path || contextLoading}
              variant="secondary"
              size="sm"
            >
              {contextLoading ? t("diagram.scanning") : t("common.rescan")}
            </Button>
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
            <div className="text-xs ">{t("diagram.emptyTitle")}</div>
            <div className="text-xs text-text-muted max-w-md text-center">
              {t("diagram.emptyNote")}
            </div>
            <Button
              onClick={() => void onSelectScope()}
              variant="secondary"
              size="sm"
              className="text-[var(--accent-500)]"
            >
              {t("common.selectWorkspace")}
            </Button>
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
        <div className="mt-1 text-xs font-medium text-[var(--accent-500)] opacity-70">
          {label}
        </div>
      )}
    </div>
  );
}
