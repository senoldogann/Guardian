import { useState, useEffect, useRef, useCallback, type ReactElement, type ReactNode, isValidElement, useMemo } from "react";
import { FixedSizeList as List, ListChildComponentProps } from "react-window";
import { invoke, listen, isTauriRuntime } from "../lib/tauri";
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
    Copy,
    LucideIcon,
    Trash2,
    Globe
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";

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
    timestamp?: string; // ISO timestamp
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
    webSearchEnabled: boolean;
    onWebSearchToggle: () => void;
    webSearchReady: boolean;
}

export function ChatView({
    path,
    autoPrompt,
    onAutoPromptConsumed,
    webSearchEnabled,
    onWebSearchToggle,
    webSearchReady,
}: ChatViewProps): ReactElement {
    const [chatInput, setChatInput] = useState("");
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [chatLoadError, setChatLoadError] = useState<string | null>(null);
    const [appliedFixes, setAppliedFixes] = useState<Set<number>>(new Set());
    const [rejectedFixes, setRejectedFixes] = useState<Set<number>>(new Set());
    const [guideOpen, setGuideOpen] = useState(false);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const ignoreResponseRef = useRef(false);
    const autoPromptRef = useRef<string | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const forceScrollRef = useRef(false);
    const isDesktop = isTauriRuntime();
    const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

    const storageKey = path ? `guardian_chat_${path}` : null;

    const formatTimestamp = (value?: string): string => {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString(undefined, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    const nowIso = useCallback((): string => new Date().toISOString(), []);

    const extractText = useCallback((node: ReactNode): string => {
        if (typeof node === "string") return node;
        if (Array.isArray(node)) return node.map(extractText).join("");
        if (isValidElement(node)) {
            const props = node.props as { children?: ReactNode };
            return extractText(props.children);
        }
        return "";
    }, []);

    const handleCopy = useCallback(async (text: string) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedSnippet(text);
            setTimeout(() => setCopiedSnippet(prev => (prev === text ? null : prev)), 1500);
        } catch {
            // ignore
        }
    }, []);

    const shouldAutoScroll = useCallback((): boolean => {
        const el = scrollAreaRef.current;
        if (!el) return true;
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        return distance < 120;
    }, []);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
        bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    }, []);

    const compactHistory = useCallback((history: ChatMessage[]): ChatMessage[] => {
        const MAX_USER_GURU = 120;
        const MAX_SYSTEM = 20;
        const MAX_CONTENT = 4000;
        const MAX_DIFF = 1500;

        const indexed = history.map((msg, index) => ({ msg, index }));
        const userGuru = indexed.filter(item => item.msg.role !== "guardian").slice(-MAX_USER_GURU);
        const system = indexed.filter(item => item.msg.role === "guardian").slice(-MAX_SYSTEM);
        const merged = [...userGuru, ...system]
            .sort((a, b) => a.index - b.index)
            .map(({ msg }) => {
                const trimmedContent =
                    msg.content.length > MAX_CONTENT
                        ? `${msg.content.slice(0, MAX_CONTENT)}…`
                        : msg.content;
                const trimmedAction = msg.action
                    ? {
                        ...msg.action,
                        diff: msg.action.diff.length > MAX_DIFF
                            ? `${msg.action.diff.slice(0, MAX_DIFF)}…`
                            : msg.action.diff,
                    }
                    : undefined;
                return {
                    ...msg,
                    content: trimmedContent,
                    action: trimmedAction,
                } as ChatMessage;
            });
        return merged;
    }, []);

    const normalizeMessage = useCallback((message: ChatMessage): ChatMessage => {
        return compactHistory([message])[0] ?? message;
    }, [compactHistory]);

    const persistLocal = useCallback((message: ChatMessage): void => {
        if (!storageKey) return;
        try {
            const raw = localStorage.getItem(storageKey);
            const existing = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
            const next = compactHistory([...existing, message]);
            localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
            // ignore local storage failures
        }
    }, [compactHistory, storageKey]);

    const appendMessage = useCallback((message: ChatMessage): void => {
        const normalized = normalizeMessage(message);
        setChatHistory(prev => [...prev, normalized]);

        if (isDesktop) {
            if (!path) return;
            void invoke("append_chat_message", { path, message: normalized }).catch(() => { });
        } else {
            persistLocal(normalized);
        }
    }, [isDesktop, normalizeMessage, path, persistLocal]);

    useEffect(() => {
        if (!path) {
            setChatHistory([]);
            return;
        }

        if (!isDesktop) {
            if (!storageKey) return;
            try {
                const raw = localStorage.getItem(storageKey);
                const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
                setChatHistory(Array.isArray(parsed) ? parsed : []);
                setChatLoadError(null);
            } catch {
                setChatHistory([]);
                setChatLoadError("Chat history could not be loaded from local storage.");
            }
            return;
        }

        let active = true;
        void (async () => {
            try {
                const history = await invoke<ChatMessage[]>("get_chat_history", { path, limit: 500, offset: 0 });
                if (active) {
                    if (Array.isArray(history)) {
                        setChatHistory(history);
                        setChatLoadError(null);
                    } else {
                        setChatHistory([]);
                        setChatLoadError("Chat history could not be loaded. Invalid response.");
                    }
                }
            } catch {
                if (active) {
                    setChatHistory([]);
                    setChatLoadError("Chat history could not be loaded. Please try again.");
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [path, isDesktop, storageKey]);

    useEffect(() => {
        const unlisten = listen<ReviewDecisionPayload>("guardian:review-decision", (event) => {
            const payload = event.payload;

            const status = payload.status;
            const diff = payload.diff;
            const message = payload.message;

            if (
                (status === "APPROVED" || status === "MODIFIED") &&
                typeof diff === "string" &&
                typeof message === "string"
            ) {
                appendMessage({
                    role: "guru",
                    content: message,
                    timestamp: nowIso(),
                    action: {
                        status,
                        file_path: payload.file_path,
                        diff
                    }
                });
                return;
            }

            if (payload.decision) {
                appendMessage({
                    role: "guardian",
                    content: `Decision received for ${payload.file_path}: **${payload.decision}**`,
                    timestamp: nowIso(),
                });
            }
        });

        return () => {
            unlisten.then(f => f());
        };
    }, [appendMessage, nowIso]);

    const submitPrompt = async (prompt: string): Promise<void> => {
        if (chatLoading || !prompt.trim()) return;

        if (!path) {
            appendMessage({
                role: "guardian",
                content: "Select a workspace path to ask the Guru.",
                timestamp: nowIso(),
            });
            return;
        }

        forceScrollRef.current = true;
        appendMessage({ role: "user", content: prompt, timestamp: nowIso() });
        ignoreResponseRef.current = false;
        setChatLoading(true);

        try {
            const useWebSearch = webSearchEnabled && webSearchReady;
            const answer = await invoke<string>("ask_guru", { path, query: prompt, webSearch: useWebSearch });
            if (ignoreResponseRef.current) return;
            appendMessage({ role: "guru", content: answer, timestamp: nowIso() });
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            if (ignoreResponseRef.current) return;
            appendMessage({
                role: "guardian",
                content: `Guru Error: ${errorMsg}. Ensure local AI server is running.`,
                timestamp: nowIso(),
            });
        } finally {
            setChatLoading(false);
        }
    };

    const askGuru = async (): Promise<void> => {
        if (!chatInput.trim() || chatLoading) return;
        const userMsg = chatInput;
        setChatInput("");
        await submitPrompt(userMsg);
    };

    const cancelPending = (): void => {
        if (!chatLoading) return;
        ignoreResponseRef.current = true;
        setChatLoading(false);
    };

    const handleClearChat = async (): Promise<void> => {
        if (!path) return;
        if (isDesktop) {
            try {
                await invoke("clear_chat_history", { path });
            } catch {
                // ignore failure; fall back to UI clear
            }
        } else if (storageKey) {
            try {
                localStorage.removeItem(storageKey);
            } catch {
                // ignore
            }
        }
        setChatHistory([]);
        setAppliedFixes(new Set());
        setRejectedFixes(new Set());
        setClearConfirmOpen(false);
    };

    useEffect(() => {
        if (!autoPrompt) return;
        if (autoPromptRef.current === autoPrompt) return;
        autoPromptRef.current = autoPrompt;
        onAutoPromptConsumed?.();

        forceScrollRef.current = true;
        void submitPrompt(autoPrompt);
    }, [autoPrompt, onAutoPromptConsumed]);

    const confirmFix = useCallback(async (index: number, filePath: string, diff: string): Promise<void> => {
        try {
            if (!path) {
                appendMessage({
                    role: "guardian",
                    content: "Cannot apply fix: workspace path is missing.",
                    timestamp: nowIso(),
                });
                return;
            }
            await invoke("confirm_fix", { filePath: filePath, newContent: diff, root: path });
            setAppliedFixes(prev => new Set(prev).add(index));
            appendMessage({ role: "guru", content: `Applied fix to ${filePath.split('/').pop()} successfully! 🚀`, timestamp: nowIso() });
        } catch (e) {
            appendMessage({ role: "guru", content: `Failed to apply fix: ${e}`, timestamp: nowIso() });
        }
    }, [path, appendMessage, nowIso]);

    const rejectFix = useCallback((index: number, filePath: string): void => {
        setRejectedFixes(prev => new Set(prev).add(index));
        appendMessage({
            role: "guardian",
            content: `Rejected proposed fix for ${filePath.split('/').pop()}.`,
            timestamp: nowIso(),
        });
    }, [appendMessage, nowIso]);

    // Virtualized chat history - show last 50 messages with lazy loading
    const visibleMessages = useMemo(() => {
        const MAX_VISIBLE = 50;
        if (chatHistory.length <= MAX_VISIBLE) return chatHistory;
        return chatHistory.slice(-MAX_VISIBLE);
    }, [chatHistory]);

    const messageStartIndex = useMemo(() => {
        const MAX_VISIBLE = 50;
        return Math.max(0, chatHistory.length - MAX_VISIBLE);
    }, [chatHistory.length]);

    const ChatRow = useCallback(({ index, style }: ListChildComponentProps) => {
        const actualIndex = messageStartIndex + index;
        const msg = visibleMessages[index];
        return (
            <div style={style}>
                <ChatMessageRow
                    msg={msg}
                    index={actualIndex}
                    appliedFixes={appliedFixes}
                    rejectedFixes={rejectedFixes}
                    copiedSnippet={copiedSnippet}
                    onCopy={handleCopy}
                    onConfirmFix={confirmFix}
                    onRejectFix={rejectFix}
                    extractText={extractText}
                    formatTimestamp={formatTimestamp}
                />
            </div>
        );
    }, [visibleMessages, messageStartIndex, appliedFixes, rejectedFixes, copiedSnippet, handleCopy, confirmFix, rejectFix, extractText, formatTimestamp]);

    useEffect(() => {
        if (!chatHistory.length && !chatLoading) {
            if (scrollAreaRef.current) {
                scrollAreaRef.current.scrollTop = 0;
            }
            forceScrollRef.current = false;
            return;
        }
        if (forceScrollRef.current || shouldAutoScroll()) {
            scrollToBottom(forceScrollRef.current ? "smooth" : "auto");
            forceScrollRef.current = false;
        }
    }, [chatHistory.length, chatLoading, scrollToBottom, shouldAutoScroll]);

    return (
        <section className="flex-1 flex flex-col bg-background relative overflow-hidden">
            {/* Header with Guide Button */}
            <div className="guardian-topbar justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <Bot className="w-5 h-5 text-text-muted dark:text-[var(--accent-500)]" />
                    <h2 className="guardian-topbar-text">Guru Architect</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setGuideOpen(true)}
                        className="flex items-center gap-2 text-xs font-bold text-text-main transition-all bg-[var(--surface)] px-3 py-1.5 rounded-lg border border-border-main hover:bg-border-main cursor-pointer shadow-sm"
                    >
                        <HelpCircle className="w-4 h-4" /> GUIDE
                    </button>
                    <button
                        onClick={() => setClearConfirmOpen(true)}
                        className="flex items-center gap-2 text-xs font-bold text-text-main transition-all bg-[var(--surface)] px-3 py-1.5 rounded-lg border border-border-main hover:bg-border-main cursor-pointer shadow-sm"
                        disabled={chatHistory.length === 0}
                    >
                        <Trash2 className="w-4 h-4" /> CLEAR
                    </button>
                </div>
            </div>
            {clearConfirmOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <div className="max-w-sm w-[90%] bg-surface border border-border-main rounded-2xl p-5 shadow-2xl">
                        <div className="text-sm font-bold uppercase tracking-widest text-text-main mb-2">Are you sure?</div>
                        <p className="text-xs text-text-muted">
                            This will permanently delete the current chat history for this workspace.
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={() => setClearConfirmOpen(false)}
                                className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 text-text-main rounded-md transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearChat}
                                className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat History */}
            <div
                ref={scrollAreaRef}
                className={clsx(
                    "flex-1 p-6 space-y-8 custom-scrollbar",
                    chatHistory.length === 0 && !chatLoading ? "overflow-y-hidden" : "overflow-y-auto"
                )}
            >
                {chatLoadError && (
                    <div className="text-[10px] text-rose-400">
                        {chatLoadError}
                    </div>
                )}
                {chatHistory.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 gap-6">
                        <Bot className="w-16 h-16" />
                        <div className="text-center space-y-2">
                            <p className="text-sm font-bold uppercase tracking-tighter text-text-muted">Guru Architect Engine</p>
                            <p className="text-xs font-mono max-w-xs leading-relaxed">
                                I am the Guardian Guru. Accessing project context via RAG-Lite.<br />Ask me anything about your codebase.
                            </p>
                        </div>
                        <div className="guru-placeholder" aria-hidden="true">
                            <div className="guru-placeholder-bar" />
                            <div className="guru-placeholder-bar medium" />
                            <div className="guru-placeholder-bar short" />
                        </div>
                    </div>
                )}

                {chatHistory.length > 0 && (
                    <List
                        height={window.innerHeight - 280}
                        itemCount={visibleMessages.length}
                        itemSize={120}
                        width="100%"
                    >
                        {ChatRow}
                    </List>
                )}

                {chatLoading && (
                    <div className="flex gap-4 max-w-3xl">
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-[var(--accent-200)] text-[var(--accent-500)] flex items-center justify-center shrink-0 animate-pulse shadow-sm">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="p-4 rounded-2xl bg-white dark:bg-[var(--accent-200)] text-xs font-mono text-[var(--accent-500)] flex items-center gap-2 shadow-sm">
                            <Activity className="w-3 h-3 animate-spin" /> Thinking...
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Usage Guide Popup - Theme Aligned */}
            <AnimatePresence>
                {guideOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-background/70 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 30 }}
                            className="bg-surface border border-border-main w-full max-w-lg rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative overflow-hidden flex flex-col"
                        >
                            {/* Aurora Mesh Gradient Accents */}
                            <div className="absolute -top-32 -left-32 w-80 h-80 bg-[var(--accent-200)] blur-[100px] rounded-full opacity-70" />
                            <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-[var(--accent-200)] blur-[100px] rounded-full opacity-50" />

                            <div className="p-7 md:p-8 space-y-7 relative z-10">
                                {/* Header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className="p-4 bg-[var(--accent-200)] rounded-[1.25rem] text-[var(--accent-500)] shadow-inner">
                                            <Shield className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black tracking-tight text-text-main">Guardian Guru</h3>
                                            <p className="text-xs font-medium text-text-muted">Hybrid Autonomous Engineering Protocol</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setGuideOpen(false)}
                                        className="p-3 hover:bg-[var(--accent-200)]/60 rounded-2xl transition-all active:scale-90 cursor-pointer"
                                    >
                                        <X className="w-6 h-6 text-text-muted" />
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
                                <div className="bg-background p-6 rounded-2xl border border-border-main space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Operational Steps</h4>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="flex items-start gap-4 text-xs">
                                            <div className="w-5 h-5 rounded-full bg-[var(--accent-500)] text-background flex items-center justify-center text-[9px] font-black shrink-0 shadow-lg shadow-black/20">1</div>
                                            <p className="font-medium text-text-muted">Guardian locks the system when a critical violation is detected in the workspace.</p>
                                        </div>
                                        <div className="flex items-start gap-4 text-xs">
                                            <div className="w-5 h-5 rounded-full bg-[var(--accent-500)] text-background flex items-center justify-center text-[9px] font-black shrink-0 shadow-lg shadow-black/20">2</div>
                                            <p className="font-medium text-text-muted">Request analysis and a patch (fix) from the Guru Architect to resolve the issue.</p>
                                        </div>
                                        <div className="flex items-start gap-4 text-xs">
                                            <div className="w-5 h-5 rounded-full bg-[var(--accent-500)] text-background flex items-center justify-center text-[9px] font-black shrink-0 shadow-lg shadow-black/20">3</div>
                                            <p className="font-medium text-text-muted">On your confirmation, Antigravity applies the fix while respecting project architecture.</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setGuideOpen(false)}
                                    className="w-full py-4 bg-[var(--accent-500)] text-background text-sm font-black rounded-xl hover:opacity-90 transition-all active:scale-[0.98] shadow-2xl shadow-black/20 cursor-pointer"
                                >
                                    START PROTOCOL
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="p-6 border-t border-border-main bg-background space-y-2">
                <div className="relative">
                    <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && askGuru()}
                        placeholder="Ask the Guru about logical flows, architecture, or resolving STALLs..."
                        className="w-full bg-background border border-border-main rounded-2xl py-5 pl-6 pr-28 text-sm font-sans outline-none focus:border-[var(--focus-border)] transition-all placeholder:opacity-30 shadow-inner"
                    />
                    <div className="absolute right-3 top-3 flex items-center gap-2">
                        <button
                            onClick={onWebSearchToggle}
                            disabled={!webSearchReady}
                            title={webSearchReady ? "Toggle web search" : "Add Tavily key in Settings to enable web search"}
                            className={clsx(
                                "p-3 rounded-xl transition-colors shadow-lg shadow-black/20",
                                webSearchEnabled
                                    ? "bg-[var(--accent-500)] text-background"
                                    : "bg-[var(--surface)] text-text-main border border-border-main",
                                !webSearchReady && "opacity-40 cursor-not-allowed"
                            )}
                        >
                            <Globe className="w-5 h-5" />
                        </button>
                        <button
                            onClick={chatLoading ? cancelPending : askGuru}
                            className="p-3 bg-[var(--accent-500)] hover:opacity-90 text-background rounded-xl transition-colors shadow-lg shadow-black/30 cursor-pointer"
                            disabled={!chatInput.trim() && !chatLoading}
                            aria-label={chatLoading ? "Cancel" : "Send"}
                        >
                            {chatLoading ? <X className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                {!webSearchReady && (
                    <div className="text-[10px] text-amber-400">
                        Add your Tavily key in Settings to enable web search.
                    </div>
                )}
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
        sky: "bg-[var(--accent-200)] text-[var(--accent-500)] group-hover:bg-[var(--accent-500)] group-hover:text-background",
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
                <p className="text-[11px] leading-relaxed text-text-muted font-semibold">{desc}</p>
            </div>
        </div>
    )
}

// Virtualized Chat Message Row Component
interface ChatMessageRowProps {
    msg: ChatMessage;
    index: number;
    appliedFixes: Set<number>;
    rejectedFixes: Set<number>;
    copiedSnippet: string | null;
    onCopy: (text: string) => void;
    onConfirmFix: (index: number, filePath: string, diff: string) => Promise<void>;
    onRejectFix: (index: number, filePath: string) => void;
    extractText: (node: ReactNode) => string;
    formatTimestamp: (value?: string) => string;
}

function ChatMessageRow({
    msg,
    index,
    appliedFixes,
    rejectedFixes,
    copiedSnippet,
    onCopy,
    onConfirmFix,
    onRejectFix,
    extractText,
    formatTimestamp
}: ChatMessageRowProps): ReactElement {
    return (
        <div className={clsx("flex gap-5 max-w-4xl", msg.role === "user" ? "ml-auto flex-row-reverse" : "")}>
            <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", msg.role === "user" ? "bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-white/80" : "bg-white dark:bg-[var(--accent-200)] text-[var(--accent-500)]")}>
                {msg.role === "user" ? <UserIcon className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>
            <div className="flex flex-col gap-3 max-w-full">
                <div className={clsx("p-5 rounded-2xl text-sm leading-relaxed font-sans shadow-sm", msg.role === "user" ? "bg-white dark:bg-white/5 text-text-main" : "bg-white dark:bg-white/5 text-text-main")}>
                    <div className="guardian-markdown">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight, rehypeSanitize]}
                            components={{
                                pre: ({ children }) => {
                                    const text = extractText(children);
                                    return (
                                        <div className="guardian-code-block">
                                            <button
                                                className="guardian-copy-btn"
                                                onClick={() => onCopy(text)}
                                                title="Copy code"
                                            >
                                                <Copy className="w-3 h-3" />
                                                {copiedSnippet === text ? "Copied" : "Copy"}
                                            </button>
                                            <pre>{children}</pre>
                                        </div>
                                    );
                                },
                            }}
                        >
                            {msg.content}
                        </ReactMarkdown>
                    </div>
                    {msg.timestamp && (
                        <div className={clsx("mt-3 text-[10px] text-text-muted/80", msg.role === "user" ? "text-right" : "text-left")}>
                            {formatTimestamp(msg.timestamp)}
                        </div>
                    )}
                </div>

                {msg.action && (
                    <div className="flex flex-col items-center justify-center p-12 bg-[var(--guide-bg)] border border-white/5 rounded-[var(--guide-radius)] text-center space-y-8 animate-in fade-in zoom-in duration-700">
                        <div className="flex items-center gap-2 mb-3">
                            {msg.action.status === "MODIFIED" ? (
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                            ) : (
                                <CheckCircle className="w-4 h-4 text-[var(--accent-500)]" />
                            )}
                            <span className={clsx("text-xs font-bold uppercase", msg.action.status === "MODIFIED" ? "text-amber-500" : "text-[var(--accent-500)]")}>
                                {msg.action.status === "MODIFIED" ? "Guardian Auto-Corrected" : "Verified Safe"}
                            </span>
                        </div>

                        <div className="bg-black/10 dark:bg-black/30 rounded p-2 mb-3 max-h-40 overflow-y-auto border border-border-main">
                            <pre className="text-[10px] font-mono text-[color:var(--text-main)] opacity-80 whitespace-pre-wrap">
                                {msg.action.diff}
                            </pre>
                        </div>

                        <div className="flex gap-2">
                            {appliedFixes.has(index) ? (
                                <div className="flex items-center gap-2 text-xs text-[var(--accent-500)] font-bold bg-[var(--accent-200)] px-3 py-1.5 rounded-md border border-[var(--accent-400)]">
                                    <CheckCircle className="w-3 h-3" /> Successfully Applied
                                </div>
                            ) : rejectedFixes.has(index) ? (
                                <div className="flex items-center gap-2 text-xs text-rose-400 font-bold bg-rose-500/10 px-3 py-1.5 rounded-md border border-rose-500/20">
                                    <XCircle className="w-3 h-3" /> Rejected
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => onConfirmFix(index, msg.action!.file_path, msg.action!.diff)}
                                        className="px-3 py-1.5 bg-[var(--accent-500)] hover:opacity-90 text-background text-xs rounded-md shadow-lg shadow-black/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <CheckCircle className="w-3 h-3" /> Confirm & Apply
                                    </button>
                                    <button
                                        onClick={() => onRejectFix(index, msg.action!.file_path)}
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
    );
}
