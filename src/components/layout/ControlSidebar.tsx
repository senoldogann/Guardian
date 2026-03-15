import type { ReactElement, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Share2,
  Eye,
  Square,
  ChevronDown,
} from "lucide-react";
import type { BaselineStatusView } from "../../types";
import { useI18n } from "../../i18n";

const SIDEBAR_COLLAPSED_KEY = "guardian_sidebar_collapsed";
const SIDEBAR_DETAILS_OPEN_KEY = "guardian_sidebar_details_open_v4";

export interface ControlSidebarProps {
  view: "monitor" | "chat" | "diagram" | "ai-context" | "reviews";
  onViewChange: (view: "monitor" | "chat" | "diagram" | "ai-context" | "reviews") => void;
  hasAiContextData: boolean;
  hasReviewData: boolean;
  pendingFixProposalsCount: number;
  guruUnreadCount: number;
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
  guruUnreadCount,
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
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const persistCollapsed = (next: boolean): void => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    } catch {
      // ignore
    }
  };

  const persistDetailsOpen = (next: boolean): void => {
    try {
      localStorage.setItem(SIDEBAR_DETAILS_OPEN_KEY, String(next));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    try {
      const storedCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (storedCollapsed === "true" || storedCollapsed === "false") setCollapsed(storedCollapsed === "true");
      const storedDetails = localStorage.getItem(SIDEBAR_DETAILS_OPEN_KEY);
      if (storedDetails === "true" || storedDetails === "false") setDetailsOpen(storedDetails === "true");
    } catch {
      // ignore (private mode / disabled storage)
    }
  }, []);



  const toggleCollapsed = (): void => {
    setCollapsed((prev) => {
      const next = !prev;
      persistCollapsed(next);
      return next;
    });
  };

  const toggleDetails = (): void => {
    if (collapsed) {
      // Expand the sidebar before showing details.
      setCollapsed(false);
      persistCollapsed(false);
      setDetailsOpen(true);
      persistDetailsOpen(true);
      return;
    }
    setDetailsOpen((prev) => {
      const next = !prev;
      persistDetailsOpen(next);
      return next;
    });
  };

  const baselineLabel = useMemo(() => {
    if (baselineLoading) return t("sidebar.baseline.labelLoading");
    if (!baselineStatus) return t("sidebar.baseline.labelNone");
    if (baselineStatus.valid) return t("sidebar.baseline.labelValid");
    return t("sidebar.baseline.labelInvalid");
  }, [baselineLoading, baselineStatus]);

  const costUnits = useMemo(() => (tokens / 1000).toFixed(2), [tokens]);

  const detailsSummary = useMemo(() => {
    const pieces = [`${t("sidebar.cost.title")} ${costUnits}u`, baselineLabel];
    pieces.push(`${t("sidebar.engine.embedding")} ${embeddingModeLabel}`);
    return pieces.join(" • ");
  }, [baselineLabel, costUnits, embeddingModeLabel, t]);

  return (
    <aside
      className={clsx(
        "guardian-elevated-card rounded-2xl transition-colors duration-300 flex flex-col min-h-0 overflow-hidden",
        collapsed ? "w-[4.5rem] min-w-[4.5rem]" : "w-72 xl:w-80 min-w-[17rem]",
      )}
    >
      <div
        className={clsx(
          "shrink-0 px-3 py-3 border-b border-border-main/60",
          collapsed ? "flex justify-center" : "flex items-center justify-between",
        )}
      >
        {!collapsed && (
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted select-none">
            {t("sidebar.controlHub")}
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          className={clsx(
            "guardian-focus-ring rounded-lg border border-border-main bg-background/40 hover:bg-background/70 transition-colors",
            collapsed ? "p-2" : "px-2.5 py-2",
          )}
          title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      <div className={clsx("flex-1 min-h-0 overflow-hidden", collapsed ? "px-2 py-3" : "px-3 py-3")}>
        <div className={clsx(collapsed ? "flex flex-col items-center gap-3" : "space-y-4")}>
          {collapsed ? (
            <>
              <nav className="flex flex-col items-center gap-2 w-full">
                <DockNavButton
                  active={view === "monitor"}
                  label={t("sidebar.nav.monitor")}
                  onClick={() => onViewChange("monitor")}
                  icon={<Activity className="w-5 h-5" />}
                />
                <DockNavButton
                  active={view === "chat"}
                  label={t("sidebar.nav.guru")}
                  onClick={() => onViewChange("chat")}
                  badge={guruUnreadCount > 0 ? guruUnreadCount : undefined}
                  icon={<MessageSquare className="w-5 h-5" />}
                />
                <DockNavButton
                  active={view === "diagram"}
                  label={t("sidebar.nav.projectMap")}
                  onClick={() => onViewChange("diagram")}
                  icon={<Share2 className="w-5 h-5" />}
                />
                <DockNavButton
                  active={view === "ai-context"}
                  label={t("sidebar.nav.aiContext")}
                  onClick={() => onViewChange("ai-context")}
                  icon={<Eye className="w-5 h-5" />}
                />
                <DockNavButton
                  active={view === "reviews"}
                  label={t("sidebar.nav.reviews")}
                  onClick={() => onViewChange("reviews")}
                  icon={<ClipboardCheck className="w-5 h-5" />}
                />
              </nav>

              <div className="flex flex-col items-center gap-2 w-full">
                <DockActionButton
                  label={t("sidebar.selectWorkspace")}
                  title={scopeLabel || t("sidebar.selectWorkspace")}
                  onClick={() => void onSelectScope()}
                  icon={<Folder className="w-5 h-5" />}
                />
                <DockActionButton
                  label={t("sidebar.showDetails")}
                  title={detailsSummary}
                  onClick={toggleDetails}
                  icon={<Box className="w-5 h-5" />}
                />
              </div>
            </>
          ) : (
            <>
              <div className="guardian-subtle-card rounded-2xl p-2 space-y-1.5">
                <NavRow
                  active={view === "monitor"}
                  label={t("sidebar.nav.monitor")}
                  onClick={() => onViewChange("monitor")}
                  icon={<Activity className="w-4 h-4" />}
                />
                <NavRow
                  active={view === "chat"}
                  label={t("sidebar.nav.guru")}
                  onClick={() => onViewChange("chat")}
                  icon={<MessageSquare className="w-4 h-4" />}
                  right={
                    guruUnreadCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border bg-[color:var(--tone-critical-bg)] text-[color:var(--tone-critical-text)] border-[color:var(--tone-critical-border)] tabular-nums">
                        {Math.min(99, guruUnreadCount)}
                      </span>
                    ) : undefined
                  }
                />
                <NavRow
                  active={view === "diagram"}
                  label={t("sidebar.nav.projectMap")}
                  onClick={() => onViewChange("diagram")}
                  icon={<Share2 className="w-4 h-4" />}
                />
                <NavRow
                  active={view === "ai-context"}
                  label={t("sidebar.nav.aiContext")}
                  onClick={() => onViewChange("ai-context")}
                  icon={<Eye className="w-4 h-4" />}
                  right={
                    <span
                      className={clsx(
                        "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border",
                        hasAiContextData
                          ? "bg-[color:var(--tone-success-bg)] text-[color:var(--tone-success-text)] border-[color:var(--tone-success-border)]"
                          : "bg-[var(--panel-muted)] text-text-muted border-border-main",
                      )}
                    >
                      {hasAiContextData ? t("sidebar.ready") : t("sidebar.empty")}
                    </span>
                  }
                />
                <NavRow
                  active={view === "reviews"}
                  label={t("sidebar.nav.reviews")}
                  onClick={() => onViewChange("reviews")}
                  icon={<ClipboardCheck className="w-4 h-4" />}
                  right={
                    pendingFixProposalsCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border bg-[color:var(--tone-warning-bg)] text-[color:var(--tone-warning-text)] border-[color:var(--tone-warning-border)] tabular-nums">
                        {pendingFixProposalsCount}
                      </span>
                    ) : (
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border",
                          hasReviewData
                            ? "bg-[var(--panel-bg)] text-text-main border-border-main"
                            : "bg-[var(--panel-muted)] text-text-muted border-border-main",
                        )}
                      >
                        {hasReviewData ? t("sidebar.log") : t("sidebar.empty")}
                      </span>
                    )
                  }
                />
              </div>

              <div className="guardian-subtle-card rounded-xl p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <StatMini
                    label={t("sidebar.files")}
                    count={totalFiles}
                    icon={<Files className="w-3.5 h-3.5 text-zinc-400" />}
                    color="text-[var(--stat-strong)]"
                  />
                  <StatMini
                    label={t("sidebar.issues")}
                    count={totalIssues}
                    icon={<AlertCircle className="w-3.5 h-3.5 text-[color:var(--tone-warning-text)]" />}
                    color="text-[var(--stat-strong)]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
                    {t("sidebar.scope")}
                  </label>
                  <div className="group relative">
                    <Folder className="absolute left-3 top-3 w-4 h-4 text-zinc-500 group-focus-within:text-text-main transition-colors pointer-events-none" />
                    <input
                      readOnly
                      onClick={() => void onSelectScope()}
                      className="w-full bg-background border border-border-main rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-opacity-100 transition-all placeholder:opacity-50 cursor-pointer hover:bg-border-main"
                      value={scopeLabel}
                      placeholder={t("sidebar.selectWorkspace")}
                    />
                  </div>
                </div>

                <button
                  onClick={toggleDetails}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border-main bg-background/40 hover:bg-background/60 transition-colors"
                  aria-label={detailsOpen ? t("sidebar.hideDetails") : t("sidebar.showDetails")}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    {t("sidebar.details")}
                  </span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-text-muted truncate">{detailsSummary}</span>
                    <ChevronDown className={clsx("w-4 h-4 opacity-70 transition-transform", detailsOpen && "rotate-180")} />
                  </span>
                </button>

                {detailsOpen && (
                  <div className="rounded-xl border border-border-main bg-background/30 overflow-y-auto custom-scrollbar max-h-[34vh]">
                    <div className="p-3 space-y-2">
                      <CostMetricSection
                        tokens={tokens}
                        calls={calls}
                        filesAnalyzed={filesAnalyzed}
                        queueWaitMs={queueWaitMs}
                        scanProfileLabel={scanProfileLabel}
                      />
                    </div>
                    <div className="h-px bg-border-main" />
                    <div className="p-3 space-y-2">
                      <BaselineSection
                        baselineLoading={baselineLoading}
                        baselineStatus={baselineStatus}
                        baselineValid={baselineValid}
                        baselineMetrics={baselineMetrics}
                        baselineError={baselineError}
                        baselineView={baselineView}
                        path={path}
                        onSetBaselineNow={onSetBaselineNow}
                        onClearBaselineNow={onClearBaselineNow}
                        onBaselineViewChange={onBaselineViewChange}
                      />
                    </div>
                    <div className="h-px bg-border-main" />
                    <div className="p-3 space-y-2">
                      <EngineSection
                        engineModel={engineModel}
                        embeddingModeLabel={embeddingModeLabel}
                        active={active}
                        onOpenEmbeddingSettings={onOpenEmbeddingSettings}
                      />
                    </div>

                    {(authBannerVisible && (authShowGate || authRequiresVerified) && !active) ||
                      (settingsRequiresApiKey && !active) ? (
                      <>
                        <div className="h-px bg-border-main" />
                        <div className="p-3 space-y-2">
                          {authBannerVisible && (authShowGate || authRequiresVerified) && !active && (
                            <div className="rounded-xl border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-bg)] text-[color:var(--tone-warning-text)] px-3 py-2 text-[10px] space-y-2">
                              <div>
                                {authShowGate
                                  ? t("sidebar.authLoginRequired")
                                  : t("sidebar.authVerifyRequired")}
                              </div>
                              <div className="flex gap-2">
                                {!authShowGate && (
                                  <button
                                    onClick={() => void onVerifyAuth()}
                                    disabled={authLoading}
                                    className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {t("sidebar.verifyNow")}
                                  </button>
                                )}
                                {authError && <span className="text-[10px] text-[color:var(--tone-critical-text)]">{authError}</span>}
                                {!authError && authWarning && (
                                  <span className="text-[10px] text-[color:var(--tone-warning-text)]">{authWarning}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {settingsRequiresApiKey && !active && (
                            <div className="rounded-xl border border-[color:var(--tone-critical-border)] bg-[color:var(--tone-critical-bg)] text-[color:var(--tone-critical-text)] px-3 py-2 text-[10px] space-y-2">
                              <div>
                                {t("sidebar.setupRequired", { provider: providerLabel })}
                              </div>
                              <button
                                onClick={onOpenSettings}
                                className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-[color:var(--tone-critical-text)] text-background rounded-md hover:opacity-90 transition-colors"
                              >
                                {t("sidebar.openSettings")}
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <section className={clsx("shrink-0 border-t border-border-main bg-surface/70 py-3 space-y-2", collapsed ? "px-2" : "px-4")}>
        {collapsed ? (
          <div className="flex items-center justify-center">
            <button
              onClick={canToggleMonitoring ? () => void onToggleMonitoring() : undefined}
              disabled={!canToggleMonitoring}
              className={clsx(
                "h-12 w-12 rounded-2xl font-bold flex items-center justify-center transition-all duration-300 transform active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border",
                active
                  ? "bg-[color:var(--tone-critical-bg)] text-[color:var(--tone-critical-text)] border-[color:var(--tone-critical-border)] hover:opacity-90"
                  : "bg-[var(--accent-500)] text-background border-border-main hover:opacity-90",
              )}
              title={
                active
                  ? t("sidebar.killGuardian")
                  : canToggleMonitoring
                    ? t("sidebar.launchGuardian")
                    : launchBlockingReason
                      ? t("sidebar.launchBlocked", { reason: launchBlockingReason })
                      : t("sidebar.launchGuardian")
              }
              aria-label={active ? t("sidebar.killGuardian") : t("sidebar.launchGuardian")}
            >
              {active ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={canToggleMonitoring ? () => void onToggleMonitoring() : undefined}
              disabled={!canToggleMonitoring}
              className={clsx(
                "w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all duration-300 transform active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                active
                  ? "bg-[color:var(--tone-critical-bg)] text-[color:var(--tone-critical-text)] border border-[color:var(--tone-critical-border)] hover:opacity-90"
                  : "bg-[var(--accent-500)] text-background hover:opacity-90",
              )}
              title={active ? t("sidebar.killGuardian") : t("sidebar.launchGuardian")}
              aria-label={active ? t("sidebar.killGuardian") : t("sidebar.launchGuardian")}
            >
              {active ? (
                <>
                  <Square className="w-3 h-3 fill-current" /> {t("sidebar.killGuardian")}
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" /> {t("sidebar.launchGuardian")}
                </>
              )}
            </button>
            {!active && !canToggleMonitoring && launchBlockingReason && (
              <p className="text-[10px] text-[color:var(--tone-warning-text)] px-1">{launchBlockingReason}</p>
            )}
          </>
        )}
      </section>
    </aside>
  );
}

function DockNavButton({
  active,
  label,
  icon,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  badge?: number;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        "relative h-11 w-11 rounded-2xl flex items-center justify-center transition-all border cursor-pointer",
        active
          ? "bg-[var(--accent-200)] shadow text-[var(--text-main)] border-[var(--panel-border-strong)]"
          : "bg-background/30 text-text-muted border-border-main hover:bg-background/55 hover:text-text-main",
      )}
    >
      {icon}
      {badge && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-[color:var(--tone-critical-text)] text-background text-[10px] font-black flex items-center justify-center leading-none tabular-nums shadow">
          {Math.min(99, badge)}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function DockActionButton({
  label,
  title,
  icon,
  onClick,
}: {
  label: string;
  title: string;
  icon: ReactNode;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={title}
      className="h-11 w-11 rounded-2xl flex items-center justify-center transition-colors border border-border-main bg-background/25 hover:bg-background/50 cursor-pointer"
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function NavRow({
  active,
  label,
  icon,
  right,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  right?: ReactNode;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        "w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer",
        active
          ? "bg-[var(--accent-200)] shadow text-[var(--text-main)] border border-[var(--panel-border-strong)]"
          : "opacity-70 hover:opacity-100",
      )}
    >
      <span className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </span>
      {right ?? null}
    </button>
  );
}

function CostMetricSection({
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
  const { t } = useI18n();
  const costUnits = (tokens / 1000).toFixed(2);
  const queueLabel = queueWaitMs > 0 ? `${Math.round(queueWaitMs)}ms` : "0ms";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
          {t("sidebar.cost.title")}
        </span>
        <span className="text-[10px] font-mono opacity-40">{t("sidebar.cost.est")}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-black text-[var(--accent-500)] tabular-nums">{costUnits}</span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
          {t("sidebar.cost.units")}
        </span>
      </div>
      <div className="text-[10px] font-mono text-text-muted">
        {t("sidebar.cost.tokens")}: {tokens} • {t("sidebar.cost.apiCalls")}: {calls} • {t("sidebar.cost.files")}:{" "}
        {filesAnalyzed}
      </div>
      <div className="text-[10px] font-mono text-text-muted">
        {t("sidebar.cost.queueWait")}: {queueLabel} • {t("sidebar.cost.scope")}: {scanProfileLabel}
      </div>
    </div>
  );
}

function BaselineSection({
  baselineLoading,
  baselineStatus,
  baselineValid,
  baselineMetrics,
  baselineError,
  baselineView,
  path,
  onSetBaselineNow,
  onClearBaselineNow,
  onBaselineViewChange,
}: {
  baselineLoading: boolean;
  baselineStatus: BaselineStatusView | null;
  baselineValid: boolean;
  baselineMetrics: { active: number; new: number; resolved: number } | null;
  baselineError: string | null;
  baselineView: "all" | "new" | "resolved";
  path: string;
  onSetBaselineNow: () => Promise<void> | void;
  onClearBaselineNow: () => Promise<void> | void;
  onBaselineViewChange: (view: "all" | "new" | "resolved") => void;
}): ReactElement {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
          {t("sidebar.baseline.title")}
        </span>
        <span
          className={clsx(
            "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md border",
            baselineLoading
              ? "bg-[var(--panel-muted)] text-text-muted border-border-main"
              : baselineStatus?.valid
                ? "bg-[color:var(--tone-success-bg)] text-[color:var(--tone-success-text)] border-[color:var(--tone-success-border)]"
                : baselineStatus
                  ? "bg-[color:var(--tone-warning-bg)] text-[color:var(--tone-warning-text)] border-[color:var(--tone-warning-border)]"
                  : "bg-[var(--panel-muted)] text-text-muted border-border-main",
          )}
        >
          {baselineLoading
            ? t("sidebar.baseline.statusLoading")
            : baselineStatus?.valid
              ? t("sidebar.baseline.statusValid")
              : baselineStatus
                ? t("sidebar.baseline.statusInvalid")
                : t("sidebar.baseline.statusNone")}
        </span>
      </div>

      {baselineStatus ? (
        <div className="text-[10px] font-mono text-text-muted space-y-1">
          <div>
            {t("sidebar.baseline.age")}: {baselineStatus.baseline_age_days}d
          </div>
          <div>
            {baselineMetrics
              ? `${baselineMetrics.active} ${t("sidebar.baseline.metricsActive")} • ${baselineMetrics.new} ${t("sidebar.baseline.metricsNew")} • ${baselineMetrics.resolved} ${t("sidebar.baseline.metricsResolved")}`
              : t("sidebar.baseline.loaded")}
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-text-muted">{t("sidebar.baseline.noneSet")}</div>
      )}

      {baselineStatus && !baselineValid && (
        <div className="text-[10px] text-[color:var(--tone-warning-text)]">
          {t("sidebar.baseline.invalidNote")}
        </div>
      )}

      {baselineError && <div className="text-[10px] text-[color:var(--tone-critical-text)]">{baselineError}</div>}

      <div className="flex gap-2">
        <button
          onClick={() => void onSetBaselineNow()}
          disabled={!path || baselineLoading}
          className="flex-1 px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {t("sidebar.baseline.setNow")}
        </button>
        {baselineStatus && (
          <button
            onClick={() => void onClearBaselineNow()}
            disabled={!path || baselineLoading}
            className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] text-text-main rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {t("sidebar.baseline.reset")}
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
                ? "bg-[var(--panel-bg)] text-text-main border-border-main"
                : "bg-transparent text-text-muted border-border-main hover:bg-[var(--panel-muted)]",
            )}
          >
            {t("sidebar.baseline.viewAll")}
          </button>
          <button
            onClick={() => onBaselineViewChange("new")}
            className={clsx(
              "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
              baselineView === "new"
                ? "bg-[color:var(--tone-success-bg)] text-[color:var(--tone-success-text)] border-[color:var(--tone-success-border)]"
                : "bg-transparent text-text-muted border-border-main hover:bg-[var(--panel-muted)]",
            )}
          >
            {t("sidebar.baseline.viewNew")}
          </button>
          <button
            onClick={() => onBaselineViewChange("resolved")}
            className={clsx(
              "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
              baselineView === "resolved"
                ? "bg-[var(--panel-bg)] text-text-main border-border-main"
                : "bg-transparent text-text-muted border-border-main hover:bg-[var(--panel-muted)]",
            )}
          >
            {t("sidebar.baseline.viewResolved")}
          </button>
        </div>
      )}
    </div>
  );
}

function EngineSection({
  engineModel,
  embeddingModeLabel,
  active,
  onOpenEmbeddingSettings,
}: {
  engineModel: string;
  embeddingModeLabel: string;
  active: boolean;
  onOpenEmbeddingSettings: () => void;
}): ReactElement {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Box className="w-3.5 h-3.5 opacity-60" />
        <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">
          {t("sidebar.engine.title")}
        </span>
      </div>
      <p className="text-[10px] text-text-muted leading-relaxed font-mono">
        {t("sidebar.engine.model")}: {engineModel}
      </p>
      <div className="flex items-center justify-between rounded-lg border border-border-main bg-background/60 px-2.5 py-2">
        <span className="text-[10px] text-text-muted flex items-center gap-1.5">
          <DatabaseZap className="w-3.5 h-3.5" />
          {t("sidebar.engine.embedding")}:{" "}
          <span className="text-[var(--text-main)]">{embeddingModeLabel}</span>
        </span>
        <button
          onClick={onOpenEmbeddingSettings}
          className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] rounded-md transition-colors cursor-pointer"
        >
          {t("sidebar.engine.setup")}
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
    <div className="flex items-center gap-2 px-3 border-r border-border-main last:border-r-0 hover:bg-[var(--panel-muted)] transition-colors rounded-md h-8 group cursor-default">
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
