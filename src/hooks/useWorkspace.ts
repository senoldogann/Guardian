import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke, openDialog, isTauriRuntime } from "../lib/tauri";
import { useLocalStorage } from "./useLocalStorage";
import { useGuardianEvents } from "./useGuardianEvents";
import { useBaselineController } from "./useBaselineController";
import { useToast } from "./useToast";
import { useI18n } from "../i18n";
import { critiqueStateKey } from "../lib/critiqueStateKey";
import { STORAGE_KEYS } from "../constants";
import type {
  ProjectContext,
  Critique,
  AiContextSnapshot,
  FixProposalsSnapshot,
  FixProposal,
  FixHistoryEntry,
  ReleaseDecisionStatus,
  ReleaseDecisionView,
  Stats,
} from "../types";
import type { BaselineControllerState } from "./useBaselineController";

// ── Helpers ────────────────────────────────────────────────────

function parseStringStorage(raw: string): string {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "string" ? parsed : trimmed;
  } catch {
    return trimmed;
  }
}

function isSystemLogEntry(key: string, critique: Critique): boolean {
  return key.startsWith("System") || critique.file_path.startsWith("System");
}

// ── Types ──────────────────────────────────────────────────────

export interface UseWorkspaceReturn extends BaselineControllerState {
  // Core state
  active: boolean;
  logs: Record<string, Critique>;
  status: string;
  path: string;
  setPath: (val: string | ((prev: string) => string)) => void;
  filter: string;
  setFilter: (val: string) => void;
  expandedLogKey: string | null;
  setExpandedLogKey: (val: string | null | ((prev: string | null) => string | null)) => void;
  stalled: { file: string; reason: string } | null;
  stallOverlayOpen: boolean;
  setStallOverlayOpen: (val: boolean) => void;
  stallSignature: string;
  scopeLabel: string;
  usage: { tokens: number; calls: number; files: number; queueWaitMs: number };
  scanProfileLabel: string;

  // Context
  context: ProjectContext | null;
  contextLoading: boolean;
  contextError: string | null;

  // AI Context
  aiContext: AiContextSnapshot | null;
  aiContextLoading: boolean;
  aiContextError: string | null;

  // Fix Proposals
  fixProposals: FixProposalsSnapshot | null;
  fixProposalsLoading: boolean;
  fixProposalsError: string | null;

  // Fix History
  fixHistory: FixHistoryEntry[];
  fixHistoryLoading: boolean;
  fixHistoryError: string | null;

  // Release Decision
  releaseDecision: ReleaseDecisionView | null;
  releaseDecisionLoading: boolean;
  releaseDecisionError: string | null;

  // Computed
  visibleLogs: Critique[];
  filteredLogs: Critique[];
  stats: Stats;
  pendingFixProposalsCount: number;
  hasAiContextData: boolean;
  hasReviewData: boolean;

  // Actions
  selectScope: () => Promise<void>;
  refreshContext: () => Promise<void>;
  refreshMonitorCritiques: () => Promise<void>;
  refreshScanProfile: () => Promise<void>;
  refreshAiContext: () => Promise<void>;
  refreshFixProposals: () => Promise<void>;
  refreshFixHistory: () => Promise<void>;
  refreshReleaseDecision: () => Promise<void>;
  requestReviewForProposal: (proposal: FixProposal) => Promise<void>;
  setProposalStatus: (proposalId: string, status: string) => Promise<void>;
  undoAppliedFix: (filePath: string) => Promise<void>;
  setReleaseDecisionFromUi: (
    decision: Exclude<ReleaseDecisionStatus, "OVERRIDDEN">,
    approver: string,
    reason?: string,
  ) => Promise<void>;
  overrideReleaseDecision: (approver: string, reason: string) => Promise<void>;

  // Setters needed by useMonitoringController
  setLogs: React.Dispatch<React.SetStateAction<Record<string, Critique>>>;
  setActive: React.Dispatch<React.SetStateAction<boolean>>;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
}

// ── Hook ───────────────────────────────────────────────────────

