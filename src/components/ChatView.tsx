import { useState, useEffect, useRef, useCallback, type ReactElement, type ReactNode, isValidElement, useMemo } from "react";
import { invoke, listen, isTauriRuntime, openExternal } from "../lib/tauri";
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
    Globe,
    Plus,
    Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useToast } from "../hooks/useToast";
import { useI18n } from "../i18n";

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

export type AutoPrompt = {
    id: string;
    prompt: string;
    useWebSearch?: boolean;
};

interface ChatViewProps {
    path: string;
    autoPrompt?: AutoPrompt | null;
    onAutoPromptConsumed?: () => void;
    onGuruReply?: () => void;
    onFixHistoryRefresh?: () => void | Promise<void>;
    webSearchEnabled: boolean;
    webSearchDepth: "basic" | "advanced" | "fast" | "ultra-fast" | "auto";
    onWebSearchToggle: () => void;
    webSearchReady: boolean;
}

export function ChatView({
    path,
    autoPrompt,
    onAutoPromptConsumed,
    onGuruReply,
    onFixHistoryRefresh,
    webSearchEnabled,
    webSearchDepth,
    onWebSearchToggle,
    webSearchReady,
}: ChatViewProps): ReactElement {
    const { locale, t } = useI18n();
    const [chatInput, setChatInput] = useState("");
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [chatLoadError, setChatLoadError] = useState<string | null>(null);
    const [appliedFixes, setAppliedFixes] = useState<Set<number>>(new Set());
    const [rejectedFixes, setRejectedFixes] = useState<Set<number>>(new Set());
    const [guideOpen, setGuideOpen] = useState(false);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const clearConfirmRef = useRef<HTMLDivElement | null>(null);
    const clearCancelRef = useRef<HTMLButtonElement | null>(null);
    const ignoreResponseRef = useRef(false);
    const autoPromptRef = useRef<string | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const forceScrollRef = useRef(false);
    const isDesktop = isTauriRuntime();
    const onGuruReplyRef = useRef(onGuruReply);
    const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
    const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);
    const [plusMenuOpen, setPlusMenuOpen] = useState(false);
    const plusMenuRef = useRef<HTMLDivElement>(null);
    const toast = useToast();

    const thinkingMessages = useMemo(
        () => [
            t("chat.thinking.analyzing"),
            t("chat.thinking.crossChecking"),
            t("chat.thinking.comparing"),
            t("chat.thinking.building"),
        ],
        [t],
    );

    useEffect(() => {
        onGuruReplyRef.current = onGuruReply;
    }, [onGuruReply]);

    useFocusTrap({
        active: clearConfirmOpen,
        containerRef: clearConfirmRef,
        onEscape: () => setClearConfirmOpen(false),
        initialFocusRef: clearCancelRef,
    });

    // Close plus menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
                setPlusMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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

        // Force scroll for bot messages to ensure visibility
        if (message.role !== "user") {
            forceScrollRef.current = true;
        }

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
                onGuruReplyRef.current?.();
                return;
            }

            if (payload.decision) {
                appendMessage({
                    role: "guardian",
                    content: t("chat.decisionReceived", {
                        file: payload.file_path,
                        decision: payload.decision,
                    }),
                    timestamp: nowIso(),
                });
            }
        });

        return () => {
            unlisten.then(f => f());
        };
    }, [appendMessage, nowIso, t]);

    const submitPrompt = useCallback(async (prompt: string, forceWebSearch?: boolean): Promise<void> => {
        if (chatLoading || !prompt.trim()) return;

        if (!path) {
            appendMessage({
                role: "guardian",
                content: t("chat.systemSelectWorkspace"),
                timestamp: nowIso(),
            });
            return;
        }

        forceScrollRef.current = true;
        appendMessage({ role: "user", content: prompt, timestamp: nowIso() });
        ignoreResponseRef.current = false;
        setChatLoading(true);

        try {
            const useWebSearch = typeof forceWebSearch === "boolean"
                ? forceWebSearch
                : webSearchEnabled && webSearchReady;
            const answer = await invoke<string>("ask_guru", {
                path,
                query: prompt,
                webSearch: useWebSearch,
                webSearchDepth,
                language: locale,
            });
            if (ignoreResponseRef.current) return;
            appendMessage({ role: "guru", content: answer, timestamp: nowIso() });
            onGuruReplyRef.current?.();
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            if (ignoreResponseRef.current) return;
            if (errorMsg.toLowerCase().includes("web search failed")) {
                appendMessage({
                    role: "guardian",
                    content: t("chat.errorWebSearchOptional", { error: errorMsg }),
                    timestamp: nowIso(),
                });
            } else {
                appendMessage({
                    role: "guardian",
                    content: t("chat.errorLocalServer", { error: errorMsg }),
                    timestamp: nowIso(),
                });
            }
        } finally {
            setChatLoading(false);
        }
    }, [chatLoading, path, appendMessage, nowIso, t, webSearchEnabled, webSearchReady, webSearchDepth, locale]);

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
        if (autoPromptRef.current === autoPrompt.id) return;
        autoPromptRef.current = autoPrompt.id;
        onAutoPromptConsumed?.();

        forceScrollRef.current = true;

        const webSearchOverride = typeof autoPrompt.useWebSearch === "boolean" ? autoPrompt.useWebSearch : undefined;
        void submitPrompt(autoPrompt.prompt, webSearchOverride);
    }, [autoPrompt, onAutoPromptConsumed, submitPrompt]);

    const confirmFix = useCallback(async (index: number, filePath: string, diff: string): Promise<void> => {
        try {
            if (!path) {
                appendMessage({
                    role: "guardian",
                    content: t("chat.fix.cannotApplyMissingWorkspace"),
                    timestamp: nowIso(),
                });
                return;
            }
            await invoke("apply_fix_now", { filePath: filePath, newContent: diff, root: path });
            setAppliedFixes(prev => new Set(prev).add(index));
            void Promise.resolve(onFixHistoryRefresh?.()).catch(() => { });
            const fileName = filePath.split("/").pop() || "file";
            toast.showSuccess(
                t("chat.fix.appliedFixToast", { file: fileName }),
                6000,
                {
                    label: t("common.undo"),
                    onClick: () => {
                        invoke("undo_fix", { filePath, root: path })
                            .then(async () => {
                                toast.showSuccess(t("chat.fix.undoCompleteToast", { file: fileName }), 3000);
                                await Promise.resolve(onFixHistoryRefresh?.());
                            })
                            .catch((e) =>
                                toast.showError(t("chat.fix.undoFailedToast", { error: String(e) }), 6000),
                            );
                    }
                }
            );
            appendMessage({
                role: "guru",
                content: t("chat.fix.appliedFixConfirmation", { file: fileName }),
                timestamp: nowIso(),
            });
        } catch (e) {
            appendMessage({
                role: "guru",
                content: t("chat.fix.applyFailedToast", { error: String(e) }),
                timestamp: nowIso(),
            });
        }
    }, [appendMessage, nowIso, onFixHistoryRefresh, path, t, toast]);

    const rejectFix = useCallback((index: number, filePath: string): void => {
        setRejectedFixes(prev => new Set(prev).add(index));
        appendMessage({
            role: "guardian",
            content: t("chat.fix.rejectedFixToast", { file: filePath.split("/").pop() ?? "file" }),
            timestamp: nowIso(),
        });
    }, [appendMessage, nowIso, t]);

    const renderedMessages = useMemo(() => {
        const MAX_RENDERED = 120;
        if (chatHistory.length <= MAX_RENDERED) return chatHistory;
        return chatHistory.slice(-MAX_RENDERED);
    }, [chatHistory]);

    const renderedOffset = useMemo(
        () => Math.max(0, chatHistory.length - renderedMessages.length),
        [chatHistory.length, renderedMessages.length]
    );

    useEffect(() => {
        if (!chatLoading) {
            setThinkingMessageIndex(0);
            return;
        }
        const interval = window.setInterval(() => {
            setThinkingMessageIndex((prev) => (prev + 1) % thinkingMessages.length);
        }, 1400);
        return () => window.clearInterval(interval);
    }, [chatLoading, thinkingMessages.length]);

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
        <section className="flex-1 flex flex-col bg-[var(--panel-bg)] relative overflow-hidden">
            {/* Header with Guide Button */}
            <div className="guardian-topbar justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="guardian-elevated-card rounded-xl p-2">
                        <Bot className="w-4 h-4 text-[var(--accent-500)]" />
                    </div>
                    <h2 className="guardian-topbar-text">{t("chat.title")}</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setGuideOpen(true)}
                        className="p-2 rounded-lg transition-all active:scale-95 cursor-pointer hover:bg-[var(--panel-muted)] group"
                        title={t("chat.openGuide")}
                    >
                        <HelpCircle className="w-4 h-4 text-[var(--accent-500)] group-hover:scale-110 transition-transform" />
                    </button>
                    <button
                        onClick={() => setClearConfirmOpen(true)}
                        className="p-2 rounded-lg transition-all active:scale-95 cursor-pointer hover:bg-[var(--panel-muted)] group disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                        disabled={chatHistory.length === 0}
                        title={t("chat.clearHistory")}
                    >
                        <Trash2 className="w-4 h-4 text-[color:var(--tone-critical-text)] group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>
            {clearConfirmOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            setClearConfirmOpen(false);
                        }
                    }}
                >
                    <div
                        ref={clearConfirmRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="guardian-clear-chat-title"
                        aria-describedby="guardian-clear-chat-desc"
                        className="guardian-elevated-card max-w-sm w-[90%] rounded-2xl p-5 shadow-2xl"
                    >
                        <div
                            id="guardian-clear-chat-title"
                            className="text-sm font-bold uppercase tracking-widest text-text-main mb-2"
                        >
                            {t("chat.clearConfirmTitle")}
                        </div>
                        <p id="guardian-clear-chat-desc" className="text-xs text-text-muted">
                            {t("chat.clearConfirmDescription")}
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={() => setClearConfirmOpen(false)}
                                className="guardian-focus-ring px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] text-text-main rounded-md transition-colors cursor-pointer"
                                ref={clearCancelRef}
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                onClick={handleClearChat}
                                className="guardian-focus-ring px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer"
                            >
                                {t("common.delete")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat History */}
            <div
                ref={scrollAreaRef}
                className={clsx(
                    "flex-1 p-6 pb-10 custom-scrollbar",
                    chatHistory.length === 0 && !chatLoading ? "overflow-y-hidden" : "overflow-y-auto"
                )}
            >
                {chatLoadError && (
                    <div className="text-[10px] text-[color:var(--tone-critical-text)]">
                        {chatLoadError}
                    </div>
                )}
                {chatHistory.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center gap-6 animate-in fade-in zoom-in duration-700">
                        <Bot className="w-16 h-16 text-text-muted opacity-35" />
                        <div className="text-center space-y-2">
                            <p className="text-sm font-bold uppercase tracking-tighter text-text-main">
                                {t("chat.emptyTitle")}
                            </p>
                            <p className="text-xs font-mono max-w-xs leading-relaxed text-text-muted whitespace-pre-line">
                                {t("chat.emptyDescription")}
                            </p>
                        </div>
                        <div className="guru-placeholder opacity-30" aria-hidden="true">
                            <div className="guru-placeholder-bar" />
                            <div className="guru-placeholder-bar medium" />
                            <div className="guru-placeholder-bar short" />
                        </div>
                    </div>
                )}

                {chatHistory.length > 0 && (
                    <div className="space-y-5">
                        {renderedMessages.map((msg, index) => {
                            const actualIndex = renderedOffset + index;
                            return (
                                <ChatMessageRow
                                    key={`chat-${actualIndex}-${msg.timestamp ?? ""}`}
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
                            );
                        })}
                    </div>
                )}

                {chatLoading && (
                    <div className="flex gap-4 max-w-3xl mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="w-8 h-8 rounded-lg bg-[var(--accent-200)] text-[var(--accent-500)] flex items-center justify-center shrink-0 animate-pulse shadow-sm border border-border-main">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="guardian-chat-bubble p-4 rounded-2xl text-xs font-mono text-text-muted flex items-center gap-2 shadow-sm min-w-[280px]">
                            <Activity className="w-3 h-3 animate-spin shrink-0 text-text-muted" />
                            <span className="inline-flex items-center gap-0.5">
                                    <span className="transition-opacity duration-300">
                                    {thinkingMessages[thinkingMessageIndex]}
                                    </span>
                                <span className="inline-flex gap-0.5 pt-1" aria-hidden="true">
                                    <span className="h-0.5 w-0.5 rounded-full bg-current animate-pulse" />
                                    <span className="h-0.5 w-0.5 rounded-full bg-current animate-pulse [animation-delay:120ms]" />
                                    <span className="h-0.5 w-0.5 rounded-full bg-current animate-pulse [animation-delay:240ms]" />
                                </span>
                            </span>
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
                            className="guardian-elevated-card w-full max-w-lg rounded-[2rem] relative overflow-hidden flex flex-col"
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
                                            <h3 className="text-xl font-black tracking-tight text-text-main">{t("chat.guide.title")}</h3>
                                            <p className="text-xs font-medium text-text-muted">{t("chat.guide.subtitle")}</p>
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
                                        title={t("chat.guide.options.sentryTitle")}
                                        desc={t("chat.guide.options.sentryDesc")}
                                        color="sky"
                                        onClick={() => { }} // Added onClick as per new interface
                                    />
                                    <GuideOption
                                        icon={Bot}
                                        title={t("chat.guide.options.architectTitle")}
                                        desc={t("chat.guide.options.architectDesc")}
                                        color="sky"
                                        onClick={() => { }} // Added onClick as per new interface
                                    />
                                    <GuideOption
                                        icon={Clock}
                                        title={t("chat.guide.options.hardLockTitle")}
                                        desc={t("chat.guide.options.hardLockDesc")}
                                        color="rose"
                                        onClick={() => { }} // Added onClick as per new interface
                                    />
                                    <GuideOption
                                        icon={Info}
                                        title={t("chat.guide.options.planDrivenTitle")}
                                        desc={t("chat.guide.options.planDrivenDesc")}
                                        color="amber"
                                        onClick={() => { }} // Added onClick as per new interface
                                    />
                                </div>

                                {/* Steps / Usage */}
                                <div className="guardian-subtle-card p-6 rounded-2xl space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">{t("chat.guide.stepsTitle")}</h4>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="flex items-start gap-4 text-xs">
                                            <div className="w-5 h-5 rounded-full bg-[var(--accent-500)] text-background flex items-center justify-center text-[9px] font-black shrink-0 shadow-lg shadow-black/20">1</div>
                                            <p className="font-medium text-text-muted">{t("chat.guide.step1")}</p>
                                        </div>
                                        <div className="flex items-start gap-4 text-xs">
                                            <div className="w-5 h-5 rounded-full bg-[var(--accent-500)] text-background flex items-center justify-center text-[9px] font-black shrink-0 shadow-lg shadow-black/20">2</div>
                                            <p className="font-medium text-text-muted">{t("chat.guide.step2")}</p>
                                        </div>
                                        <div className="flex items-start gap-4 text-xs">
                                            <div className="w-5 h-5 rounded-full bg-[var(--accent-500)] text-background flex items-center justify-center text-[9px] font-black shrink-0 shadow-lg shadow-black/20">3</div>
                                            <p className="font-medium text-text-muted">{t("chat.guide.step3")}</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setGuideOpen(false)}
                                    className="w-full py-4 bg-[var(--accent-500)] text-background text-sm font-black rounded-xl hover:opacity-90 transition-all active:scale-[0.98] shadow-2xl shadow-black/20 cursor-pointer"
                                >
                                    {t("chat.guide.start")}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="p-6 border-t border-border-main bg-[var(--panel-muted)] backdrop-blur-sm space-y-2">
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10" ref={plusMenuRef}>
                        <button
                            onClick={() => setPlusMenuOpen(!plusMenuOpen)}
                            className={clsx(
                                "guardian-focus-ring p-2 rounded-lg transition-all active:scale-95 cursor-pointer",
                                plusMenuOpen
                                    ? "bg-[var(--panel-muted)] text-text-main"
                                    : "text-text-muted hover:text-text-main hover:bg-[var(--panel-muted)]"
                            )}
                            title={t("chat.actionsTitle")}
                        >
                            <Plus className={clsx("w-5 h-5 transition-transform", plusMenuOpen && "rotate-45")} />
                        </button>
                        <AnimatePresence>
                            {plusMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute bottom-full left-0 mb-2 w-52 guardian-elevated-card rounded-xl shadow-2xl overflow-hidden py-1 z-50"
                                >
                                    <button
                                        onClick={() => {
                                            if (webSearchReady) {
                                                onWebSearchToggle();
                                                setPlusMenuOpen(false);
                                            }
                                        }}
                                        disabled={!webSearchReady}
                                        className={clsx(
                                            "w-full px-4 py-2.5 flex items-center gap-3 text-sm transition-colors hover:bg-[var(--panel-muted)] disabled:opacity-50 disabled:cursor-not-allowed",
                                            webSearchEnabled ? "text-[var(--accent-500)]" : "text-text-main"
                                        )}
                                    >
                                        <Globe className="w-4 h-4" />
                                        <span className="flex-1 text-left">{t("chat.webSearch")}</span>
                                        {webSearchEnabled && <Check className="w-4 h-4" />}
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && askGuru()}
                        placeholder={t("chat.inputPlaceholder")}
                        className="guru-input w-full bg-[var(--panel-muted)] border border-border-main rounded-2xl py-5 pl-14 pr-16 text-sm font-sans outline-none focus:border-[var(--focus-border)] transition-all shadow-inner"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button
                            onClick={chatLoading ? cancelPending : askGuru}
                            className="guardian-focus-ring p-2 bg-[var(--accent-500)] hover:opacity-90 text-background rounded-xl transition-colors shadow-lg shadow-black/30 cursor-pointer icon-button"
                            disabled={!chatInput.trim() && !chatLoading}
                            aria-label={chatLoading ? t("chat.cancel") : t("chat.send")}
                        >
                            {chatLoading ? <X className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                {!webSearchReady && (
                    <div className="text-[10px] text-[color:var(--tone-warning-text)]">
                        {t("chat.webSearchSetupHint")}
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
        rose: "bg-[color:var(--tone-critical-bg)] text-[color:var(--tone-critical-text)] group-hover:opacity-90",
        amber: "bg-[color:var(--tone-warning-bg)] text-[color:var(--tone-warning-text)] group-hover:opacity-90",
    };

    return (
        <div className="flex gap-4 group p-1 cursor-pointer" onClick={onClick}>
            <div className={clsx(
                "shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border border-border-main transition-all duration-500 shadow-sm",
                colorStyles[color]
            )}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="space-y-1 py-0.5">
                <h5 className="text-sm font-black text-text-main group-hover:translate-x-1 transition-transform duration-300">{title}</h5>
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
    const { t } = useI18n();
    return (
        <div className={clsx("flex w-full", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={clsx("flex gap-4 max-w-[90%] md:max-w-[80%]", msg.role === "user" ? "flex-row-reverse" : "")}>
                <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border",
                    msg.role === "user"
                        ? "guardian-subtle-card text-text-muted"
                        : "border-[var(--panel-border-strong)] bg-[var(--accent-200)] text-[var(--accent-500)]",
                )}>
                    {msg.role === "user" ? <UserIcon className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className="flex flex-col gap-3 min-w-0">
                    <div className={clsx(
                        "p-5 rounded-2xl text-sm leading-relaxed font-sans shadow-sm min-w-0 break-words",
                        msg.role === "user" ? "guardian-chat-bubble-user" : "guardian-chat-bubble",
                    )}>
                        <div className="guardian-markdown">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeHighlight, rehypeSanitize]}
                                components={{
                                    a: ({ href, children, ...props }) => {
                                        const url = typeof href === "string" ? href : "";
                                        const isHttp = /^https?:\/\//i.test(url);
                                        return (
                                            <a
                                                {...props}
                                                href={url}
                                                rel={isHttp ? "noopener noreferrer" : props.rel}
                                                onClick={(event) => {
                                                    if (!url) return;
                                                    if (!isHttp) return;
                                                    event.preventDefault();
                                                    void openExternal(url);
                                                }}
                                            >
                                                {children}
                                            </a>
                                        );
                                    },
                                    pre: ({ children }) => {
                                        const text = extractText(children);
                                        return (
                                            <div className="guardian-code-block">
                                                <button
                                                    className="guardian-copy-btn"
                                                    onClick={() => onCopy(text)}
                                                    title={t("chat.copyCode")}
                                                >
                                                    <Copy className="w-3 h-3" />
                                                    {copiedSnippet === text ? t("chat.copied") : t("chat.copy")}
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
                        <div className="guardian-chat-action-card flex flex-col items-center justify-center p-6 rounded-[var(--guide-radius)] text-center space-y-5 animate-in fade-in zoom-in duration-500">
                            <div className="flex items-center gap-2 mb-2">
                                    {msg.action.status === "MODIFIED" ? (
                                        <AlertTriangle className="w-4 h-4 text-[color:var(--tone-warning-text)]" />
                                    ) : (
                                        <CheckCircle className="w-4 h-4 text-[var(--accent-500)]" />
                                    )}
                                    <span className={clsx("text-xs font-bold uppercase", msg.action.status === "MODIFIED" ? "text-[color:var(--tone-warning-text)]" : "text-[var(--accent-500)]")}>
                                    {msg.action.status === "MODIFIED" ? t("chat.guardianAutoCorrected") : t("chat.verifiedSafe")}
                                    </span>
                                </div>

                            <div className="bg-[var(--panel-muted)] rounded p-2 mb-2 max-h-40 overflow-y-auto border border-border-main w-full">
                                <pre className="text-[10px] font-mono text-[color:var(--text-main)] opacity-80 whitespace-pre-wrap">
                                    {msg.action.diff}
                                </pre>
                            </div>

                            <div className="flex flex-wrap justify-center gap-2">
                                {appliedFixes.has(index) ? (
                                    <div className="flex items-center gap-2 text-xs text-[var(--accent-500)] font-bold bg-[var(--accent-200)] px-3 py-1.5 rounded-md border border-[var(--accent-400)]">
                                        <CheckCircle className="w-3 h-3" /> {t("chat.successfullyApplied")}
                                    </div>
                                ) : rejectedFixes.has(index) ? (
                                    <div className="flex items-center gap-2 text-xs text-[color:var(--tone-critical-text)] font-bold bg-[color:var(--tone-critical-bg)] px-3 py-1.5 rounded-md border border-[color:var(--tone-critical-border)]">
                                        <XCircle className="w-3 h-3" /> {t("chat.fix.rejected")}
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => onConfirmFix(index, msg.action!.file_path, msg.action!.diff)}
                                            className="guardian-focus-ring px-3 py-1.5 bg-[var(--accent-500)] hover:opacity-90 text-background text-xs rounded-md shadow-lg shadow-black/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <CheckCircle className="w-3 h-3" /> {t("chat.fix.confirmAndApply")}
                                        </button>
                                        <button
                                            onClick={() => onRejectFix(index, msg.action!.file_path)}
                                            className="guardian-focus-ring px-3 py-1.5 bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] text-text-muted text-xs rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <XCircle className="w-3 h-3" /> {t("chat.fix.reject")}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
