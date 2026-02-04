import { useState, useEffect, useRef, type ReactElement } from "react";
import { invoke, listen } from "../lib/tauri";
import clsx from "clsx";
import {
    Bot,
    User as UserIcon,
    Activity,
    Send,
    CheckCircle,
    XCircle,
    AlertTriangle,
    HelpCircle,
    X,
    Info,
    Shield,
    Clock,
    LucideIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ReviewDecisionPayload {
    file_path: string;
    status?: "APPROVED" | "MODIFIED";
    diff?: string;
    message?: string;
    decision?: "Approve" | "Reject";
}

interface ChatMessage {
    role: "user" | "guru" | "guardian";
    content: string;
    timestamp?: string; // Added timestamp
    action?: {
        status: "APPROVED" | "MODIFIED";
        file_path: string;
        diff: string;
    };
}

interface ChatViewProps {
    path: string;
    autoPrompt?: string | null;
    onAutoPromptConsumed?: () => void;
}

export function ChatView({ path, autoPrompt, onAutoPromptConsumed }: ChatViewProps): ReactElement {
    const [chatInput, setChatInput] = useState("");
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [appliedFixes, setAppliedFixes] = useState<Set<number>>(new Set());
    const [rejectedFixes, setRejectedFixes] = useState<Set<number>>(new Set());
    const [guideOpen, setGuideOpen] = useState(false);
    const [sessionPaused, setSessionPaused] = useState(false);
    const sessionPausedRef = useRef(false);
    const autoPromptRef = useRef<string | null>(null);

    useEffect(() => {
        sessionPausedRef.current = sessionPaused;
    }, [sessionPaused]);

    useEffect(() => {
        const unlisten = listen<ReviewDecisionPayload>("guardian:review-decision", (event) => {
            if (sessionPausedRef.current) return;
            const payload = event.payload;

            const status = payload.status;
            const diff = payload.diff;
            const message = payload.message;

            if (
                (status === "APPROVED" || status === "MODIFIED") &&
                typeof diff === "string" &&
                typeof message === "string"
            ) {
                setChatHistory(prev => [...prev, {
                    role: "guru",
                    content: message,
                    action: {
                        status,
                        file_path: payload.file_path,
                        diff
                    }
                }]);
                return;
            }

            if (payload.decision) {
                setChatHistory((prev) => [
                    ...prev,
                    {
                        role: "guardian",
                        content: `Decision received for ${payload.file_path}: **${payload.decision}**`,
                        timestamp: new Date().toLocaleTimeString(),
                    },
                ]);
            }
        });

        return () => {
            unlisten.then(f => f());
        };
    }, []);

    const submitPrompt = async (prompt: string, force = false): Promise<void> => {
        if (chatLoading || !prompt.trim()) return;
        if (!force && sessionPausedRef.current) return;

        if (!path) {
            setChatHistory(prev => [
                ...prev,
                {
                    role: "guardian",
                    content: "Select a workspace path to ask the Guru.",
                    timestamp: new Date().toLocaleTimeString(),
                },
            ]);
            return;
        }

        setChatHistory(prev => [...prev, { role: "user", content: prompt }]);
        setChatLoading(true);

        try {
            const answer = await invoke<string>("ask_guru", { path, query: prompt });
            if (!sessionPausedRef.current) {
                setChatHistory(prev => [...prev, { role: "guru", content: answer }]);
            }
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            if (!sessionPausedRef.current) {
                setChatHistory((prev) => [
                    ...prev,
                    {
                        role: "guardian",
                        content: `Guru Error: ${errorMsg}. Ensure local AI server is running.`,
                        timestamp: new Date().toLocaleTimeString(),
                    },
                ]);
            }
        } finally {
            setChatLoading(false);
        }
    };

    const askGuru = async (): Promise<void> => {
        if (sessionPaused || !chatInput.trim() || chatLoading) return;
        const userMsg = chatInput;
        setChatInput("");
        await submitPrompt(userMsg);
    };

    useEffect(() => {
        if (!autoPrompt) return;
        if (autoPromptRef.current === autoPrompt) return;
        autoPromptRef.current = autoPrompt;
        onAutoPromptConsumed?.();

        sessionPausedRef.current = false;
        setSessionPaused(false);
        void submitPrompt(autoPrompt, true);
    }, [autoPrompt, onAutoPromptConsumed]);

    const confirmFix = async (index: number, filePath: string, diff: string): Promise<void> => {
        try {
            if (!path) {
                setChatHistory(prev => [
                    ...prev,
                    {
                        role: "guardian",
                        content: "Cannot apply fix: workspace path is missing.",
                        timestamp: new Date().toLocaleTimeString(),
                    },
                ]);
                return;
            }
            await invoke("confirm_fix", { filePath: filePath, newContent: diff, root: path });
            setAppliedFixes(prev => new Set(prev).add(index));
            setChatHistory(prev => [...prev, { role: "guru", content: `Applied fix to ${filePath.split('/').pop()} successfully! 🚀` }]);
        } catch (e) {
            setChatHistory(prev => [...prev, { role: "guru", content: `Failed to apply fix: ${e}` }]);
        }
    };

    const rejectFix = (index: number, filePath: string): void => {
        setRejectedFixes(prev => new Set(prev).add(index));
        setChatHistory(prev => [
            ...prev,
            {
                role: "guardian",
                content: `Rejected proposed fix for ${filePath.split('/').pop()}.`,
                timestamp: new Date().toLocaleTimeString(),
            },
        ]);
    };

    const toggleSessionPause = (): void => {
        setSessionPaused((prev) => !prev);
    };

    const endSession = (): void => {
        setChatHistory([]);
        setAppliedFixes(new Set());
        setChatInput("");
        setChatLoading(false);
        setSessionPaused(true);
    };

    return (
        <section className="flex-1 flex flex-col bg-background relative overflow-hidden">
            {/* Header with Guide Button */}
            <div className="h-14 border-b border-border-main flex items-center justify-between bg-zinc-50/50 dark:bg-surface/30 px-6 shrink-0">
                <div className="flex items-center gap-3">
                    <Bot className="w-5 h-5 text-zinc-400 dark:text-sky-400" />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Guru Architect</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleSessionPause}
                        className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 transition-all bg-zinc-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 hover:border-zinc-300 dark:hover:border-white/10 cursor-pointer shadow-sm dark:shadow-none"
                    >
                        <Clock className="w-4 h-4" /> {sessionPaused ? "RESUME" : "PAUSE"}
                    </button>
                    <button
                        onClick={endSession}
                        className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400 transition-all bg-rose-50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-white/5 hover:bg-rose-100 dark:hover:bg-white/10 hover:border-rose-300 dark:hover:border-white/10 cursor-pointer shadow-sm dark:shadow-none"
                    >
                        <X className="w-4 h-4" /> END
                    </button>
                    <button
                        onClick={() => setGuideOpen(true)}
                        className="flex items-center gap-2 text-xs font-bold text-zinc-400 dark:text-zinc-500 transition-all bg-zinc-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 hover:border-zinc-300 dark:hover:border-white/10 cursor-pointer shadow-sm dark:shadow-none"
                    >
                        <HelpCircle className="w-4 h-4" /> GUIDE
                    </button>
                </div>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {chatHistory.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 gap-6">
                        <Bot className="w-16 h-16" />
                        <div className="text-center space-y-2">
                            <p className="text-sm font-bold uppercase tracking-tighter text-zinc-500 dark:text-zinc-400">Guru Architect Engine</p>
                            <p className="text-xs font-mono max-w-xs leading-relaxed">
                                I am the Guardian Guru. Accessing project context via RAG-Lite.<br />Ask me anything about your codebase.
                            </p>
                        </div>
                    </div>
                )}

                {chatHistory.map((msg, i) => (
                    <div key={i} className={clsx("flex gap-5 max-w-4xl", msg.role === "user" ? "ml-auto flex-row-reverse" : "")}>
                        <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg", msg.role === "user" ? "bg-white/10" : "bg-sky-600/10 text-sky-400 border border-sky-500/20")}>
                            {msg.role === "user" ? <UserIcon className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                        </div>
                        <div className="flex flex-col gap-3 max-w-full">
                            <div className={clsx("p-5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap font-sans shadow-sm", msg.role === "user" ? "bg-white/5 border border-white/10" : "bg-sky-600/10 border border-sky-500/10 text-text-main")}>
                                {msg.content}
                            </div>

                            {/* Action Block (Smart Review) */}
                            {msg.action && (
                                <div className="flex flex-col items-center justify-center p-12 bg-[var(--guide-bg)] border border-white/5 rounded-[var(--guide-radius)] text-center space-y-8 animate-in fade-in zoom-in duration-700">
                                    <div className="flex items-center gap-2 mb-3">
                                        {msg.action.status === "MODIFIED" ? (
                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                        ) : (
                                            <CheckCircle className="w-4 h-4 text-sky-500" />
                                        )}
                                        <span className={clsx("text-xs font-bold uppercase", msg.action.status === "MODIFIED" ? "text-amber-500" : "text-sky-500")}>
                                            {msg.action.status === "MODIFIED" ? "Guardian Auto-Corrected" : "Verified Safe"}
                                        </span>
                                    </div>

                                    <div className="bg-black/30 rounded p-2 mb-3 max-h-40 overflow-y-auto">
                                        <pre className="text-[10px] font-mono text-white/70 whitespace-pre-wrap">
                                            {msg.action.diff}
                                        </pre>
                                    </div>

                                    <div className="flex gap-2">
                                        {appliedFixes.has(i) ? (
                                            <div className="flex items-center gap-2 text-xs text-sky-500 font-bold bg-sky-500/10 px-3 py-1.5 rounded-md border border-sky-500/20">
                                                <CheckCircle className="w-3 h-3" /> Successfully Applied
                                            </div>
                                        ) : rejectedFixes.has(i) ? (
                                            <div className="flex items-center gap-2 text-xs text-rose-400 font-bold bg-rose-500/10 px-3 py-1.5 rounded-md border border-rose-500/20">
                                                <XCircle className="w-3 h-3" /> Rejected
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => confirmFix(i, msg.action!.file_path, msg.action!.diff)}
                                                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded-md shadow-lg shadow-sky-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <CheckCircle className="w-3 h-3" /> Confirm & Apply
                                                </button>
                                                <button
                                                    onClick={() => rejectFix(i, msg.action!.file_path)}
                                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 text-xs rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <XCircle className="w-3 h-3" /> Reject
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {chatLoading && (
                    <div className="flex gap-4 max-w-3xl">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 animate-pulse">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="p-4 rounded-2xl bg-sky-500/5 border border-sky-500/10 text-xs font-mono text-sky-400 flex items-center gap-2">
                            <Activity className="w-3 h-3 animate-spin" /> Thinking...
                        </div>
                    </div>
                )}
            </div>

            {/* Usage Guide Popup - Premium Overhaul */}
            <AnimatePresence>
                {guideOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-white/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 30 }}
                            className="bg-white dark:bg-[#0c0c0e] border border-black/10 dark:border-white/10 w-full max-w-lg rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative overflow-hidden flex flex-col"
                        >
                            {/* Aurora Mesh Gradient Accents */}
                            <div className="absolute -top-32 -left-32 w-80 h-80 bg-amber-500/10 dark:bg-amber-600/20 blur-[100px] rounded-full mix-blend-screen" />
                            <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-sky-500/10 dark:bg-sky-600/20 blur-[100px] rounded-full mix-blend-screen" />

                            <div className="p-7 md:p-8 space-y-7 relative z-10">
                                {/* Header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className="p-4 bg-amber-600/10 dark:bg-amber-600/20 rounded-[1.25rem] text-amber-600 dark:text-amber-400 shadow-inner">
                                            <Shield className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">Guardian Guru</h3>
                                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Hybrid Autonomous Engineering Protocol</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setGuideOpen(false)}
                                        className="p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all active:scale-90 cursor-pointer"
                                    >
                                        <X className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
                                    </button>
                                </div>

                                {/* Content Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    <GuideOption
                                        icon={Shield}
                                        title="Guardian Sentry"
                                        desc="Monitors your code in real-time. Instantly locks the system on critical violations."
                                        color="sky"
                                        onClick={() => { }} // Added onClick as per new interface
                                    />
                                    <GuideOption
                                        icon={Bot}
                                        title="Guru Architect"
                                        desc="Architectural intelligence. Autonomously cleans technical debt found by Guardian."
                                        color="sky"
                                        onClick={() => { }} // Added onClick as per new interface
                                    />
                                    <GuideOption
                                        icon={Clock}
                                        title="Hard Lock"
                                        desc="Development is blocked until critical issues are resolved, enforcing a safe cycle."
                                        color="rose"
                                        onClick={() => { }} // Added onClick as per new interface
                                    />
                                    <GuideOption
                                        icon={Info}
                                        title="Plan-Driven"
                                        desc="Ingests 'PLAN-*.md' files to ensure code aligns with your original design intent."
                                        color="amber"
                                        onClick={() => { }} // Added onClick as per new interface
                                    />
                                </div>

                                {/* Steps / Usage */}
                                <div className="bg-zinc-50 dark:bg-white/[0.03] p-6 rounded-2xl border border-black/5 dark:border-white/5 space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">Operational Steps</h4>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="flex items-start gap-4 text-xs">
                                            <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[9px] font-black shrink-0 shadow-lg shadow-amber-500/40">1</div>
                                            <p className="font-medium text-zinc-600 dark:text-zinc-300">Guardian locks the system when a critical violation is detected in the workspace.</p>
                                        </div>
                                        <div className="flex items-start gap-4 text-xs">
                                            <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[9px] font-black shrink-0 shadow-lg shadow-amber-500/40">2</div>
                                            <p className="font-medium text-zinc-600 dark:text-zinc-300">Request analysis and a patch (fix) from the Guru Architect to resolve the issue.</p>
                                        </div>
                                        <div className="flex items-start gap-4 text-xs">
                                            <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[9px] font-black shrink-0 shadow-lg shadow-amber-500/40">3</div>
                                            <p className="font-medium text-zinc-600 dark:text-zinc-300">On your confirmation, Antigravity applies the fix while respecting project architecture.</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setGuideOpen(false)}
                                    className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-black rounded-xl hover:opacity-90 transition-all active:scale-[0.98] shadow-2xl shadow-amber-500/20 cursor-pointer"
                                >
                                    START PROTOCOL
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="p-6 border-t border-border-main bg-surface/50 backdrop-blur-xl">
                <div className="relative">
                    <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && askGuru()}
                        placeholder={sessionPaused ? "Session paused. Resume to continue." : "Ask the Guru about logical flows, architecture, or resolving STALLs..."}
                        className="w-full bg-background border border-border-main rounded-2xl py-5 pl-6 pr-14 text-sm font-sans outline-none focus:border-blue-500/50 transition-all placeholder:opacity-30 shadow-inner"
                        disabled={sessionPaused}
                    />
                    <button
                        onClick={askGuru}
                        className="absolute right-3 top-3 p-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-colors shadow-lg shadow-sky-500/20 cursor-pointer"
                        disabled={chatLoading || sessionPaused}
                        aria-label={chatLoading ? "Sending" : "Send"}
                    >
                        {chatLoading ? <X className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </section>
    );
}

interface GuideOptionProps {
    icon: LucideIcon;
    title: string;
    desc: string;
    color: "sky" | "rose" | "amber";
    onClick: () => void;
}

function GuideOption({ icon: Icon, title, desc, color, onClick }: GuideOptionProps): ReactElement {
    const colorStyles = {
        sky: "bg-sky-600/10 text-sky-600 dark:text-sky-400 group-hover:bg-sky-600 dark:group-hover:text-white",
        rose: "bg-rose-600/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 dark:group-hover:text-white",
        amber: "bg-amber-600/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 dark:group-hover:text-white",
    };

    return (
        <div className="flex gap-4 group p-1 cursor-pointer" onClick={onClick}>
            <div className={clsx(
                "shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border border-black/5 dark:border-white/5 transition-all duration-500 shadow-sm",
                colorStyles[color]
            )}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="space-y-1 py-0.5">
                <h5 className="text-sm font-black text-zinc-900 dark:text-white group-hover:translate-x-1 transition-transform duration-300">{title}</h5>
                <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 font-semibold">{desc}</p>
            </div>
        </div>
    )
}
