import { useState, useEffect, useMemo, useRef, useCallback, type ReactElement } from "react";
import { invoke, listen, openDialog, type UnlistenFn } from "./lib/tauri";
import { exportAuditToPdf } from "./lib/exportAuditPdf";
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
  ShieldAlert,
} from "lucide-react";
import clsx from "clsx";
import { CritiqueAccordionRow, Critique } from "./components/CritiqueAccordionRow";
import { ChatView } from "./components/ChatView";
import DiagramView from "./components/DiagramView";
import { Header } from "./components/Header";
import { AuthGate } from "./components/AuthGate";
import { SettingsModal } from "./components/SettingsModal";
import { StallOverlay } from "./components/StallOverlay";
import { useAuth } from "./hooks/useAuth";
import { useSettings } from "./hooks/useSettings";
import type { ProjectContext } from "./types/guardian";

function App(): ReactElement {
  // Core state
  const [active, setActive] = useState(false);
  const [logs, setLogs] = useState<Record<string, Critique>>({});
  const [status, setStatus] = useState("Idle");
  const [path, setPath] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("guardian_last_path") || "";
    }
    return "";
  });
  const [filter, setFilter] = useState<string>("");
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [stalled, setStalled] = useState<{ file: string; reason: string } | null>(null);
  const [stallOverlayOpen, setStallOverlayOpen] = useState(false);
  const [stallBannerVisible, setStallBannerVisible] = useState(true);
  const stallSignatureRef = useRef<string | null>(null);
  const [pendingGuruPrompt, setPendingGuruPrompt] = useState<string | null>(null);
  const [usage, setUsage] = useState({ tokens: 0, calls: 0 });
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [view, setView] = useState<"monitor" | "chat" | "diagram">("monitor");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("guardian_theme") as "dark" | "light") || "dark";
    }
    return "dark";
  });

  // Hooks
  const auth = useAuth();
  const settings = useSettings(exportAuditToPdf);

  const scopeLabel = useMemo(() => {
    if (!path) return "";
    const trimmed = path.replace(/[\\/]+$/, "");
    const parts = trimmed.split(/[\\/]/);
    return parts[parts.length - 1] || trimmed;
  }, [path]);

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("guardian_theme", theme);
  }, [theme]);

  // Persist path
  useEffect(() => {
    if (!path) return;
    localStorage.setItem("guardian_last_path", path);
  }, [path]);

  const toggleTheme = useCallback((): void => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  }, []);

  const selectScope = async (): Promise<void> => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Scope Directory"
      });

      if (selected && typeof selected === "string") {
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
      } catch {
        // Non-fatal: listener registration failure shouldn't crash the UI
      }
    };

    void register<Critique>("guardian:critique", (event) => {
      setLogs((prev) => ({
        ...prev,
        [event.payload.file_path]: event.payload
      }));
      setStatus("Monitoring Active");
    });

    void register<string>("guardian:clear", (event) => {
      setLogs((prev) => {
        const newLogs = { ...prev };
        delete newLogs[event.payload];
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
        ["System:Warning"]: { file_path: "System Warning", severity: "Info", message: event.payload }
      }));
    });

    void register<{ file_path: string; reason: string }>("guardian:stall-requested", (event) => {
      const signature = `${event.payload.file_path}::${event.payload.reason}`;
      setStalled({ file: event.payload.file_path, reason: event.payload.reason });
      setStallBannerVisible(true);
      if (stallSignatureRef.current !== signature) {
        setStallOverlayOpen(true);
        stallSignatureRef.current = signature;
      }
    });

    void register<string>("guardian:stall-released", () => {
      setStalled(null);
      setStallOverlayOpen(false);
      stallSignatureRef.current = null;
      setStallBannerVisible(false);
    });

    void register<{ tokens: number; calls: number }>("guardian:usage", (event) => {
      setUsage(prev => ({
        tokens: prev.tokens + event.payload.tokens,
        calls: prev.calls + event.payload.calls
      }));
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

      if (!settings.apiKeyStatus?.has_key) {
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
        await invoke("start_monitoring", { path });
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
    if (stalled) {
      setPendingGuruPrompt(
        `Critical violation detected in ${stalled.file}.\nReason: ${stalled.reason}.\n\nPlease propose a safe fix with a clear explanation and the FULL updated file content only (no diff markers, no markdown).`
      );
    } else {
      setPendingGuruPrompt("We are stalled by a critical violation. Please propose a safe fix with the FULL updated file content only (no diff markers, no markdown).");
    }
    setView("chat");
  }, [stalled]);

  const visibleLogs = useMemo((): Critique[] => {
    const entries = Object.values(logs);
    return entries.filter(entry => entry.severity !== "Info");
  }, [logs]);

  const filteredLogs = useMemo((): Critique[] => {
    const entries = visibleLogs;
    if (!filter) return entries;
    return entries.filter(l =>
      l.file_path.toLowerCase().includes(filter.toLowerCase()) ||
      l.message.toLowerCase().includes(filter.toLowerCase())
    );
  }, [visibleLogs, filter]);

  const stats = useMemo(() => {
    const vals = visibleLogs;
    return {
      critical: vals.filter(v => v.severity === "Critical").length,
      warning: vals.filter(v => v.severity === "Warning").length,
      info: vals.filter(v => v.severity === "Info").length,
      total: vals.length
    };
  }, [visibleLogs]);

  const engineModel = settings.providerDraft?.model?.trim() || "Not set";
  const canToggleMonitoring = Boolean(path) && Boolean(settings.providerDraft) && !auth.showAuthGate && !auth.requiresVerified && !settings.requiresApiKey;

  return (
    <div className="flex h-screen w-full bg-background text-text-main flex-col font-sans overflow-hidden transition-colors duration-300">
      <StallOverlay
        stalled={stalled}
        open={stallOverlayOpen}
        onResolve={() => {
          openGuruForStall();
          setStallOverlayOpen(false);
        }}
        onDismiss={() => setStallOverlayOpen(false)}
      />

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
        onCancel={() => auth.setAuthDevice(null)}
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
        onTavilyKeyFocus={settings.onTavilyKeyFocus}
        onTavilyKeyChange={settings.onTavilyKeyChange}
        onSaveTavilyKey={settings.saveTavilyKey}
        onClearTavilyKey={settings.clearTavilyKey}
        updateFeedUrl={settings.updateFeedUrl}
        updateFeedError={settings.updateFeedError}
        updateFeedSaving={settings.updateFeedSaving}
        onUpdateFeedChange={settings.onUpdateFeedChange}
        onSaveUpdateFeed={settings.saveUpdateFeed}
        onExportPDF={() => settings.onExportPDF(logs, path)}
        settingsTab={settings.settingsTab}
        onSettingsTabChange={settings.setSettingsTab}
      />

      {settings.updateInfo?.status === "available" && !settings.updateDismissed && (
        <div className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest bg-[var(--accent-200)] text-text-main flex items-center justify-between">
          <span>
            Update available: v{settings.updateInfo.current_version} → v{settings.updateInfo.latest_version}
          </span>
          <div className="flex items-center gap-2">
            {settings.updateInfo.download_url && (
              <button
                onClick={settings.downloadUpdate}
                disabled={settings.updateDownloading}
                className="px-3 py-1 rounded-md bg-[var(--accent-500)] text-background hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {settings.updateDownloading ? "Downloading..." : "Download"}
              </button>
            )}
            <button
              onClick={() => settings.setUpdateDismissed(true)}
              className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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

      {/* CLOCKWORK EVOLUTION: Hard Lock Banner */}
      {stalled && stallBannerVisible && (
        <div className="bg-white text-zinc-900 dark:bg-[var(--accent-200)] dark:text-text-main px-6 py-2 flex items-center justify-between text-xs font-bold animate-in slide-in-from-top duration-500 z-30 border-b border-border-main">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-4 h-4 text-[var(--accent-500)] animate-pulse" />
            <span>SYSTEM STALLED: Critical violation detected in {stalled.file.split('/').pop()}</span>
            <span className="opacity-70 font-normal ml-4">Antigravity execution is paused until a fix is approved.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openGuruForStall}
              className="px-3 py-1 bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer"
            >
              RESOLVE IN GURU
            </button>
            <button
              onClick={() => setStallBannerVisible(false)}
              className="px-3 py-1 bg-white/70 dark:bg-[var(--accent-200)] text-zinc-900 dark:text-text-main rounded-md hover:opacity-90 transition-colors cursor-pointer border border-border-main"
            >
              DISMISS
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-surface border-r border-border-main p-5 flex flex-col gap-8 transition-colors duration-300">
          <div className="flex flex-col gap-1 bg-background/50 p-2 rounded-xl border border-border-main">
            <button
              onClick={() => setView("monitor")}
              className={clsx("w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center gap-3 cursor-pointer", view === "monitor" ? "bg-surface shadow text-[var(--text-main)]" : "opacity-50 hover:opacity-100")}
            >
              <Activity className="w-4 h-4" /> Monitor
            </button>
            <button
              onClick={() => setView("chat")}
              className={clsx("w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center gap-3 cursor-pointer", view === "chat" ? "bg-surface shadow text-[var(--text-main)]" : "opacity-50 hover:opacity-100")}
            >
              <MessageSquare className="w-4 h-4" /> Guru
            </button>
            <button
              onClick={() => setView("diagram")}
              className={clsx("w-full py-2 px-3 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center gap-3 cursor-pointer", view === "diagram" ? "bg-surface shadow text-[var(--text-main)]" : "opacity-50 hover:opacity-100")}
            >
              <Share2 className="w-4 h-4" /> Project Map
            </button>
          </div>

          <section className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <StatMini label="Files" count={context?.total_files || 0} icon={<Files className="w-3.5 h-3.5 text-zinc-400" />} color="text-[var(--stat-strong)]" />
              <StatMini label="Issues" count={stats.total} icon={<AlertCircle className="w-3.5 h-3.5 text-amber-400" />} color="text-[var(--stat-strong)]" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Scope</label>
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

            <CostMetric tokens={usage.tokens} calls={usage.calls} />

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Filter</label>
              <div className="group relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  className="w-full bg-background border border-border-main rounded-lg py-2 pl-9 pr-3 text-xs outline-none focus:border-opacity-100 transition-all placeholder:opacity-50"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search Issues..."
                />
              </div>
            </div>
          </section>

          <section className="mt-auto pt-6 border-t border-border-main space-y-4">
            <div className="p-3 rounded-xl bg-background/50 border border-border-main space-y-2">
              <div className="flex items-center gap-2">
                <Box className="w-3 h-3 opacity-50" />
                <span className="text-[10px] font-bold opacity-60 uppercase">Engine Status</span>
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed font-mono">Model: {engineModel}</p>
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
          
          {active && filteredLogs.length !== 0 && (
            <div
              className={clsx(
                "pointer-events-none absolute inset-0 top-14 flex items-center justify-center transition-opacity opacity-20"
              )}
            >
              <GuardianActivity status={status} compact showLabel={false} />
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-1">
            {filteredLogs.length === 0 ? (
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
              filteredLogs.map((log, index) => (
                <CritiqueAccordionRow
                  key={log.file_path}
                  log={log}
                  index={index + 1}
                  isExpanded={expandedFile === log.file_path}
                  onToggle={() => setExpandedFile(expandedFile === log.file_path ? null : log.file_path)}
                  onFix={() => {
                    setLogs(prev => {
                      const newLogs = { ...prev };
                      delete newLogs[log.file_path];
                      return newLogs;
                    });
                    if (expandedFile === log.file_path) setExpandedFile(null);
                  }}
                />
              ))
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
