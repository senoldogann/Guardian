import { useState, useEffect, useMemo, useRef, useCallback, type ReactElement } from "react";
import { invoke, openDialog, isTauriRuntime } from "./lib/tauri";
import { exportAuditToPdf } from "./lib/exportAuditPdf";
import { useToast } from "./hooks/useToast";
import { motion, AnimatePresence } from "framer-motion";
import { type AutoPrompt } from "./components/ChatView";
import { Header } from "./components/Header";
import { AuthGate } from "./components/AuthGate";
import { StallOverlay } from "./components/StallOverlay";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { ToastContainer } from "./components/Toast";
import { SettingsModal } from "./components/SettingsModal";
import { useAuth } from "./hooks/useAuth";
import { useSettings } from "./hooks/useSettings";
import { useBaselineController } from "./hooks/useBaselineController";
import { useGuardianEvents } from "./hooks/useGuardianEvents";
import { useMonitoringController } from "./hooks/useMonitoringController";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { ControlSidebar } from "./components/layout/ControlSidebar";
import { MainWorkspace } from "./components/layout/MainWorkspace";
import { useI18n } from "./i18n";
import type {
  ProjectContext,
  Critique,
  AiContextSnapshot,
  FixProposalsSnapshot,
  FixProposal,
  FixHistoryEntry,
  ReleaseDecisionStatus,
  ReleaseDecisionView,
} from "./types";
import { STORAGE_KEYS } from "./constants";
import { critiqueStateKey } from "./lib/critiqueStateKey";

function isSystemLogEntry(key: string, critique: Critique): boolean {
  return key.startsWith("System") || critique.file_path.startsWith("System");
}

function normalizeVersionLabel(version: string | null | undefined): string {
  const trimmed = version?.trim() ?? "";
  if (!trimmed) return "Unknown";
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

function parseStringStorage(raw: string): string {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "string" ? parsed : trimmed;
  } catch {
    return trimmed;
  }
}

function parseBooleanStorage(raw: string): boolean {
  const lowered = raw.trim().toLowerCase();
  if (lowered === "true") return true;
  if (lowered === "false") return false;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "boolean" ? parsed : false;
  } catch {
    return false;
  }
}

function parseThemeStorage(raw: string): "dark" | "light" {
  const parsed = parseStringStorage(raw).toLowerCase();
  return parsed === "light" ? "light" : "dark";
}

type WindowWithLegacyAudio = Window & { webkitAudioContext?: typeof AudioContext };