export function useWorkspace(): UseWorkspaceReturn {
  const { t } = useI18n();
  const toast = useToast();

  // Core state
  const [active, setActive] = useState(false);
  const [logs, setLogs] = useState<Record<string, Critique>>({});
  const [status, setStatus] = useState("Idle");
  const [path, setPath] = useLocalStorage<string>(STORAGE_KEYS.LAST_PATH, "", {
    deserialize: parseStringStorage,
  });
  const [filter, setFilter] = useState<string>("");
  const [expandedLogKey, setExpandedLogKey] = useState<string | null>(null);
  const [stalled, setStalled] = useState<{ file: string; reason: string } | null>(null);
  const [stallOverlayOpen, setStallOverlayOpen] = useState(false);
  const stallSignatureRef = useRef<string | null>(null);
  const stallSignature = stallSignatureRef.current ?? "";
  const [usage, setUsage] = useState({ tokens: 0, calls: 0, files: 0, queueWaitMs: 0 });
  const [scanProfileLabel, setScanProfileLabel] = useState<string>("source");
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  // AI Context
  const [aiContext, setAiContext] = useState<AiContextSnapshot | null>(null);
  const [aiContextLoading, setAiContextLoading] = useState(false);
  const [aiContextError, setAiContextError] = useState<string | null>(null);

  // Fix Proposals
  const [fixProposals, setFixProposals] = useState<FixProposalsSnapshot | null>(null);
  const [fixProposalsLoading, setFixProposalsLoading] = useState(false);
  const [fixProposalsError, setFixProposalsError] = useState<string | null>(null);

  // Fix History
  const [fixHistory, setFixHistory] = useState<FixHistoryEntry[]>([]);
  const [fixHistoryLoading, setFixHistoryLoading] = useState(false);
  const [fixHistoryError, setFixHistoryError] = useState<string | null>(null);

  // Release Decision
  const [releaseDecision, setReleaseDecision] = useState<ReleaseDecisionView | null>(null);
  const [releaseDecisionLoading, setReleaseDecisionLoading] = useState(false);
  const [releaseDecisionError, setReleaseDecisionError] = useState<string | null>(null);

  // Scope label
  const scopeLabel = useMemo(() => {
    if (!path) return "";
    const trimmed = path.replace(/[\\/]+$/, "");
    const parts = trimmed.split(/[\\/]/);
    return parts[parts.length - 1] || trimmed;
  }, [path]);

  // Load scan profile
  const refreshScanProfile = useCallback(async (): Promise<void> => {
    if (!isTauriRuntime()) return;
    try {
      const res = await invoke<{ profile: string }>("get_scan_profile_config");
      if (res?.profile) setScanProfileLabel(res.profile);
    } catch {
      // Ignore: keep default label.
    }
  }, []);

  useEffect(() => {
    void refreshScanProfile();
  }, [refreshScanProfile]);

  // Guardian Events
  useGuardianEvents({
    setLogs,
    setStatus,
    setStalled,
    setStallOverlayOpen,
    stallSignatureRef,
    setUsage,
    setAiContext,
    setAiContextError,
    setFixProposals,
    setFixProposalsError,
  });

  // ── Scope selection ──────────────────────────────────────────

  const selectScope = useCallback(async (): Promise<void> => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Scope Directory",
      });

      if (selected && typeof selected === "string") {
        if (active) {
          try {
            await invoke("stop_monitoring");
          } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            setLogs((prev) => ({
              ...prev,
              ["System:Monitoring"]: {
                file_path: "System",
                severity: "Warning",
                message: `Failed to stop monitoring: ${errorMsg}`,
              },
            }));
          }
        }
        setActive(false);
        setStatus("Idle");
        setLogs({});
        setExpandedLogKey(null);
        setStalled(null);
        setStallOverlayOpen(false);
        stallSignatureRef.current = null;
        setContext(null);
        setContextError(null);
        setAiContext(null);
        setAiContextError(null);
        setFixProposals(null);
        setFixProposalsError(null);
        setReleaseDecision(null);
        setReleaseDecisionError(null);
        setFilter("");
        setPath(selected);
      }
    } catch (err) {
      setLogs((prev) => ({
        ...prev,
        ["System:Directory"]: {
          file_path: "System",
          severity: "Warning",
          message: `Failed to select directory: ${err instanceof Error ? err.message : String(err)}`,
        },
      }));
    }
  }, [active, path]);

  // ── Refresh functions ────────────────────────────────────────

  const refreshContext = useCallback(async (): Promise<void> => {
    if (!path) {
      setContext(null);
      setContextError(null);
      return;
    }
    setContextLoading(true);
    setContextError(null);
    try {
      const ctx = await invoke<ProjectContext>("get_project_context", { path });
      setContext(ctx);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setContext(null);
      setContextError(message);
      setLogs((prev) => ({
        ...prev,
        ["System:Context"]: {
          file_path: "System",
          severity: "Warning",
          message: `Context scan failed: ${message}`,
        },
      }));
    } finally {
      setContextLoading(false);
    }
  }, [path]);

  const refreshMonitorCritiques = useCallback(async (): Promise<void> => {
    if (!path) return;
    try {
      const critiques = await invoke<Critique[]>("get_monitor_critiques", { root: path });
      const monitorCritiques = Array.isArray(critiques) ? critiques : [];
      setLogs((prev) => {
        const next: Record<string, Critique> = {};
        for (const [key, critique] of Object.entries(prev)) {
          if (isSystemLogEntry(key, critique)) {
            next[key] = critique;
          }
        }
        for (const critique of monitorCritiques) {
          next[critiqueStateKey(critique)] = critique;
        }
        return next;
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setLogs((prev) => ({
        ...prev,
        ["System:MonitorSync"]: {
          file_path: "System",
          severity: "Warning",
          message: `Monitor snapshot sync failed: ${message}`,
        },
      }));
    }
  }, [path]);

  const refreshAiContext = useCallback(async (): Promise<void> => {
    if (!path) {
      setAiContext(null);
      setAiContextError(null);
      return;
    }
    setAiContextLoading(true);
    setAiContextError(null);
    try {
      const value = await invoke<AiContextSnapshot | null>("get_last_ai_context", { root: path });
      setAiContext(value ?? null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setAiContext(null);
      setAiContextError(message);
    } finally {
      setAiContextLoading(false);
    }
  }, [path]);

  const refreshFixProposals = useCallback(async (): Promise<void> => {
    if (!path) {
      setFixProposals(null);
      setFixProposalsError(null);
      return;
    }
    setFixProposalsLoading(true);
    setFixProposalsError(null);
    try {
      const value = await invoke<FixProposalsSnapshot>("get_fix_proposals", { root: path });
      setFixProposals(value ?? null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setFixProposals(null);
      setFixProposalsError(message);
    } finally {
      setFixProposalsLoading(false);
    }
  }, [path]);

  const refreshFixHistory = useCallback(async (): Promise<void> => {
    if (!path) {
      setFixHistory([]);
      setFixHistoryError(null);
      return;
    }
    setFixHistoryLoading(true);
    setFixHistoryError(null);
    try {
      const value = await invoke<FixHistoryEntry[]>("get_fix_history", { root: path });
      setFixHistory(Array.isArray(value) ? value : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setFixHistory([]);
      setFixHistoryError(message);
    } finally {
      setFixHistoryLoading(false);
    }
  }, [path]);

  const refreshReleaseDecision = useCallback(async (): Promise<void> => {
    if (!path) {
      setReleaseDecision(null);
      setReleaseDecisionError(null);
      return;
    }
    setReleaseDecisionLoading(true);
    setReleaseDecisionError(null);
    try {
      const value = await invoke<ReleaseDecisionView>("get_release_decision", { root: path });
      setReleaseDecision(value ?? null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setReleaseDecision(null);
      setReleaseDecisionError(message);
    } finally {
      setReleaseDecisionLoading(false);
    }
  }, [path]);

  // ── Proactive refreshes ──────────────────────────────────────

  useEffect(() => {
    void refreshContext();
  }, [refreshContext]);

  useEffect(() => {
    void refreshMonitorCritiques();
  }, [refreshMonitorCritiques]);

  useEffect(() => {
    setExpandedLogKey((prev) => (prev && logs[prev] ? prev : null));
  }, [logs]);

  useEffect(() => {
    if (!path) return;
    void refreshFixHistory();
  }, [path, refreshFixHistory]);

  // ── Action callbacks ─────────────────────────────────────────

  const toAbsoluteWorkspacePath = useCallback(
    (filePath: string): string => {
      const trimmed = (filePath ?? "").trim();
      if (!trimmed || !path) return trimmed;
      const isWindowsAbs = /^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith("\\\\");
      if (trimmed.startsWith("/") || isWindowsAbs) return trimmed;
      const root = path.replace(/[\\/]+$/, "");
      const rel = trimmed.replace(/^[\\/]+/, "");
      return `${root}/${rel}`;
    },
    [path],
  );

  const requestReviewForProposal = useCallback(
    async (proposal: FixProposal): Promise<void> => {
      if (!path) {
        toast.showWarning(t("app.selectWorkspaceFirst"));
        return;
      }
      const content = proposal.proposed_content ?? "";
      if (!content.trim()) {
        toast.showError(t("app.proposalMissingContent"));
        return;
      }
      const absPath = toAbsoluteWorkspacePath(proposal.file_path);
      try {
        await invoke("apply_fix", { filePath: absPath, newContent: content });
        const updated = await invoke<FixProposalsSnapshot>("set_fix_proposal_status", {
          root: path,
          proposalId: proposal.proposal_id,
          status: "review_requested",
          note: null,
        });
        setFixProposals(updated ?? null);
        toast.showSuccess(t("app.reviewRequested"));
      } catch (e) {
        toast.showError(
          t("app.requestReviewFailed", { error: e instanceof Error ? e.message : String(e) }),
        );
      }
    },
    [path, t, toast, toAbsoluteWorkspacePath],
  );

  const setProposalStatus = useCallback(
    async (proposalId: string, status: string): Promise<void> => {
      if (!path) {
        toast.showWarning(t("app.selectWorkspaceFirst"));
        return;
      }
      try {
        const updated = await invoke<FixProposalsSnapshot>("set_fix_proposal_status", {
          root: path,
          proposalId,
          status,
          note: null,
        });
        setFixProposals(updated ?? null);
        toast.showSuccess(t("app.proposalMarked", { status }));
      } catch (e) {
        toast.showError(
          t("app.updateProposalFailed", { error: e instanceof Error ? e.message : String(e) }),
        );
      }
    },
    [path, t, toast],
  );

  const undoAppliedFix = useCallback(
    async (filePath: string): Promise<void> => {
      if (!path) {
        toast.showWarning(t("app.selectWorkspaceFirst"));
        return;
      }
      try {
        await invoke("undo_fix", { filePath, root: path });
        toast.showSuccess(t("app.undoComplete"), 3000);
        void refreshFixHistory();
      } catch (e) {
        toast.showError(
          t("app.undoFailed", { error: e instanceof Error ? e.message : String(e) }),
        );
      }
    },
    [path, refreshFixHistory, t, toast],
  );

  const setReleaseDecisionFromUi = useCallback(
    async (
      decision: Exclude<ReleaseDecisionStatus, "OVERRIDDEN">,
      approver: string,
      reason?: string,
    ): Promise<void> => {
      if (!path) {
        toast.showWarning(t("app.selectWorkspaceFirst"));
        return;
      }
      try {
        const value = await invoke<ReleaseDecisionView>("set_release_decision", {
          root: path,
          decision,
          approver,
          reason: reason ?? null,
        });
        setReleaseDecision(value ?? null);
        setReleaseDecisionError(null);
        toast.showSuccess(t("app.releaseDecisionUpdated"));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setReleaseDecisionError(message);
        toast.showError(t("app.releaseDecisionUpdateFailed", { error: message }));
      }
    },
    [path, t, toast],
  );

  const overrideReleaseDecision = useCallback(
    async (approver: string, reason: string): Promise<void> => {
      if (!path) {
        toast.showWarning(t("app.selectWorkspaceFirst"));
        return;
      }
      try {
        const value = await invoke<ReleaseDecisionView>("override_release_block", {
          root: path,
          approver,
          reason,
        });
        setReleaseDecision(value ?? null);
        setReleaseDecisionError(null);
        toast.showSuccess(t("app.releaseBlockOverridden"));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setReleaseDecisionError(message);
        toast.showError(t("app.releaseOverrideFailed", { error: message }));
      }
    },
    [path, t, toast],
  );

  // ── Computed values ──────────────────────────────────────────

  const visibleLogs = useMemo((): Critique[] => {
    const entries = Object.values(logs);
    return entries.filter((entry) => entry.severity !== "Info");
  }, [logs]);

  const baseline = useBaselineController(path, visibleLogs, filter);

  const filteredLogs = useMemo((): Critique[] => {
    const severityRank: Record<string, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };

    const isNew = (log: Critique): boolean => {
      if (!baseline.baselineValid) return false;
      if (!log.finding_id) return true;
      return !baseline.baselineIds.has(log.finding_id);
    };

    let entries = visibleLogs;
    if (baseline.baselineView === "new" && baseline.baselineValid) {
      entries = entries.filter((l) => {
        if (!l.finding_id) return true;
        return !baseline.baselineIds.has(l.finding_id);
      });
    }

    if (filter) {
      const q = filter.toLowerCase();
      entries = entries.filter(
        (l) =>
          l.file_path.toLowerCase().includes(q) || l.message.toLowerCase().includes(q),
      );
    }

    return [...entries].sort((a, b) => {
      const aNew = isNew(a) ? 0 : 1;
      const bNew = isNew(b) ? 0 : 1;
      if (aNew !== bNew) return aNew - bNew;
      const aSev = severityRank[a.severity.toLowerCase()] ?? 9;
      const bSev = severityRank[b.severity.toLowerCase()] ?? 9;
      if (aSev !== bSev) return aSev - bSev;
      return a.file_path.localeCompare(b.file_path);
    });
  }, [visibleLogs, filter, baseline.baselineView, baseline.baselineValid, baseline.baselineIds]);

  const stats = useMemo((): Stats => {
    const vals = visibleLogs;
    return {
      critical: vals.filter((v) => v.severity.toLowerCase() === "critical").length,
      warning: vals.filter((v) => v.severity.toLowerCase() === "warning").length,
      info: vals.filter((v) => v.severity.toLowerCase() === "info").length,
      total: vals.length,
    };
  }, [visibleLogs]);

  const pendingFixProposalsCount = useMemo(() => {
    const proposals = fixProposals?.proposals ?? [];
    return proposals.filter((p) => {
      const s = (p.status || "").toLowerCase();
      return s !== "rejected" && s !== "applied";
    }).length;
  }, [fixProposals]);

  const hasAiContextData = Boolean(aiContext && aiContext.files.length > 0);
  const hasReviewData = Boolean(
    (fixProposals?.proposals?.length ?? 0) > 0 || fixHistory.length > 0,
  );

  return {
    // Core state
    active,
    logs,
    status,
    path,
    setPath,
    filter,
    setFilter,
    expandedLogKey,
    setExpandedLogKey,
    stalled,
    stallOverlayOpen,
    setStallOverlayOpen,
    stallSignature,
    scopeLabel,
    usage,
    scanProfileLabel,

    // Context
    context,
    contextLoading,
    contextError,

    // AI Context
    aiContext,
    aiContextLoading,
    aiContextError,

    // Fix Proposals
    fixProposals,
    fixProposalsLoading,
    fixProposalsError,

    // Fix History
    fixHistory,
    fixHistoryLoading,
    fixHistoryError,

    // Release Decision
    releaseDecision,
    releaseDecisionLoading,
    releaseDecisionError,

    // Baseline (spread)
    ...baseline,

    // Computed
    visibleLogs,
    filteredLogs,
    stats,
    pendingFixProposalsCount,
    hasAiContextData,
    hasReviewData,

    // Actions
    selectScope,
    refreshContext,
    refreshMonitorCritiques,
    refreshScanProfile,
    refreshAiContext,
    refreshFixProposals,
    refreshFixHistory,
    refreshReleaseDecision,
    requestReviewForProposal,
    setProposalStatus,
    undoAppliedFix,
    setReleaseDecisionFromUi,
    overrideReleaseDecision,

    // Setters for useMonitoringController
    setLogs,
    setActive,
    setStatus,
  };
}
