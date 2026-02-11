import { useState, useEffect, useMemo, useRef, useCallback, type ReactElement } from "react";
import { invoke, listen, openDialog, isTauriRuntime, type UnlistenFn } from "./lib/tauri";
import { exportAuditToPdf } from "./lib/exportAuditPdf";
import { handleError } from "./lib/error";
import { useToast } from "./hooks/useToast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Play,
  Square,
  Activity,
  Folder,
  Search,
  CheckCircle2,
  AlertCircle,
  Box,
  MessageSquare,
  Files,
  Share2,
  Eye,
  EyeOff,
  ClipboardCheck,
  ClipboardList,
  DatabaseZap,
} from "lucide-react";
import clsx from "clsx";
import { CritiqueAccordionRow } from "./components/CritiqueAccordionRow";
import { ChatView, type AutoPrompt } from "./components/ChatView";
import DiagramView from "./components/DiagramView";
import { Header } from "./components/Header";
import { AuthGate } from "./components/AuthGate";
import { StallOverlay } from "./components/StallOverlay";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { ToastContainer } from "./components/Toast";
import { SettingsModal } from "./components/SettingsModal";
import { AIContextPreview } from "./components/AIContextPreview";
import { FixProposalsView } from "./components/FixProposalsView";
import { useAuth } from "./hooks/useAuth";
import { useSettings } from "./hooks/useSettings";
import type { ProjectContext, Critique, ApiKeyStatus, Baseline, BaselineFinding, BaselineStatusView, AiContextSnapshot, FixProposalsSnapshot, FixProposal } from "./types";
import { STORAGE_KEYS } from "./constants";

function critiqueStateKey(critique: Critique): string {
  const finding = critique.finding_id?.trim();
  if (finding) return finding;
  return critique.file_path;
}

function isSystemLogEntry(key: string, critique: Critique): boolean {
  return key.startsWith("System") || critique.file_path.startsWith("System");
}