function App(): ReactElement {
  const { t } = useI18n();
  // Core state
  const [onboardingCompleted, setOnboardingCompleted, onboardingHydrated] = useLocalStorage<boolean>(
    STORAGE_KEYS.ONBOARDING_COMPLETED,
    false,
    { deserialize: parseBooleanStorage }
  );
  const showOnboarding = onboardingHydrated && !onboardingCompleted;
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
  const [pendingGuruPrompt, setPendingGuruPrompt] = useState<AutoPrompt | null>(null);
  const [guruUnreadCount, setGuruUnreadCount] = useState(0);
  const [usage, setUsage] = useState({ tokens: 0, calls: 0, files: 0, queueWaitMs: 0 });
  const [scanProfileLabel, setScanProfileLabel] = useState<string>("source");
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [aiContext, setAiContext] = useState<AiContextSnapshot | null>(null);
  const [aiContextLoading, setAiContextLoading] = useState(false);
  const [aiContextError, setAiContextError] = useState<string | null>(null);
  const [fixProposals, setFixProposals] = useState<FixProposalsSnapshot | null>(null);
  const [fixProposalsLoading, setFixProposalsLoading] = useState(false);
  const [fixProposalsError, setFixProposalsError] = useState<string | null>(null);
  const [fixHistory, setFixHistory] = useState<FixHistoryEntry[]>([]);
  const [fixHistoryLoading, setFixHistoryLoading] = useState(false);
  const [fixHistoryError, setFixHistoryError] = useState<string | null>(null);
  const [releaseDecision, setReleaseDecision] = useState<ReleaseDecisionView | null>(null);
  const [releaseDecisionLoading, setReleaseDecisionLoading] = useState(false);
  const [releaseDecisionError, setReleaseDecisionError] = useState<string | null>(null);
  const [view, setView] = useState<"monitor" | "chat" | "diagram" | "ai-context" | "reviews">("monitor");
  const viewRef = useRef(view);
  const guruReplyAudioRef = useRef<AudioContext | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Theme state
  const [theme, setTheme] = useLocalStorage<"dark" | "light">(STORAGE_KEYS.THEME, "dark", {
    deserialize: parseThemeStorage,
  });

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  // Hooks
  const auth = useAuth();
  const settings = useSettings(exportAuditToPdf, settingsOpen);
  const toast = useToast();

  const scopeLabel = useMemo(() => {
    if (!path) return "";
    const trimmed = path.replace(/[\\/]+$/, "");
    const parts = trimmed.split(/[\\/]/);
    return parts[parts.length - 1] || trimmed;
  }, [path]);

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    let disposed = false;

    const syncWindowTitle = async (): Promise<void> => {
      if (!isTauriRuntime()) {
        document.title = "Guardian";
        return;
      }

      try {
        const rawVersion = await invoke<string>("get_app_version");
        if (disposed) return;
        const title = `Guardian ${normalizeVersionLabel(rawVersion)}`;
        document.title = title;
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        if (disposed) return;
        await getCurrentWindow().setTitle(title);
      } catch {
        if (!disposed) {
          document.title = "Guardian";
        }
      }
    };

    void syncWindowTitle();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const loadProfile = async (): Promise<void> => {
      if (!isTauriRuntime()) return;
      try {
        const res = await invoke<{ profile: string }>("get_scan_profile_config");
        if (!disposed && res?.profile) setScanProfileLabel(res.profile);
      } catch {
        // Ignore: keep default label.
      }
    };
    void loadProfile();
    return () => {
      disposed = true;
    };
  }, []);



  const selectScope = async (): Promise<void> => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Scope Directory"
      });

      if (selected && typeof selected === "string") {
        if (active) {
          try {
            await invoke("stop_monitoring");
          } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            setLogs(prev => ({
              ...prev,
              ["System:Monitoring"]: {
                file_path: "System",
                severity: "Warning",
                message: `Failed to stop monitoring: ${errorMsg}`,
              }
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
        setPendingGuruPrompt(null);
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
      setLogs(prev => ({
        ...prev,
        ["System:Directory"]: {
          file_path: "System",
          severity: "Warning",
          message: `Failed to select directory: ${err instanceof Error ? err.message : String(err)}`
        }
      }));
    }
  };

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
      setLogs(prev => ({
        ...prev,
        ["System:Context"]: {
          file_path: "System",
          severity: "Warning",
          message: `Context scan failed: ${message}`
        }
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

  // Proactive Context Refresh
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
    if (view !== "ai-context") return;
    void refreshAiContext();
  }, [view, refreshAiContext]);

  useEffect(() => {
    if (view !== "reviews") return;
    void refreshFixProposals();
    void refreshFixHistory();
    void refreshReleaseDecision();
  }, [view, refreshFixProposals, refreshFixHistory, refreshReleaseDecision]);

  // Keep Undo availability in sync across tabs (Monitor/Reviews/Guru).
  useEffect(() => {
    if (!path) return;
    void refreshFixHistory();
  }, [path, refreshFixHistory]);

  useEffect(() => {
    if (view === "chat") {
      setGuruUnreadCount(0);
    }
  }, [view]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    return () => {
      const ctx = guruReplyAudioRef.current;
      if (!ctx) return;
      void ctx.close().catch(() => {
        // Ignore audio teardown errors.
      });
      guruReplyAudioRef.current = null;
    };
  }, []);

  const playGuruReplyChime = useCallback((): void => {
    if (typeof window === "undefined") return;
    try {
      const audioCtor =
        window.AudioContext || (window as WindowWithLegacyAudio).webkitAudioContext;
      if (!audioCtor) return;
      const context = guruReplyAudioRef.current ?? new audioCtor();
      guruReplyAudioRef.current = context;

      const schedule = (): void => {
        const start = context.currentTime;

        const masterGain = context.createGain();
        masterGain.gain.setValueAtTime(0.0001, start);
        masterGain.gain.exponentialRampToValueAtTime(0.13, start + 0.02);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
        masterGain.connect(context.destination);

        const playTone = (frequency: number, offset: number, duration: number): void => {
          const toneStart = start + offset;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, toneStart);
          gain.gain.setValueAtTime(0.0001, toneStart);
          gain.gain.exponentialRampToValueAtTime(0.15, toneStart + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + duration);
          oscillator.connect(gain);
          gain.connect(masterGain);
          oscillator.start(toneStart);
          oscillator.stop(toneStart + duration + 0.02);
        };

        playTone(900, 0, 0.18);
        playTone(1320, 0.12, 0.2);
      };

      if (context.state === "suspended") {
        void context.resume().then(schedule).catch(() => {
          // Ignore playback resume failures.
        });
        return;
      }
      schedule();
    } catch {
      // Ignore audio availability/runtime issues.
    }
  }, []);

  const openGuruForStall = useCallback((): void => {
    const prompt = stalled
      ? `Critical violation detected in ${stalled.file}.\nReason: ${stalled.reason}.\n\nPlease propose a safe fix with a clear explanation and the FULL updated file content only (no diff markers, no markdown).`
      : "We are stalled by a critical violation. Please propose a safe fix with the FULL updated file content only (no diff markers, no markdown).";
    setPendingGuruPrompt({ id: `${Date.now()}-${Math.random()}`, prompt, useWebSearch: false });
    setView("chat");
  }, [stalled]);

  const askGuruForLog = useCallback((log: Critique, useWebSearch = false): void => {
    const severity = log.severity.toUpperCase();
    const prompt = `Investigate this ${severity} issue and propose a safe fix with a clear explanation and the FULL updated file content only (no diff markers, no markdown).\n\nFile: ${log.file_path}\nReason: ${log.message}`;
    setPendingGuruPrompt({ id: `${Date.now()}-${Math.random()}`, prompt, useWebSearch });
    setView("chat");
  }, []);

  const handleGuruReply = useCallback((): void => {
    if (viewRef.current === "chat") return;
    setGuruUnreadCount((prev) => Math.min(prev + 1, 99));
    toast.showToast(t("app.guruReplyReady"), "info", 3500);
    if (settings.guruReplySoundEnabled) {
      playGuruReplyChime();
    }
  }, [playGuruReplyChime, settings.guruReplySoundEnabled, t, toast]);

  const toAbsoluteWorkspacePath = useCallback((filePath: string): string => {
    const trimmed = (filePath ?? "").trim();
    if (!trimmed || !path) return trimmed;

    const isWindowsAbs = /^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith("\\\\");
    if (trimmed.startsWith("/") || isWindowsAbs) {
      return trimmed;
    }

    const root = path.replace(/[\\/]+$/, "");
    const rel = trimmed.replace(/^[\\/]+/, "");
    return `${root}/${rel}`;
  }, [path]);

  const requestReviewForProposal = useCallback(async (proposal: FixProposal): Promise<void> => {
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
      setView("chat");
    } catch (e) {
      toast.showError(t("app.requestReviewFailed", { error: e instanceof Error ? e.message : String(e) }));
    }
  }, [path, t, toast, toAbsoluteWorkspacePath]);

  const setProposalStatus = useCallback(async (proposalId: string, status: string): Promise<void> => {
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
      toast.showError(t("app.updateProposalFailed", { error: e instanceof Error ? e.message : String(e) }));
    }
  }, [path, t, toast]);

  const undoAppliedFix = useCallback(async (filePath: string): Promise<void> => {
    if (!path) {
      toast.showWarning(t("app.selectWorkspaceFirst"));
      return;
    }
    try {
      await invoke("undo_fix", { filePath, root: path });
      toast.showSuccess(t("app.undoComplete"), 3000);
      void refreshFixHistory();
    } catch (e) {
      toast.showError(t("app.undoFailed", { error: e instanceof Error ? e.message : String(e) }));
    }
  }, [path, refreshFixHistory, t, toast]);

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

  const visibleLogs = useMemo((): Critique[] => {
    const entries = Object.values(logs);
    return entries.filter(entry => entry.severity !== "Info");
  }, [logs]);

  const {
    baselineStatus,
    baselineLoading,
    baselineError,
    baselineView,
    setBaselineView,
    setBaselineNow,
    clearBaselineNow,
    baselineValid,
    baselineIds,
    baselineMetrics,
    resolvedFindings,
  } = useBaselineController(path, visibleLogs, filter);

  const filteredLogs = useMemo((): Critique[] => {
    const severityRank: Record<string, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };

    const isNew = (log: Critique): boolean => {
      if (!baselineValid) return false;
      if (!log.finding_id) return true;
      return !baselineIds.has(log.finding_id);
    };

    let entries = visibleLogs;
    if (baselineView === "new" && baselineValid) {
      entries = entries.filter((l) => {
        if (!l.finding_id) return true;
        return !baselineIds.has(l.finding_id);
      });
    }

    if (filter) {
      const q = filter.toLowerCase();
      entries = entries.filter((l) =>
        l.file_path.toLowerCase().includes(q) || l.message.toLowerCase().includes(q)
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
  }, [visibleLogs, filter, baselineView, baselineValid, baselineIds]);

  const stats = useMemo(() => {
    const vals = visibleLogs;
    return {
      critical: vals.filter(v => v.severity.toLowerCase() === "critical").length,
      warning: vals.filter(v => v.severity.toLowerCase() === "warning").length,
      info: vals.filter(v => v.severity.toLowerCase() === "info").length,
      total: vals.length
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
  const hasReviewData = Boolean((fixProposals?.proposals?.length ?? 0) > 0 || fixHistory.length > 0);

  const engineModel = settings.providerDraft?.model?.trim() || t("app.notSet");
  const isDesktop = isTauriRuntime();
  const showFloatingFilter =
    !isDesktop || active || baselineView === "resolved" || filter.trim().length > 0;
  const embeddingModeLabel = useMemo(() => {
    const mode = settings.embeddingDraft?.mode ?? "auto";
    if (mode === "openai") return "OpenAI";
    if (mode === "ollama") return "Ollama";
    if (mode === "local") return "Local Hash";
    return "Auto";
  }, [settings.embeddingDraft?.mode]);
  const { launchGate, canToggleMonitoring, toggleMonitoring } = useMonitoringController({
    active,
    path,
    auth,
    settings,
    setLogs,
    setActive,
    setStatus,
    setSettingsOpen,
    refreshMonitorCritiques,
  });

  return (
    <div className="guardian-shell flex h-screen w-full bg-background text-text-main flex-col font-sans overflow-hidden transition-colors duration-300">
      <ToastContainer />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeToggle={toggleTheme}
        isDesktop={true}
        providerProps={{
          providerDraft: settings.providerDraft,
          providerError: settings.providerError,
          providerSaving: settings.providerSaving,
          providerModels: settings.providerModels,
          providerModelLoading: settings.providerModelLoading,
          providerModelError: settings.providerModelError,
          providerTestLoading: settings.providerTestLoading,
          providerTestMessage: settings.providerTestMessage,
          providerTestError: settings.providerTestError,
          onProviderChange: settings.onProviderChange,
          onBaseUrlChange: settings.onBaseUrlChange,
          onModelChange: settings.onModelChange,
          onRefreshModels: () => settings.refreshProviderModels(true, false, undefined, true),
          onSaveProvider: settings.saveProviderSettings,
          onTestProviderConnection: settings.testProviderConnection,
          apiKeyStatus: settings.apiKeyStatus,
          apiKeyInput: settings.apiKeyInput,
          apiKeyError: settings.apiKeyError,
          apiKeySaving: settings.apiKeySaving,
          onApiKeyFocus: settings.onApiKeyFocus,
          onApiKeyChange: settings.onApiKeyChange,
          onSaveApiKey: settings.saveApiKey,
          onClearApiKey: settings.clearApiKey,
        }}
        webProps={{
          tavilyKeyStatus: settings.tavilyKeyStatus,
          tavilyKeyInput: settings.tavilyKeyInput,
          tavilyKeyMasked: settings.tavilyKeyMasked,
          tavilyKeyError: settings.tavilyKeyError,
          tavilyKeySaving: settings.tavilyKeySaving,
          webSearchEnabled: settings.webSearchEnabled,
          webSearchDepth: settings.webSearchDepth,
          webSearchReady: settings.webSearchReady,
          onWebSearchToggle: settings.onWebSearchToggle,
          onWebSearchDepthChange: settings.onWebSearchDepthChange,
          autoVerifyEnabled: settings.autoVerifyEnabled,
          onAutoVerifyToggle: settings.onAutoVerifyToggle,
          guruReplySoundEnabled: settings.guruReplySoundEnabled,
          onGuruReplySoundToggle: settings.onGuruReplySoundToggle,
          scanProfile: settings.scanProfile,
          scanProfileSaving: settings.scanProfileSaving,
          scanProfileError: settings.scanProfileError,
          onScanProfileChange: (value) => settings.setScanProfile(value),
          onSaveScanProfile: async () => {
            await settings.saveScanProfile();
            try {
              const res = await invoke<{ profile: string }>("get_scan_profile_config");
              if (res?.profile) setScanProfileLabel(res.profile);
            } catch {
              // Ignore: keep last label.
            }
          },
          onTavilyKeyFocus: settings.onTavilyKeyFocus,
          onTavilyKeyChange: settings.onTavilyKeyChange,
          onSaveTavilyKey: settings.saveTavilyKey,
          onClearTavilyKey: settings.clearTavilyKey,
        }}
        embeddingProps={{
          embeddingDraft: settings.embeddingDraft,
          embeddingError: settings.embeddingError,
          embeddingSaving: settings.embeddingSaving,
          embeddingOpenAiKeyStatus: settings.embeddingOpenAiKeyStatus,
          embeddingOpenAiKeyInput: settings.embeddingOpenAiKeyInput,
          embeddingOpenAiKeyMasked: settings.embeddingOpenAiKeyMasked,
          embeddingOpenAiKeyError: settings.embeddingOpenAiKeyError,
          embeddingOpenAiKeySaving: settings.embeddingOpenAiKeySaving,
          onEmbeddingModeChange: settings.onEmbeddingModeChange,
          onEmbeddingOpenAiBaseUrlChange: settings.onEmbeddingOpenAiBaseUrlChange,
          onEmbeddingOllamaBaseUrlChange: settings.onEmbeddingOllamaBaseUrlChange,
          onEmbeddingOpenAiModelChange: settings.onEmbeddingOpenAiModelChange,
          onEmbeddingOllamaModelChange: settings.onEmbeddingOllamaModelChange,
          onSaveEmbeddingSettings: settings.saveEmbeddingSettings,
          onRefreshEmbeddingSettings: settings.refreshEmbeddingSettings,
          onEmbeddingOpenAiKeyFocus: settings.onEmbeddingOpenAiKeyFocus,
          onEmbeddingOpenAiKeyChange: settings.onEmbeddingOpenAiKeyChange,
          onSaveEmbeddingOpenAiKey: settings.saveEmbeddingOpenAiKey,
          onClearEmbeddingOpenAiKey: settings.clearEmbeddingOpenAiKey,
        }}
        updateProps={{
          updateInfo: settings.updateInfo,
          updateChecking: settings.updateChecking,
          updateInstalling: settings.updateInstalling,
          updateError: settings.updateError,
          onCheckUpdates: settings.checkForUpdates,
          onInstallUpdate: settings.installUpdate,
        }}
        onExportPDF={() => settings.onExportPDF(logs, path)}
        exportPdfInProgress={settings.exportPdfInProgress}
        exportPdfMessage={settings.exportPdfMessage}
        exportPdfError={settings.exportPdfError}
        settingsTab={settings.settingsTab}
        onSettingsTabChange={settings.setSettingsTab}
      />
      <StallOverlay
        key={stallSignature}
        stalled={stalled}
        open={stallOverlayOpen}
        onResolve={() => {
          openGuruForStall();
          setStallOverlayOpen(false);
        }}
        onDismiss={() => setStallOverlayOpen(false)}
      />

      {showOnboarding && (
        <OnboardingWizard onComplete={() => setOnboardingCompleted(true)} />
      )}

      <AuthGate
        authDevice={auth.authDevice}
        authLoading={auth.authLoading}
        authError={auth.authError}
        authWarning={auth.authWarning}
        authCountdown={auth.authCountdown}
        authSession={auth.authSession}
        isDesktop={true}
        showAuthGate={auth.showAuthGate}
        onStartLogin={auth.startGithubLogin}
        onCompleteLogin={auth.completeGithubLogin}
        onCancel={auth.cancelGithubLogin}
      />

      <Header
        active={active}
        stats={stats}
        usage={usage}
        authSession={auth.authSession}
        isDesktop={true}
        authLoading={auth.authLoading}
        onLogout={auth.logoutGithub}
        onSettingsClick={() => setSettingsOpen(true)}
      />




      <AnimatePresence>
        {settings.updateInfo?.status === "available" && !settings.updateDismissed && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-2 pr-2 rounded-full border border-border-main bg-surface/95 backdrop-blur-md shadow-xl shadow-black/10 text-text-main"
          >
            <div className="flex flex-col pl-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--accent-500)]">
                {t("app.updateAvailable")}
              </span>
              <span className="text-xs font-medium opacity-80 text-text-main">
                {t("app.updateReady", { version: normalizeVersionLabel(settings.updateInfo.latest_version) })}
              </span>
            </div>

            <div className="h-6 w-px bg-border-main mx-1" />

            <div className="flex items-center gap-1">
              <button
                onClick={() => settings.setUpdateDismissed(true)}
                className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-main hover:bg-[var(--panel-muted)] rounded-full transition-colors"
              >
                {t("app.later")}
              </button>
              <button
                onClick={settings.installUpdate}
                disabled={settings.updateInstalling}
                className="px-4 py-1.5 text-xs font-bold text-background bg-[var(--accent-500)] hover:opacity-90 active:scale-95 rounded-full transition-all shadow-lg shadow-black/20 disabled:opacity-50 disabled:pointer-events-none"
              >
                {settings.updateInstalling ? t("app.updating") : t("app.updateNow")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {settings.updateChecking && !settings.updateInfo && !settings.updateDismissed && (
        <div className="px-6 py-1 text-[10px] text-text-muted flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-border-main animate-pulse" />
          {t("app.checkingUpdates")}
        </div>
      )}

      {settings.updateError && !settings.updateDismissed && (
        <div className="px-6 py-1 text-[10px] text-rose-400 bg-transparent">
          {settings.updateError}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        <div className="min-h-0 flex">
          <ControlSidebar
            view={view}
            onViewChange={setView}
            hasAiContextData={hasAiContextData}
            hasReviewData={hasReviewData}
            pendingFixProposalsCount={pendingFixProposalsCount}
            guruUnreadCount={guruUnreadCount}
            totalFiles={context?.total_files || 0}
            totalIssues={stats.total}
            scopeLabel={scopeLabel}
            onSelectScope={selectScope}
            tokens={usage.tokens}
            calls={usage.calls}
            filesAnalyzed={usage.files}
            queueWaitMs={usage.queueWaitMs}
            scanProfileLabel={scanProfileLabel}
            baselineLoading={baselineLoading}
            baselineStatus={baselineStatus}
            baselineValid={baselineValid}
            baselineMetrics={baselineMetrics}
            baselineError={baselineError}
            baselineView={baselineView}
            onSetBaselineNow={setBaselineNow}
            onClearBaselineNow={clearBaselineNow}
            onBaselineViewChange={setBaselineView}
            path={path}
            engineModel={engineModel}
            embeddingModeLabel={embeddingModeLabel}
            onOpenEmbeddingSettings={() => {
              settings.setSettingsTab("embedding");
              setSettingsOpen(true);
            }}
            authBannerVisible={auth.authGateVisible}
            authShowGate={auth.showAuthGate}
            authRequiresVerified={auth.requiresVerified}
            authLoading={auth.authLoading}
            authError={auth.authError}
            authWarning={auth.authWarning}
            onVerifyAuth={auth.refreshAuthSession}
            settingsRequiresApiKey={settings.requiresApiKey}
            providerLabel={settings.providerLabel}
            onOpenSettings={() => setSettingsOpen(true)}
            active={active}
            canToggleMonitoring={canToggleMonitoring}
            onToggleMonitoring={toggleMonitoring}
            launchBlockingReason={launchGate.blockingReason}
          />
        </div>

        <MainWorkspace
          view={view}
          active={active}
          status={status}
          showFloatingFilter={showFloatingFilter}
          filter={filter}
          onFilterChange={setFilter}
          baselineView={baselineView}
          baselineStatus={baselineStatus}
          baselineValid={baselineValid}
          resolvedFindings={resolvedFindings}
          filteredLogs={filteredLogs}
          baselineIds={baselineIds}
          expandedLogKey={expandedLogKey}
          onToggleLog={(key) => setExpandedLogKey((prev) => (prev === key ? null : key))}
          onAskGuruForLog={askGuruForLog}
          path={path}
          onSelectScope={selectScope}
          chatAutoPrompt={pendingGuruPrompt}
          onAutoPromptConsumed={() => setPendingGuruPrompt(null)}
          onGuruReply={handleGuruReply}
          webSearchEnabled={settings.webSearchEnabled}
          webSearchDepth={settings.webSearchDepth}
          onWebSearchToggle={settings.onWebSearchToggle}
          webSearchReady={settings.webSearchReady}
          fixProposals={fixProposals}
          fixProposalsLoading={fixProposalsLoading}
          fixProposalsError={fixProposalsError}
          onRequestReview={requestReviewForProposal}
          onSetProposalStatus={setProposalStatus}
          fixHistory={fixHistory}
          fixHistoryLoading={fixHistoryLoading}
          fixHistoryError={fixHistoryError}
          onRefreshFixHistory={refreshFixHistory}
          onUndoFix={undoAppliedFix}
          releaseDecision={releaseDecision}
          releaseDecisionLoading={releaseDecisionLoading}
          releaseDecisionError={releaseDecisionError}
          onRefreshReleaseDecision={refreshReleaseDecision}
          onSetReleaseDecision={setReleaseDecisionFromUi}
          onOverrideReleaseDecision={overrideReleaseDecision}
          aiContext={aiContext}
          aiContextLoading={aiContextLoading}
          aiContextError={aiContextError}
          onRefreshAiContext={refreshAiContext}
          onRefreshContext={refreshContext}
          contextLoading={contextLoading}
          contextError={contextError}
          context={context}
          scopeLabel={scopeLabel}
        />
      </div>
    </div>
  );
}

export default App;
