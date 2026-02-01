import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
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

function App() {
  const [active, setActive] = useState(false);
  const [logs, setLogs] = useState<Record<string, Critique>>({});
  const [status, setStatus] = useState("Idle");
  const [path, setPath] = useState("/Users/dogan/Desktop/new-idee");
  const [filter, setFilter] = useState<string>("");
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [stalled, setStalled] = useState<{ file: string, reason: string } | null>(null);
  const [usage, setUsage] = useState({ tokens: 0, calls: 0 });
  const [context, setContext] = useState<ProjectContext | null>(null);

  // Executive Feature: Export to PDF
  const exportToPDF = () => {
    // Note: jspdf is imported dynamically to avoid SSR/Initial load weight if needed, 
    // but in Tauri it's fine. We use the installed package.
    import("jspdf").then(({ jsPDF }) => {
      const doc = new jsPDF();

      doc.setFontSize(22);
      doc.text("GUARDIAN: Security Audit Report", 20, 20);
      doc.setFontSize(12);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
      doc.text(`Scope: ${path}`, 20, 38);
      doc.line(20, 42, 190, 42);

      let y = 55;
      const issueArray = Object.values(logs);

      if (issueArray.length === 0) {
        doc.text("No active security violations detected. System is SECURE.", 20, y);
      } else {
        issueArray.forEach((issue, index) => {
          if (y > 260) { doc.addPage(); y = 20; }

          doc.setFontSize(14);
          if (issue.severity === "Critical") {
            doc.setTextColor(200, 0, 0); // Red for Critical
          } else if (issue.severity === "Warning") {
            doc.setTextColor(218, 165, 32); // Goldenrod for Warning
          } else {
            doc.setTextColor(0, 0, 0); // Black for Info
          }
          doc.text(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.file_path.split('/').pop()}`, 20, y);

          doc.setFontSize(10);
          doc.setTextColor(100);
          y += 7;
          const splitMsg = doc.splitTextToSize(`Message: ${issue.message}`, 170);
          doc.text(splitMsg, 20, y);
          y += (splitMsg.length * 5) + 4;

          if (issue.suggestion) {
            doc.setTextColor(0, 100, 0);
            const splitSugg = doc.splitTextToSize(`Suggestion: ${issue.suggestion}`, 170);
            doc.text(splitSugg, 20, y);
            y += (splitSugg.length * 5) + 10;
          }
        });
      }

      doc.save(`Guardian_Audit_${Date.now()}.pdf`);
      alert('✅ PDF Exported Successfully!');
    });
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

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  const selectScope = async () => {
    try {
      const selected = await open({
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
    // Strict Typing (SPAP v2.2): Use Array<Promise<UnlistenFn>>
    const unlisteners: Array<Promise<UnlistenFn>> = [];

    const setupListeners = async () => {
      unlisteners.push(listen<Critique>("guardian:critique", (event) => {
        setLogs((prev) => ({
          ...prev,
          [event.payload.file_path]: event.payload
        }));
        setStatus("Monitoring Active");
      }));

      unlisteners.push(listen<string>("guardian:clear", (event) => {
        setLogs((prev) => {
          const newLogs = { ...prev };
          delete newLogs[event.payload];
          return newLogs;
        });
      }));

      unlisteners.push(listen<string>("guardian:analyzing", (event) => {
        const fileName = event.payload.split('/').pop() || "File";
        setStatus(`Analyzing: ${fileName}`);
      }));

      unlisteners.push(listen<string>("guardian:error", (event) => {
        setLogs((prev) => ({
          ...prev,
          ["System"]: { file_path: "System Error", severity: "Critical", message: event.payload }
        }));
      }));

      unlisteners.push(listen<{ file_path: string, reason: string }>("guardian:stall-requested", (event) => {
        setStalled({ file: event.payload.file_path, reason: event.payload.reason });
      }));

      unlisteners.push(listen<string>("guardian:stall-released", () => {
        setStalled(null);
      }));

      unlisteners.push(listen<{ tokens: number, calls: number }>("guardian:usage", (event) => {
        setUsage(prev => ({
          tokens: prev.tokens + event.payload.tokens,
          calls: prev.calls + event.payload.calls
        }));
      }));
    };

    setupListeners();

    // Health Check: Verify backend is alive
    invoke("search_web", { query: "ping" }).catch(e => {
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
      // Clean cleanup without 'any' casting
      unlisteners.forEach(p => p.then(f => f()));
    };
  }, []); // Stable: Only runs once

  // Proactive Context Refresh (SPAP v2.2): Update whenever path changes
  useEffect(() => {
    if (!path) return;
    const updateContext = async () => {
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

  const toggleMonitoring = async () => {
    if (active) {
      setActive(false);
      setStatus("Paused");
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

  const filteredLogs = useMemo(() => {
    const entries = Object.values(logs);
    if (!filter) return entries;
    return entries.filter(l =>
      l.file_path.toLowerCase().includes(filter.toLowerCase()) ||
      l.message.toLowerCase().includes(filter.toLowerCase())
    );
  }, [logs, filter]);

  const stats = useMemo(() => {
    const vals = Object.values(logs);
    return {
      critical: vals.filter(v => v.severity === "Critical").length,
      warning: vals.filter(v => v.severity === "Warning").length,
      info: vals.filter(v => v.severity === "Info").length,
      total: vals.length
    };
  }, [logs]);

  return (
    <div className="flex h-screen w-full bg-background text-text-main flex-col font-sans overflow-hidden transition-colors duration-300">
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

      {/* CLOCKWORK EVOLUTION: Hard Lock Banner */}
      {stalled && (
        <div className="bg-rose-600 text-white px-6 py-2 flex items-center justify-between text-xs font-bold animate-in slide-in-from-top duration-500 z-30">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-4 h-4 animate-pulse" />
            <span>SYSTEM STALLED: Critical violation detected in {stalled.file.split('/').pop()}</span>
            <span className="opacity-70 font-normal ml-4">Antigravity execution is paused until a fix is approved.</span>
          </div>
          <button
            onClick={() => setView("chat")}
            className="px-3 py-1 bg-white text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
          >
            RESOLVE IN GURU
          </button>
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
                  readOnly
                  onClick={selectScope}
                  className="w-full bg-background border border-border-main rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-opacity-100 transition-all placeholder:opacity-50 cursor-pointer hover:bg-border-main"
                  value={path}
                />
              </div>
            </div>

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
              <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">Model: {active ? "GEMINI-V3-FLASH" : "STANDBY"}</p>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div className={clsx("h-full transition-all duration-1000", active ? "w-full bg-zinc-100" : "w-0 bg-zinc-700")} />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-background/50 border border-border-main space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-cyan-400" />
                  <span className="text-[10px] font-bold opacity-60 uppercase">Vibe Usage</span>
                </div>
                <span className="text-[10px] font-mono text-cyan-400">{usage.calls} calls</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                  style={{ width: `${Math.min((usage.calls / 100) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[8px] text-zinc-500 font-mono italic">Efficiency: {active ? "Logic-Filter Active" : "Standby"}</p>
            </div>

            <button
              onClick={toggleMonitoring}
              className={clsx(
                "w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all duration-300 transform active:scale-95 cursor-pointer",
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
            "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300",
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

            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-1">
              {filteredLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-6">
                  <div className="relative">
                    <CheckCircle2 className="w-16 h-16 opacity-10" />
                    {active && <div className="absolute inset-0 bg-zinc-100/10 blur-3xl rounded-full" />}
                  </div>
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-sm text-zinc-500">System Secure</h3>
                    <p className="text-[10px] opacity-50 font-mono italic">{active ? "Watching for anomalies..." : "Guardian is offline."}</p>
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
          <ChatView path={path} />
        </section>
        <section
          className={clsx(
            "flex-1 overflow-hidden p-0 flex flex-col bg-background transition-colors duration-300",
            view === "diagram" ? "flex" : "hidden"
          )}
        >
            <DiagramView filePaths={context?.file_structure} rootName={path.split('/').pop()} />
        </section>
      </main>
    </div>
  );
}

function StatMini({ icon, count, label, color }: { icon: React.ReactNode, count: number, label: string, color: string }) {
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

export default App;
