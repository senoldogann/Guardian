import { useState, useEffect, useMemo, type ReactElement } from "react";
import { invoke, listen, openDialog, openExternal, isTauriRuntime, type UnlistenFn } from "./lib/tauri";
import { exportAuditToPdf } from "./lib/exportAuditPdf";
import {
  Shield,
  ShieldAlert,
  Play,
  Square,
  Activity,
  Folder,
  Search,
  CheckCircle2,
  AlertCircle,
  Box,
  Moon,
  Sun,
  MessageSquare,
  Download,
  Cpu,
  Files,
  Share2
} from "lucide-react";
import clsx from "clsx";
// Clean Code: Imported Components
import { CritiqueAccordionRow, Critique } from "./components/CritiqueAccordionRow";
import { ChatView } from "./components/ChatView";
import DiagramView from "./components/DiagramView";
import type { ProjectContext } from "./types/guardian";

type GithubUser = {
  login: string;
  id: number;
  avatar_url?: string;
};

type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

function App(): ReactElement {
  const isDesktop = isTauriRuntime();
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
  const [stalled, setStalled] = useState<{ file: string, reason: string } | null>(null);
  const [stallOverlayOpen, setStallOverlayOpen] = useState(false);
  const [stallSignature, setStallSignature] = useState<string | null>(null);
  const [stallBannerVisible, setStallBannerVisible] = useState(true);
  const [pendingGuruPrompt, setPendingGuruPrompt] = useState<string | null>(null);
  const [usage, setUsage] = useState({ tokens: 0, calls: 0 });
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [authSession, setAuthSession] = useState<GithubUser | null>(null);
  const [authDevice, setAuthDevice] = useState<DeviceCodeResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const exportToPDF = (): void => {
    void exportAuditToPdf({ logs, path });
  };

  // View State (Monitor | Chat | Diagram | Autopilot)
  const [view, setView] = useState<"monitor" | "chat" | "diagram">("monitor");

  // Theme State
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("guardian_theme") as "dark" | "light") || "dark";
    }
    return "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("guardian_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!path) return;
    localStorage.setItem("guardian_last_path", path);
  }, [path]);

  const toggleTheme = (): void => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  const selectScope = async (): Promise<void> => {
    if (!isDesktop) return;
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

    void register<{ file_path: string, reason: string }>("guardian:stall-requested", (event) => {
      const signature = `${event.payload.file_path}::${event.payload.reason}`;
      setStalled({ file: event.payload.file_path, reason: event.payload.reason });
      setStallBannerVisible(true);
      setStallSignature((prev) => {
        if (prev !== signature) {
          setStallOverlayOpen(true);
          return signature;
        }
        return prev;
      });
    });

    void register<string>("guardian:stall-released", () => {
      setStalled(null);
      setStallOverlayOpen(false);
      setStallSignature(null);
      setStallBannerVisible(false);
    });

    void register<{ tokens: number, calls: number }>("guardian:usage", (event) => {
      setUsage(prev => ({
        tokens: prev.tokens + event.payload.tokens,
        calls: prev.calls + event.payload.calls
      }));
    });

    // Health Check: Verify backend is alive
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
  }, []); // Stable: Only runs once

  useEffect(() => {
    const loadSession = async (): Promise<void> => {
      try {
        const res = await invoke<{ user: GithubUser } | null>("get_auth_session");
        setAuthSession(res?.user ?? null);
      } catch (e) {
        setAuthError(e instanceof Error ? e.message : String(e));
      }
    };
    loadSession();
  }, []);

  // Proactive Context Refresh (SPAP v2.2): Update whenever path changes
  useEffect(() => {
    if (!path) return;
    const updateContext = async (): Promise<void> => {
      try {
        const ctx = await invoke<ProjectContext>("get_project_context", { path });
        setContext(ctx);
      } catch (e) {
        setLogs(prev => ({
          ...prev,
          ["System:Context"]: {
            file_path: "System",
            severity: "Warning",
            message: `Context scan failed: ${e instanceof Error ? e.message : String(e)}`
          }
        }));
      }
    };
    updateContext();
  }, [path]);

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

  const startGithubLogin = async (): Promise<void> => {
    if (!isDesktop) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const device = await invoke<DeviceCodeResponse>("start_github_login");
      setAuthDevice(device);
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuthLoading(false);
    }
  };

  const completeGithubLogin = async (): Promise<void> => {
    if (!isDesktop) return;
    if (!authDevice) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const user = await invoke<GithubUser>("complete_github_login", { deviceCode: authDevice.device_code });
      setAuthSession(user);
      setAuthDevice(null);
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuthLoading(false);
    }
  };

  const logoutGithub = async (): Promise<void> => {
    if (!isDesktop) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      await invoke("logout_github");
      setAuthSession(null);
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuthLoading(false);
    }
  };

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
  const canToggleMonitoring = isDesktop && (active || Boolean(path));

  const openGuruForStall = (): void => {
    if (stalled) {
      setPendingGuruPrompt(
        `Critical violation detected in ${stalled.file}.\nReason: ${stalled.reason}.\n\nPlease propose a safe fix with a clear explanation and the FULL updated file content only (no diff markers, no markdown).`
      );
    } else {
      setPendingGuruPrompt("We are stalled by a critical violation. Please propose a safe fix with the FULL updated file content only (no diff markers, no markdown).");
    }
    setView("chat");
  };

  return (
    <div className="flex h-screen w-full bg-background text-text-main flex-col font-sans overflow-hidden transition-colors duration-300">
      {stalled && stallOverlayOpen && (
        <div
          key={stallSignature ?? "stall"}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
        >
          <div
            className="max-w-xl w-[90%] bg-surface border border-rose-500/40 rounded-2xl p-8 shadow-2xl shadow-rose-900/40"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-3 mb-4">
              <ShieldAlert className="w-6 h-6 text-rose-500 animate-pulse" />
              <h2 className="text-lg font-black uppercase tracking-widest text-rose-400">Critical Stall</h2>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Critical violation detected in <span className="font-bold">{stalled.file.split('/').pop()}</span>.
              Real-time monitoring is paused for safety. Resolve the issue in Guru to continue.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  openGuruForStall();
                  setStallOverlayOpen(false);
                }}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg text-xs uppercase tracking-widest transition-colors"
              >
                Resolve In Guru
              </button>
              <button
                onClick={() => setStallOverlayOpen(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-xs uppercase tracking-widest transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {authDevice && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="max-w-lg w-[92%] bg-surface border border-border-main rounded-2xl p-6 shadow-2xl">
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-2">GitHub Login</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Open the verification page and enter this code:
            </p>
            <div className="flex items-center justify-between bg-background border border-border-main rounded-lg px-4 py-3 mb-4">
              <span className="text-lg font-black tracking-widest text-white">{authDevice.user_code}</span>
              <button
                onClick={() => openExternal(authDevice.verification_uri)}
                className="px-3 py-1 text-xs font-bold uppercase tracking-widest bg-sky-600 hover:bg-sky-500 text-white rounded-md transition-colors"
              >
                Open GitHub
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={completeGithubLogin}
                disabled={authLoading}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors disabled:opacity-50"
              >
                I Authorized
              </button>
              <button
                onClick={() => setAuthDevice(null)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Dynamic Header */}
      <header className="h-14 border-b border-border-main flex items-center px-6 justify-between shrink-0 bg-surface/80 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <div className={clsx(
            "p-1.5 rounded-lg transition-all duration-500",
            active ? "bg-zinc-100 shadow-[0_0_15px_rgba(255,255,255,0.1)]" : "bg-border-main"
          )}>
            <Shield className={clsx("w-5 h-5", active ? "text-zinc-900" : "opacity-30")} />
          </div>
          <span className="text-base font-bold tracking-tight uppercase opacity-50">Guardian V4 Control Hub</span>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all cursor-pointer"
            title="Toggle Theme"
          >
            {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <div className="flex gap-4 border-r border-border-main pr-6 hide-mobile">
            <StatMini icon={<ShieldAlert className="w-3.5 h-3.5 text-rose-400" />} count={stats.critical} label="Critical" color="text-rose-400" />
            <StatMini icon={<AlertCircle className="w-3.5 h-3.5 text-amber-400" />} count={stats.warning} label="Warning" color="text-amber-400" />
            <StatMini icon={<Cpu className="w-3.5 h-3.5 text-cyan-400" />} count={usage.calls} label="AI Calls" color="text-cyan-400" />
          </div>

          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-lg border border-white/10 transition-all text-xs font-bold uppercase tracking-widest active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hide-mobile">Export</span>
          </button>

          <div className="flex items-center gap-2 text-[10px] font-mono opacity-30 bg-surface px-2 py-1 rounded hide-mobile">
            <Activity className={clsx("w-3 h-3", active ? "text-zinc-100" : "text-zinc-500")} />
            {status}
          </div>
        </div>
      </header>
      {!isDesktop && (
        <div className="bg-amber-500/10 text-amber-300 px-6 py-2 text-[10px] font-bold uppercase tracking-widest">
          Web preview only. Desktop app required.
        </div>
      )}

      {/* CLOCKWORK EVOLUTION: Hard Lock Banner */}
      {stalled && stallBannerVisible && (
        <div className="bg-rose-600 text-white px-6 py-2 flex items-center justify-between text-xs font-bold animate-in slide-in-from-top duration-500 z-30">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-4 h-4 animate-pulse" />
            <span>SYSTEM STALLED: Critical violation detected in {stalled.file.split('/').pop()}</span>
            <span className="opacity-70 font-normal ml-4">Antigravity execution is paused until a fix is approved.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openGuruForStall}
              className="px-3 py-1 bg-white text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
            >
              RESOLVE IN GURU
            </button>
            <button
              onClick={() => setStallBannerVisible(false)}
              className="px-3 py-1 bg-white/10 text-white rounded-md hover:bg-white/20 transition-colors cursor-pointer"
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
              <StatMini label="Files" count={context?.total_files || 0} icon={<Files className="w-3.5 h-3.5 text-zinc-400" />} color="text-zinc-300" />
              <StatMini label="Issues" count={stats.total} icon={<AlertCircle className="w-3.5 h-3.5 text-amber-400" />} color="text-zinc-300" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Scope</label>
              <div className="group relative">
                <Folder className="absolute left-3 top-3 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors pointer-events-none" />
                <input
                  disabled={!isDesktop}
                  readOnly
                  onClick={isDesktop ? selectScope : undefined}
                  className="w-full bg-background border border-border-main rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-opacity-100 transition-all placeholder:opacity-50 cursor-pointer hover:bg-border-main disabled:cursor-not-allowed disabled:opacity-60"
                  value={path}
                  placeholder={isDesktop ? "Select workspace" : "Desktop app required"}
                />
              </div>
              {!isDesktop && (
                <p className="text-[10px] text-amber-400 px-1">Workspace selection is available in the desktop app.</p>
              )}
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
            <div className="p-3 rounded-xl bg-background/50 border border-border-main space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Cloud Session</span>
                {authSession && (
                  <span className="text-[10px] font-mono text-emerald-400">Connected</span>
                )}
              </div>
              {authSession ? (
                <div className="flex items-center gap-3">
                  {authSession.avatar_url ? (
                    <img src={authSession.avatar_url} alt={authSession.login} className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white/10" />
                  )}
                  <div className="flex-1">
                    <div className="text-xs font-bold text-white">{authSession.login}</div>
                    <div className="text-[10px] text-zinc-500">GitHub</div>
                  </div>
                  <button
                    onClick={logoutGithub}
                    disabled={authLoading}
                    className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors disabled:opacity-50"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={startGithubLogin}
                  disabled={authLoading || !isDesktop}
                  className="w-full px-3 py-2 text-xs font-bold uppercase tracking-widest bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sign In With GitHub
                </button>
              )}
              {!isDesktop && <div className="text-[10px] text-amber-400">Desktop app required for GitHub login.</div>}
              {authError && <div className="text-[10px] text-rose-400">{authError}</div>}
            </div>

            <div className="p-3 rounded-xl bg-background/50 border border-border-main space-y-2">
              <div className="flex items-center gap-2">
                <Box className="w-3 h-3 opacity-50" />
                <span className="text-[10px] font-bold opacity-60 uppercase">Engine Status</span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">Model: {active ? "GEMINI-V3-FLASH" : "STANDBY"}</p>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div className={clsx("h-full transition-all duration-1000", active ? "w-full bg-zinc-100" : "w-0 bg-zinc-700")} />
              </div>
            </div>

            <button
              onClick={canToggleMonitoring ? toggleMonitoring : undefined}
              disabled={!canToggleMonitoring}
              className={clsx(
                "w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all duration-300 transform active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                active
                  ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20"
                  : "bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              )}
            >
              {active ? <><Square className="w-3 h-3 fill-current" /> KILL GUARDIAN</> : <><Play className="w-3 h-3 fill-current" /> LAUNCH GUARDIAN</>}
            </button>
          </section>
        </aside>

        {/* Main Content Area */}
        <section
          className={clsx(
            "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300 relative",
            view === "monitor" ? "flex" : "hidden"
          )}
        >
            {/* Table Header Wrapper */}
            <div className="h-14 bg-surface border-b border-border-main px-6 flex items-center text-xs font-bold opacity-60 uppercase tracking-widest sticky top-0 z-10 transition-colors duration-300 shrink-0">
              <div className="w-8 shrink-0">#</div>
              <div className="w-48 shrink-0">File Path</div>
              <div className="flex-1 min-w-0 px-4">Core Violation Message</div>
              <div className="w-40 text-right shrink-0">Actions / Sev</div>
            </div>
            {active && (
              <div
                className={clsx(
                  "pointer-events-none absolute inset-0 top-14 flex items-center justify-center transition-opacity",
                  filteredLogs.length === 0 ? "opacity-100" : "opacity-20"
                )}
              >
                <GuardianActivity status={status} compact={filteredLogs.length !== 0} />
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-1">
              {filteredLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-6">
                  {active ? (
                    <div className="h-16" aria-hidden="true" />
                  ) : (
                    <div className="relative">
                      <CheckCircle2 className="w-16 h-16 opacity-10" />
                    </div>
                  )}
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-sm text-zinc-500">{active ? "Guardian Online" : "System Secure"}</h3>
                    {(!active || status !== "Monitoring Active") && (
                      <p className="text-[10px] opacity-50 font-mono italic">
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
                      // UX Improvement: Optimistic UI Removal
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
          />
        </section>
        <section
          className={clsx(
            "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300",
            view === "diagram" ? "flex" : "hidden"
          )}
        >
            <DiagramView
              filePaths={context?.file_structure}
              rootName={path.split('/').pop()}
              autoExpandAll={context ? context.total_files <= 300 : undefined}
            />
        </section>
      </main>
    </div>
  );
}

function StatMini({ icon, count, label, color }: { icon: React.ReactNode, count: number, label: string, color: string }): ReactElement {
  return (
    <div className="flex items-center gap-2 px-3 border-r border-white/5 last:border-r-0 hover:bg-white/[0.02] transition-colors rounded-md h-8 group cursor-default">
      <div className="group-hover:scale-110 transition-transform">{icon}</div>
      <div className="flex flex-col -space-y-1">
        <span className={clsx("text-sm font-black tabular-nums", color)}>{count}</span>
        <span className="text-[8px] font-bold uppercase tracking-widest opacity-30 group-hover:opacity-60 transition-opacity">{label}</span>
      </div>
    </div>
  )
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
        <span className="text-lg font-black text-emerald-400 tabular-nums">{costUnits}</span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">units</span>
      </div>
      <div className="text-[10px] font-mono text-zinc-500">
        Tokens: {tokens} • Calls: {calls}
      </div>
    </div>
  );
}

function GuardianActivity({ status, compact = false }: { status: string; compact?: boolean }): ReactElement {
  const label = status === "Monitoring Active" ? "Active Scan" : status;
  return (
    <div
      className={clsx("flex flex-col items-center gap-4", compact && "scale-75")}
      data-testid="guardian-activity"
    >
      <div className="guardian-activity">
        <div className="guardian-pulse-ring" />
        <div className="guardian-pulse-ring delay" />
        <div className="guardian-orbit" />
        <div className="guardian-core">
          <Shield className="w-5 h-5 text-sky-300" />
        </div>
      </div>
      {!compact && (
        <div className="text-[10px] uppercase tracking-[0.3em] text-sky-400/70">{label}</div>
      )}
    </div>
  );
}

export default App;