function normalizeVersionLabel(version: string | null | undefined): string {
  const trimmed = version?.trim() ?? "";
  if (!trimmed) return "Unknown";
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

function App(): ReactElement {
  // Core state
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED) !== "true";
    }
    return false;
  });
  const [active, setActive] = useState(false);
  const [logs, setLogs] = useState<Record<string, Critique>>({});
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [baselineStatus, setBaselineStatus] = useState<BaselineStatusView | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineError, setBaselineError] = useState<string | null>(null);
  const [baselineView, setBaselineView] = useState<"all" | "new" | "resolved">("all");
  const [status, setStatus] = useState("Idle");
  const [path, setPath] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.LAST_PATH) || "";
    }
    return "";
  });
  const [filter, setFilter] = useState<string>("");
  const [expandedLogKey, setExpandedLogKey] = useState<string | null>(null);
  const [stalled, setStalled] = useState<{ file: string; reason: string } | null>(null);
  const [stallOverlayOpen, setStallOverlayOpen] = useState(false);
  const stallSignatureRef = useRef<string | null>(null);
  const stallSignature = stallSignatureRef.current ?? "";
  const [pendingGuruPrompt, setPendingGuruPrompt] = useState<AutoPrompt | null>(null);
  const [usage, setUsage] = useState({ tokens: 0, calls: 0 });
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [aiContext, setAiContext] = useState<AiContextSnapshot | null>(null);
  const [aiContextLoading, setAiContextLoading] = useState(false);
  const [aiContextError, setAiContextError] = useState<string | null>(null);
  const [fixProposals, setFixProposals] = useState<FixProposalsSnapshot | null>(null);
  const [fixProposalsLoading, setFixProposalsLoading] = useState(false);
  const [fixProposalsError, setFixProposalsError] = useState<string | null>(null);
  const [view, setView] = useState<"monitor" | "chat" | "diagram" | "ai-context" | "reviews">("monitor");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(STORAGE_KEYS.THEME) as "dark" | "light") || "dark";
    }
    return "dark";
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
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
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
        setFilter("");
        setBaseline(null);
        setBaselineStatus(null);
        setBaselineError(null);
        setBaselineView("all");
        setPath(selected);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEYS.LAST_PATH, selected);
        }
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

  const refreshBaseline = useCallback(async (): Promise<void> => {
    if (!path) {
      setBaseline(null);
      setBaselineStatus(null);
      setBaselineError(null);
      setBaselineView("all");
      return;
    }

    setBaselineLoading(true);
    setBaselineError(null);
    try {
      const baselineValue = await invoke<Baseline | null>("get_baseline", { root: path });
      setBaseline(baselineValue ?? null);

      const statusValue = await invoke<BaselineStatusView | null>("get_baseline_status", {
        root: path,
      });
      setBaselineStatus(statusValue ?? null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setBaseline(null);
      setBaselineStatus(null);
      setBaselineError(message);
      setBaselineView("all");
    } finally {
      setBaselineLoading(false);
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

  // Event listeners
  useEffect(() => {
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];

    const register = async <T,>(event: string, handler: (event: { payload: T }) => void): Promise<void> => {
      try {
        const unlisten = await listen<T>(event, handler);
        if (disposed) {
          await unlisten();
        } else {
          unlisteners.push(unlisten);
        }
      } catch (error) {
        handleError(error, `EventListener:${event}`);
      }
    };

    void register<Critique>("guardian:critique", (event) => {
      const stateKey = critiqueStateKey(event.payload);
      setLogs((prev) => ({
        ...prev,
        [stateKey]: event.payload
      }));
      setStatus("Monitoring Active");
    });

    void register<string>("guardian:clear", (event) => {
      setLogs((prev) => {
        const newLogs: Record<string, Critique> = {};
        for (const [key, critique] of Object.entries(prev)) {
          const shouldDrop = key === event.payload || critique.file_path === event.payload;
          if (!shouldDrop) {
            newLogs[key] = critique;
          }
        }
        return newLogs;
      });
    });

    void register<string>("guardian:analyzing", (event) => {
      const fileName = event.payload.split('/').pop() || "File";
      setStatus(`Analyzing: ${fileName}`);
    });

    void register<string>("guardian:error", (event) => {
      setLogs((prev) => ({
        ...prev,
        ["System"]: { file_path: "System Error", severity: "Critical", message: event.payload }
      }));
    });

    void register<string>("guardian:verification", (event) => {
      setLogs((prev) => ({
        ...prev,
        ["System:Verification"]: { file_path: "Verification", severity: "Warning", message: event.payload }
      }));
    });

    void register<string>("guardian:warning", (event) => {
      setLogs((prev) => ({
        ...prev,
        ["System:Warning"]: { file_path: "System Warning", severity: "Warning", message: event.payload }
      }));
    });

    void register<{ file_path: string; reason: string }>("guardian:stall-requested", (event) => {
      const signature = `${event.payload.file_path}::${event.payload.reason}`;
      setStalled({ file: event.payload.file_path, reason: event.payload.reason });
      if (stallSignatureRef.current !== signature) {
        setStallOverlayOpen(true);
        stallSignatureRef.current = signature;
      }
    });

    void register<string>("guardian:stall-released", () => {
      setStalled(null);
      setStallOverlayOpen(false);
      stallSignatureRef.current = null;
    });

    void register<{ tokens: number; calls: number }>("guardian:usage", (event) => {
      setUsage(prev => ({
        tokens: prev.tokens + event.payload.tokens,
        calls: prev.calls + event.payload.calls
      }));
    });

    void register<AiContextSnapshot>("guardian:ai-context", (event) => {
      setAiContext(event.payload);
      setAiContextError(null);
    });

    void register<FixProposalsSnapshot>("guardian:fix-proposals", (event) => {
      setFixProposals(event.payload);
      setFixProposalsError(null);
    });

    // Health Check
    invoke("ping").catch(e => {
      setLogs(prev => ({
        ...prev,
        ["System:Backend"]: {
          file_path: "System",
          severity: "Warning",
          message: `Backend Vitality: FAILED (${e instanceof Error ? e.message : String(e)})`
        }
      }));
    });

    return () => {
      disposed = true;
      unlisteners.forEach(fn => fn());
    };
  }, []);

  // Proactive Context Refresh
  useEffect(() => {
    void refreshContext();
  }, [refreshContext]);

  useEffect(() => {
    void refreshMonitorCritiques();
  }, [refreshMonitorCritiques]);

  useEffect(() => {
    void refreshBaseline();
  }, [refreshBaseline]);

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
  }, [view, refreshFixProposals]);

  const setBaselineNow = useCallback(async (): Promise<void> => {
    if (!path) return;
    setBaselineLoading(true);
    setBaselineError(null);
    try {
      await invoke<BaselineStatusView>("create_baseline", { root: path });
      await refreshBaseline();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setBaselineError(message);
    } finally {
      setBaselineLoading(false);
    }
  }, [path, refreshBaseline]);

  const clearBaselineNow = useCallback(async (): Promise<void> => {
    if (!path) return;
    setBaselineLoading(true);
    setBaselineError(null);
    try {
      await invoke("clear_baseline", { root: path });
      await refreshBaseline();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setBaselineError(message);
    } finally {
      setBaselineLoading(false);
    }
  }, [path, refreshBaseline]);

  const toggleMonitoring = async (): Promise<void> => {
    if (active) {
      try {
        await invoke("stop_monitoring");
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setLogs(prev => ({
          ...prev,
          ["System"]: { file_path: "System", severity: "Warning", message: `Failed to stop monitoring: ${errorMsg}` }
        }));
      } finally {
        setActive(false);
        setStatus("Paused");
      }
    } else {
      if (!path) return;
      let sessionOk = Boolean(auth.authSession && auth.authVerified);
      if (!sessionOk) {
        const refreshed = await auth.refreshAuthSession();
        sessionOk = Boolean(refreshed?.user && refreshed?.verified);
      }
      if (!sessionOk) {
        auth.setAuthGateVisible(true);
        setLogs(prev => ({
          ...prev,
          ["System:Auth"]: {
            file_path: "System",
            severity: "Critical",
            message: "GitHub login is required. Complete GitHub authentication before starting monitoring.",
          },
        }));
        return;
      }

      let activeProviderId = settings.providerDraft?.provider_id;
      if (!activeProviderId) {
        setLogs(prev => ({
          ...prev,
          ["System:Provider"]: {
            file_path: "System",
            severity: "Critical",
            message: "Provider config not ready. Try again in a moment.",
          },
        }));
        return;
      }

      let hasApiKey = settings.apiKeyStatus?.has_key ?? null;
      if (hasApiKey === null) {
        try {
          const status = await invoke<ApiKeyStatus>("get_api_key_status", {
            providerId: activeProviderId,
          });
          hasApiKey = Boolean(status.has_key);
        } catch (error) {
          handleError(error, "ApiKeyStatusCheck");
          hasApiKey = false;
        }
      }

      if (!hasApiKey) {
        setLogs(prev => ({
          ...prev,
          ["System:APIKey"]: {
            file_path: "System",
            severity: "Critical",
            message: `Missing API key for ${settings.providerLabel}. Open Settings and add your key before starting.`,
          },
        }));
        setSettingsOpen(true);
        return;
      }

      try {
        await invoke("start_monitoring", { path, autoVerifyEnabled: settings.autoVerifyEnabled });
        await refreshMonitorCritiques();
        setActive(true);
        setStatus("Monitoring Active");
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setLogs(prev => ({
          ...prev,
          ["System"]: { file_path: "System", severity: "Critical", message: `Failed to start: ${errorMsg}` }
        }));
      }
    }
  };

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
      toast.showWarning("Select a workspace scope first.");
      return;
    }
    const content = proposal.proposed_content ?? "";
    if (!content.trim()) {
      toast.showError("Proposal is missing proposed_content.");
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
      toast.showSuccess("Review requested. Check Guru for the approval result.");
      setView("chat");
    } catch (e) {
      toast.showError(`Failed to request review: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [path, toast, toAbsoluteWorkspacePath]);

  const setProposalStatus = useCallback(async (proposalId: string, status: string): Promise<void> => {
    if (!path) {
      toast.showWarning("Select a workspace scope first.");
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
      toast.showSuccess(`Proposal marked: ${status}`);
    } catch (e) {
      toast.showError(`Failed to update proposal: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [path, toast]);

  const visibleLogs = useMemo((): Critique[] => {
    const entries = Object.values(logs);
    return entries.filter(entry => entry.severity !== "Info");
  }, [logs]);

  const baselineValid = Boolean(baselineStatus?.valid);
  const baselineIds = useMemo(() => new Set(baseline?.finding_ids ?? []), [baseline]);
  const currentFindingIds = useMemo(() => {
    const set = new Set<string>();
    for (const entry of visibleLogs) {
      if (entry.finding_id) set.add(entry.finding_id);
    }
    return set;
  }, [visibleLogs]);

  const baselineMetrics = useMemo(() => {
    if (!baseline || !baselineValid) return null;
    let activeCount = 0;
    let newCount = 0;
    for (const id of currentFindingIds) {
      if (baselineIds.has(id)) activeCount += 1;
      else newCount += 1;
    }
    let resolvedCount = 0;
    for (const id of baselineIds) {
      if (!currentFindingIds.has(id)) resolvedCount += 1;
    }
    return { active: activeCount, new: newCount, resolved: resolvedCount };
  }, [baseline, baselineValid, baselineIds, currentFindingIds]);

  const resolvedFindings = useMemo((): BaselineFinding[] => {
    if (!baseline || !baselineValid) return [];
    const findings = baseline.findings ?? [];
    const entries = findings.filter((f) => !currentFindingIds.has(f.finding_id));
    if (!filter) {
      return entries.sort((a, b) => a.file_path.localeCompare(b.file_path));
    }
    const q = filter.toLowerCase();
    return entries
      .filter((f) =>
        f.file_path.toLowerCase().includes(q) ||
        (f.message ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => a.file_path.localeCompare(b.file_path));
  }, [baseline, baselineValid, currentFindingIds, filter]);

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
  const hasReviewData = Boolean((fixProposals?.proposals?.length ?? 0) > 0);

  const engineModel = settings.providerDraft?.model?.trim() || "Not set";
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
  const launchGate = useMemo(() => {
    if (!path) {
      return { canLaunch: false, blockingReason: "Select a workspace scope first." };
    }
    if (!settings.providerDraft) {
      return { canLaunch: false, blockingReason: "Provider configuration is still loading." };
    }
    if (settings.requiresApiKey) {
      return { canLaunch: false, blockingReason: `Add your ${settings.providerLabel} API key in Settings.` };
    }
    if (auth.requiresVerified) {
      return { canLaunch: false, blockingReason: "Verify your GitHub session online before monitoring." };
    }
    if (auth.authState === "signed_out") {
      return { canLaunch: false, blockingReason: "Sign in with GitHub to launch monitoring." };
    }
    if (auth.authState === "device_pending") {
      return { canLaunch: false, blockingReason: "Complete the GitHub device authorization screen." };
    }
    if (auth.authState === "verifying") {
      return { canLaunch: false, blockingReason: "GitHub verification is in progress." };
    }
    return { canLaunch: true, blockingReason: null };
  }, [path, settings.providerDraft, settings.requiresApiKey, settings.providerLabel, auth.requiresVerified, auth.authState]);
  const canToggleMonitoring = active || launchGate.canLaunch;

  return (
    <div className="flex h-screen w-full bg-background text-text-main flex-col font-sans overflow-hidden transition-colors duration-300">
      <ToastContainer />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeToggle={toggleTheme}
        isDesktop={true}
        providerDraft={settings.providerDraft}
        providerError={settings.providerError}
        providerSaving={settings.providerSaving}
        providerModels={settings.providerModels}
        providerModelLoading={settings.providerModelLoading}
        providerModelError={settings.providerModelError}
        onProviderChange={settings.onProviderChange}
        onBaseUrlChange={settings.onBaseUrlChange}
        onModelChange={settings.onModelChange}
        onRefreshModels={() => settings.refreshProviderModels(true)}
        onSaveProvider={settings.saveProviderSettings}
        apiKeyStatus={settings.apiKeyStatus}
        apiKeyInput={settings.apiKeyInput}
        apiKeyError={settings.apiKeyError}
        apiKeySaving={settings.apiKeySaving}
        onApiKeyFocus={settings.onApiKeyFocus}
        onApiKeyChange={settings.onApiKeyChange}
        onSaveApiKey={settings.saveApiKey}
        onClearApiKey={settings.clearApiKey}
        tavilyKeyStatus={settings.tavilyKeyStatus}
        tavilyKeyInput={settings.tavilyKeyInput}
        tavilyKeyMasked={settings.tavilyKeyMasked}
        tavilyKeyError={settings.tavilyKeyError}
        tavilyKeySaving={settings.tavilyKeySaving}
        webSearchEnabled={settings.webSearchEnabled}
        webSearchReady={settings.webSearchReady}
        onWebSearchToggle={settings.onWebSearchToggle}
        autoVerifyEnabled={settings.autoVerifyEnabled}
        onAutoVerifyToggle={settings.onAutoVerifyToggle}
        onTavilyKeyFocus={settings.onTavilyKeyFocus}
        onTavilyKeyChange={settings.onTavilyKeyChange}
        onSaveTavilyKey={settings.saveTavilyKey}
        onClearTavilyKey={settings.clearTavilyKey}
        embeddingDraft={settings.embeddingDraft}
        embeddingError={settings.embeddingError}
        embeddingSaving={settings.embeddingSaving}
        embeddingOpenAiKeyStatus={settings.embeddingOpenAiKeyStatus}
        embeddingOpenAiKeyInput={settings.embeddingOpenAiKeyInput}
        embeddingOpenAiKeyMasked={settings.embeddingOpenAiKeyMasked}
        embeddingOpenAiKeyError={settings.embeddingOpenAiKeyError}
        embeddingOpenAiKeySaving={settings.embeddingOpenAiKeySaving}
        onEmbeddingModeChange={settings.onEmbeddingModeChange}
        onEmbeddingOpenAiBaseUrlChange={settings.onEmbeddingOpenAiBaseUrlChange}
        onEmbeddingOllamaBaseUrlChange={settings.onEmbeddingOllamaBaseUrlChange}
        onEmbeddingOpenAiModelChange={settings.onEmbeddingOpenAiModelChange}
        onEmbeddingOllamaModelChange={settings.onEmbeddingOllamaModelChange}
        onSaveEmbeddingSettings={settings.saveEmbeddingSettings}
        onRefreshEmbeddingSettings={settings.refreshEmbeddingSettings}
        onEmbeddingOpenAiKeyFocus={settings.onEmbeddingOpenAiKeyFocus}
        onEmbeddingOpenAiKeyChange={settings.onEmbeddingOpenAiKeyChange}
        onSaveEmbeddingOpenAiKey={settings.saveEmbeddingOpenAiKey}
        onClearEmbeddingOpenAiKey={settings.clearEmbeddingOpenAiKey}
        updateInfo={settings.updateInfo}
        updateChecking={settings.updateChecking}
        updateInstalling={settings.updateInstalling}
        updateError={settings.updateError}
        onCheckUpdates={settings.checkForUpdates}
        onInstallUpdate={settings.installUpdate}
        onExportPDF={() => settings.onExportPDF(logs, path)}
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
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
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
            initial={{ y: -80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -80, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl border border-border-main bg-surface/95 text-text-main shadow-2xl shadow-black/20 flex items-center gap-4 min-w-[320px] backdrop-blur-sm"
          >
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Update Available</p>
              <p className="text-sm font-semibold text-text-main">
                {normalizeVersionLabel(settings.updateInfo.current_version)} → {normalizeVersionLabel(settings.updateInfo.latest_version)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={settings.installUpdate}
                disabled={settings.updateInstalling}
                className="px-4 py-2 rounded-lg bg-[var(--text-main)] text-[var(--surface)] font-semibold text-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 shadow-lg"
              >
                {settings.updateInstalling ? "Updating..." : "Install Update"}
              </button>
              <button
                onClick={() => settings.setUpdateDismissed(true)}
                className="px-3 py-2 rounded-lg border border-border-main bg-background/70 hover:bg-background text-text-main text-sm font-medium transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {settings.updateChecking && !settings.updateInfo && !settings.updateDismissed && (
        <div className="px-6 py-1 text-[10px] text-text-muted flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-border-main animate-pulse" />
          Checking for updates...
        </div>
      )}

      {settings.updateError && !settings.updateDismissed && (
        <div className="px-6 py-1 text-[10px] text-rose-400 bg-transparent">
          {settings.updateError}
        </div>
      )}

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 xl:w-80 min-w-[17rem] bg-surface border-r border-border-main transition-colors duration-300 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 custom-scrollbar">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border-main bg-background/45 p-2 space-y-1.5">
                <button
                  onClick={() => setView("monitor")}
                  className={clsx(
                    "w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 cursor-pointer",
                    view === "monitor" ? "bg-surface shadow text-[var(--text-main)]" : "opacity-70 hover:opacity-100"
                  )}
                >
                  <Activity className="w-4 h-4" /> Monitor
                </button>
                <button
                  onClick={() => setView("chat")}
                  className={clsx(
                    "w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 cursor-pointer",
                    view === "chat" ? "bg-surface shadow text-[var(--text-main)]" : "opacity-70 hover:opacity-100"
                  )}
                >
                  <MessageSquare className="w-4 h-4" /> Guru
                </button>
                <button
                  onClick={() => setView("diagram")}
                  className={clsx(
                    "w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 cursor-pointer",
                    view === "diagram" ? "bg-surface shadow text-[var(--text-main)]" : "opacity-70 hover:opacity-100"
                  )}
                >
                  <Share2 className="w-4 h-4" /> Project Map
                </button>
                <button
                  onClick={() => setView("ai-context")}
                  className={clsx(
                    "w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer",
                    view === "ai-context" ? "bg-surface shadow text-[var(--text-main)]" : "opacity-70 hover:opacity-100"
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
                        : "bg-white/5 text-text-muted border-border-main"
                    )}
                  >
                    {hasAiContextData ? "READY" : "EMPTY"}
                  </span>
                </button>
                <button
                  onClick={() => setView("reviews")}
                  className={clsx(
                    "w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer",
                    view === "reviews" ? "bg-surface shadow text-[var(--text-main)]" : "opacity-70 hover:opacity-100"
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
                          : "bg-white/5 text-text-muted border-border-main"
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
                    count={context?.total_files || 0}
                    icon={<Files className="w-3.5 h-3.5 text-zinc-400" />}
                    color="text-[var(--stat-strong)]"
                  />
                  <StatMini
                    label="Issues"
                    count={stats.total}
                    icon={<AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
                    color="text-[var(--stat-strong)]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Scope</label>
                  <div className="group relative">
                    <Folder className="absolute left-3 top-3 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors pointer-events-none" />
                    <input
                      readOnly
                      onClick={selectScope}
                      className="w-full bg-background border border-border-main rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-opacity-100 transition-all placeholder:opacity-50 cursor-pointer hover:bg-border-main"
                      value={scopeLabel}
                      placeholder="Select workspace"
                    />
                  </div>
                </div>
              </div>

              <CostMetric tokens={usage.tokens} calls={usage.calls} />

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
                            : "bg-white/5 text-text-muted border-border-main"
                    )}
                  >
                    {baselineLoading ? "LOADING" : baselineStatus?.valid ? "VALID" : baselineStatus ? "INVALID" : "NONE"}
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
                  <div className="text-[10px] text-text-muted">
                    No baseline set for this workspace.
                  </div>
                )}

                {baselineStatus && !baselineValid && (
                  <div className="text-[10px] text-amber-400">
                    Baseline invalid (rules changed). Reset baseline to re-enable filtering.
                  </div>
                )}

                {baselineError && (
                  <div className="text-[10px] text-rose-400">
                    {baselineError}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={setBaselineNow}
                    disabled={!path || baselineLoading}
                    className="flex-1 px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Set Baseline
                  </button>
                  {baselineStatus && (
                    <button
                      onClick={clearBaselineNow}
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
                      onClick={() => setBaselineView("all")}
                      className={clsx(
                        "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
                        baselineView === "all"
                          ? "bg-white/10 text-text-main border-border-main"
                          : "bg-transparent text-text-muted border-border-main hover:bg-white/5"
                      )}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setBaselineView("new")}
                      className={clsx(
                        "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
                        baselineView === "new"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-transparent text-text-muted border-border-main hover:bg-white/5"
                      )}
                    >
                      New
                    </button>
                    <button
                      onClick={() => setBaselineView("resolved")}
                      className={clsx(
                        "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
                        baselineView === "resolved"
                          ? "bg-white/10 text-text-main border-border-main"
                          : "bg-transparent text-text-muted border-border-main hover:bg-white/5"
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
                    onClick={() => {
                      settings.setSettingsTab("embedding");
                      setSettingsOpen(true);
                    }}
                    className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                  >
                    Setup
                  </button>
                </div>
                <div className="h-1 w-full bg-border-main rounded-full overflow-hidden">
                  <div className={clsx("h-full transition-all duration-1000", active ? "w-full bg-[var(--accent-500)]" : "w-0 bg-border-main")} />
                </div>
              </div>

              {auth.authGateVisible && (auth.showAuthGate || auth.requiresVerified) && !active && (
                <div className="rounded-xl border border-amber-500/20 bg-white text-zinc-900 dark:bg-amber-500/10 dark:text-amber-200 px-3 py-2 text-[10px] space-y-2">
                  <div>
                    {auth.showAuthGate
                      ? "GitHub login is required before starting monitoring."
                      : "Cached session detected. Verify online to refresh GitHub access."}
                  </div>
                  <div className="flex gap-2">
                    {!auth.showAuthGate && (
                      <button
                        onClick={auth.refreshAuthSession}
                        disabled={auth.authLoading}
                        className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Verify Now
                      </button>
                    )}
                    {auth.authError && (
                      <span className="text-[10px] text-rose-500">{auth.authError}</span>
                    )}
                    {!auth.authError && auth.authWarning && (
                      <span className="text-[10px] text-amber-500">{auth.authWarning}</span>
                    )}
                  </div>
                </div>
              )}

              {settings.requiresApiKey && !active && (
                <div className="rounded-xl border border-rose-500/20 bg-white text-rose-600 dark:bg-rose-500/10 dark:text-rose-500 px-3 py-2 text-[10px] space-y-2">
                  <div>Setup required: add your {settings.providerLabel} API key.</div>
                  <button
                    onClick={() => setSettingsOpen(true)}
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
              onClick={canToggleMonitoring ? toggleMonitoring : undefined}
              disabled={!canToggleMonitoring}
              className={clsx(
                "w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all duration-300 transform active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                active
                  ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20"
                  : "bg-[var(--accent-500)] text-background hover:opacity-90"
              )}
            >
              {active ? <><Square className="w-3 h-3 fill-current" /> KILL GUARDIAN</> : <><Play className="w-3 h-3 fill-current" /> LAUNCH GUARDIAN</>}
            </button>
            {!active && !launchGate.canLaunch && launchGate.blockingReason && (
              <p className="text-[10px] text-amber-400 px-1">
                {launchGate.blockingReason}
              </p>
            )}
          </section>
        </aside>

        {/* Main Content Area - Monitor */}
        <section
          className={clsx(
            "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300 relative",
            view === "monitor" ? "flex" : "hidden"
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
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Search issues (file, message, severity)..."
                  />
                  {filter.trim().length > 0 && (
                    <button
                      onClick={() => setFilter("")}
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
                "pointer-events-none absolute inset-0 top-14 flex items-center justify-center transition-opacity opacity-20"
              )}
            >
              <GuardianActivity status={status} compact showLabel={false} />
            </div>
          )}

          <div
            className={clsx(
              "flex-1 overflow-y-auto px-2 custom-scrollbar",
              showFloatingFilter ? "pt-16 pb-2" : "py-2"
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
                            <div className="text-xs opacity-30 font-mono truncate">
                              {finding.file_path}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 pr-6">
                            <div
                              className="text-sm opacity-80 font-medium truncate"
                              title={finding.message ?? ""}
                            >
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
                  <h3 className="font-bold text-sm text-zinc-500">{active ? "Guardian Online" : "System Secure"}</h3>
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
                    onToggle={() =>
                      setExpandedLogKey((prev) =>
                        prev === critiqueStateKey(log) ? null : critiqueStateKey(log)
                      )
                    }
                    onAskGuru={() => askGuruForLog(log, false)}
                    findingStatus={
                      baselineValid && log.finding_id
                        ? baselineIds.has(log.finding_id)
                          ? "active"
                          : "new"
                        : undefined
                    }
                    onFix={() => {
                      const stateKey = critiqueStateKey(log);
                      setLogs(prev => {
                        const newLogs = { ...prev };
                        delete newLogs[stateKey];
                        return newLogs;
                      });
                      if (expandedLogKey === stateKey) setExpandedLogKey(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Chat View */}
        <section
          className={clsx(
            "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300",
            view === "chat" ? "flex" : "hidden"
          )}
        >
          <ChatView
            path={path}
            autoPrompt={pendingGuruPrompt}
            onAutoPromptConsumed={() => setPendingGuruPrompt(null)}
            webSearchEnabled={settings.webSearchEnabled}
            onWebSearchToggle={settings.onWebSearchToggle}
            webSearchReady={settings.webSearchReady}
          />
        </section>

        {/* Reviews View */}
        <section
          className={clsx(
            "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300",
            view === "reviews" ? "flex" : "hidden"
          )}
        >
          {!path ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted text-sm">
              <div className="w-16 h-16 rounded-2xl border border-border-main bg-background/40 flex items-center justify-center">
                <ClipboardList className="w-7 h-7 text-text-muted/80" />
              </div>
              <div className="text-xs uppercase tracking-widest">No workspace selected.</div>
              <div className="text-[10px] text-text-muted max-w-md text-center">
                Select a workspace, then write proposals to <span className="text-[var(--text-main)]">.guardian-proposals/fix_proposals.jsonl</span>.
              </div>
              <button
                onClick={selectScope}
                className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer"
              >
                Select Workspace
              </button>
            </div>
          ) : (
            <FixProposalsView
              snapshot={fixProposals}
              loading={fixProposalsLoading}
              error={fixProposalsError}
              onRefresh={refreshFixProposals}
              onRequestReview={requestReviewForProposal}
              onSetStatus={setProposalStatus}
            />
          )}
        </section>

        {/* AI Context View */}
        <section
          className={clsx(
            "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300",
            view === "ai-context" ? "flex" : "hidden"
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
                onClick={selectScope}
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
              onRefresh={refreshAiContext}
            />
          )}
        </section>

        {/* Diagram View */}
        <section
          className={clsx(
            "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300",
            view === "diagram" ? "flex" : "hidden"
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
                onClick={refreshContext}
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
                onClick={selectScope}
                className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer"
              >
                Select Workspace
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatMini({ icon, count, label, color }: { icon: React.ReactNode; count: number; label: string; color: string }): ReactElement {
  return (
    <div className="flex items-center gap-2 px-3 border-r border-white/5 last:border-r-0 hover:bg-white/[0.02] transition-colors rounded-md h-8 group cursor-default">
      <div className="group-hover:scale-110 transition-transform">{icon}</div>
      <div className="flex flex-col -space-y-1">
        <span className={clsx("text-sm font-black tabular-nums", color)}>{count}</span>
        <span className="text-[8px] font-bold uppercase tracking-widest opacity-30 group-hover:opacity-60 transition-opacity">{label}</span>
      </div>
    </div>
  );
}

function CostMetric({ tokens, calls }: { tokens: number; calls: number }): ReactElement {
  const costUnits = (tokens / 1000).toFixed(2);

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
        Tokens: {tokens} • Calls: {calls}
      </div>
    </div>
  );
}

function GuardianActivity({ status, compact = false, showLabel = true }: { status: string; compact?: boolean; showLabel?: boolean }): ReactElement {
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
        <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[var(--accent-500)] opacity-70">{label}</div>
      )}
    </div>
  );
}

export default App;
