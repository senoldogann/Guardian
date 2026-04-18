import React, { type ReactElement, MouseEvent } from "react";
import { invoke } from "../lib/tauri";
import clsx from "clsx";
import { useToast } from "../hooks/useToast";
import { useI18n } from "../i18n";
import type { Critique } from "../types";
import {
    ShieldAlert,
    BadgeInfo,
    Activity,
    Terminal,
    AlertCircle,
    FileCode,
    ChevronRight,
    ChevronDown,
    Hammer,
    Bot,
    RotateCcw,
    Code2,
    Tag,
    Target
} from "lucide-react";

interface CritiqueAccordionRowProps {
    log: Critique;
    index: number;
    isExpanded: boolean;
    onToggle: () => void;
    onAskGuru: () => void;
    rootPath: string;
    findingStatus?: "new" | "active";
    undoAvailable?: boolean;
    onFixHistoryRefresh?: () => void | Promise<void>;
}

export const CritiqueAccordionRow = React.memo(function CritiqueAccordionRow({
    log,
    index,
    isExpanded,
    onToggle,
    onAskGuru,
    rootPath,
    findingStatus,
    undoAvailable,
    onFixHistoryRefresh,
}: CritiqueAccordionRowProps): ReactElement {
    const { t } = useI18n();
    const severity = log.severity.toLowerCase();
    const isCritical = severity === "critical";
    const isWarning = severity === "warning";
    const severityLabel =
        log.severity === "Critical"
            ? t("critique.severityCritical")
            : log.severity === "Warning"
                ? t("critique.severityWarning")
                : t("critique.severityInfo");
    const { showError, showSuccess } = useToast();
    const [undoReady, setUndoReady] = React.useState<boolean>(() => Boolean(undoAvailable));

    // Keep UI aligned with persisted undo history (survives tab switches).
    React.useEffect(() => {
        setUndoReady(Boolean(undoAvailable));
    }, [undoAvailable]);

    // Improved Path Logic: Handle short paths and Windows/Unix separators
    const parts = log.file_path.split(/[/\\]/);
    const fileName = parts.pop() || t("critique.system");
    const parentDir = parts.pop();
    const grandParentDir = parts.pop();

    // If we have a grandparent, show "grandparent/parent/..."
    // If only parent, show "parent/..."
    // If no parent (root file), show "./"
    const dirDisplay = grandParentDir
        ? `${grandParentDir}/${parentDir}/...`
        : parentDir
            ? `${parentDir}/`
            : "./";

    const undoFixNow = async (): Promise<void> => {
        if (!rootPath?.trim()) {
            showError(t("critique.cannotUndoMissingWorkspace"), 4500);
            return;
        }
        try {
            await invoke("undo_fix", { filePath: log.file_path, root: rootPath });
            setUndoReady(false);
            void Promise.resolve(onFixHistoryRefresh?.()).catch(() => { });
            showSuccess(t("critique.undoCompleteToast", { file: fileName }), 3000);
        } catch (err) {
            showError(t("critique.undoFailedToast", { error: String(err) }), 6000);
        }
    };

    const applyFixNow = async (): Promise<void> => {
        if (!log.suggested_diff) return;
        if (!rootPath?.trim()) {
            showError(t("critique.cannotApplyMissingWorkspace"), 4500);
            return;
        }
        try {
            await invoke("apply_fix_now", { filePath: log.file_path, newContent: log.suggested_diff, root: rootPath });
            setUndoReady(true);
            void Promise.resolve(onFixHistoryRefresh?.()).catch(() => { });
            showSuccess(
                t("critique.appliedFixToast", { file: fileName }),
                6000,
                {
                    label: t("common.undo"),
                    onClick: () => {
                        void undoFixNow();
                    }
                }
            );
        } catch (err) {
            showError(t("critique.applyFailedToast", { error: String(err) }), 6000);
        }
    };

    const applyFix = async (e: MouseEvent): Promise<void> => {
        e.stopPropagation();
        await applyFixNow();
    };

    const undoFix = async (e: MouseEvent): Promise<void> => {
        e.stopPropagation();
        await undoFixNow();
    };

    return (
        <div className={clsx(
            "group overflow-hidden rounded-xl transition-all duration-300",
            isExpanded ? "bg-surface mb-4 shadow-lg border border-border-main" : "hover:bg-surface/50"
        )}>
            {/* Table Row Header - Changed to div to allow nested button */}
            <div
                onClick={onToggle}
                className={clsx(
                    "flex items-center px-6 py-4 cursor-pointer hover:bg-[var(--panel-muted)] transition-colors relative group",
                    isExpanded ? "bg-[var(--panel-bg)]" : ""
                )}
                role="button"
                tabIndex={0}
            >
                {/* Severity Accent */}
                <div className={clsx(
                    "absolute left-0 top-0 bottom-0 w-0.5 transition-all",
                    isExpanded ? "w-1" : "group-hover:w-1",
                    isCritical
                        ? "bg-[color:var(--tone-critical-text)]"
                        : isWarning
                            ? "bg-[color:var(--tone-warning-text)]"
                            : "bg-[var(--accent-500)]"
                )} />

                <div className="w-8 shrink-0 text-xs font-mono opacity-20">{index.toString().padStart(2, '0')}</div>

                <div className="w-48 shrink-0 pr-4">
                    <div className="flex items-center gap-2">
                        <FileCode
                            className={clsx(
                                "w-3.5 h-3.5",
                                isCritical
                                    ? "text-[color:var(--tone-critical-text)]"
                                    : isWarning
                                        ? "text-[color:var(--tone-warning-text)]"
                                        : "text-[var(--accent-500)]",
                            )}
                        />
                        <span className="font-bold text-sm truncate" title={log.file_path}>{fileName}</span>
                        {log.line_start && (
                            <span className="text-[10px] font-mono text-text-muted opacity-60 ml-1">
                                :{log.line_start}{log.line_end && log.line_end !== log.line_start ? `-${log.line_end}` : ''}
                            </span>
                        )}
                        {findingStatus && (
                            <span
                                className={clsx(
                                    "px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border",
                                    findingStatus === "new"
                                        ? "bg-[color:var(--tone-success-bg)] text-[color:var(--tone-success-text)] border-[color:var(--tone-success-border)]"
                                        : "bg-[var(--panel-muted)] text-text-muted border-border-main"
                                )}
                                title={
                                    findingStatus === "new"
                                        ? t("critique.findingNewSinceBaseline")
                                        : t("critique.findingPresentInBaseline")
                                }
                            >
                                {findingStatus === "new" ? t("critique.badgeNew") : t("critique.badgeActive")}
                            </span>
                        )}
                    </div>
                    <div className="text-xs opacity-30 font-mono pl-5 truncate">{dirDisplay}</div>
                </div>

                <div className="flex-1 min-w-0 pr-6">
                    <div className="text-sm opacity-80 font-medium truncate" title={log.message}>
                        {log.message}
                    </div>
                </div>

                <div className="w-52 shrink-0 flex items-center justify-end gap-2 translate-x-1">
                    {(isCritical || isWarning) && (
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                onAskGuru();
                            }}
                            className="p-2 rounded-lg border border-border-main bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] transition-colors text-text-muted hover:text-text-main"
                            title={t("critique.askGuru")}
                            aria-label={t("critique.askGuru")}
                        >
                            <Bot className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {log.suggested_diff && !undoReady && (
                        <button
                            onClick={applyFix}
                            className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent-500)] bg-[var(--accent-200)] px-2.5 py-1.5 rounded-lg border border-[var(--accent-400)] hover:opacity-90 hover:scale-105 transition-all cursor-pointer z-10 min-w-[76px] justify-center"
                            title={t("critique.quickFixTitle")}
                        >
                            <Hammer className="w-3.5 h-3.5" /> {t("critique.fix")}
                        </button>
                    )}
                    {log.suggested_diff && undoReady && (
                        <button
                            onClick={undoFix}
                            className="flex items-center gap-1.5 text-xs font-bold text-text-main bg-[var(--panel-muted)] px-2.5 py-1.5 rounded-lg border border-border-main hover:bg-[var(--panel-bg)] transition-colors cursor-pointer z-10 min-w-[112px] justify-center whitespace-nowrap"
                            title={t("reviews.undoTitle")}
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> {t("critique.undo")}
                        </button>
                    )}
                    {log.category && (
                        <span className={clsx(
                            "px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border shrink-0",
                            log.category === "Security"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : log.category === "Performance"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : log.category === "Architecture"
                                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                        : log.category === "Reliability"
                                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                            : log.category === "TypeSafety"
                                                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        )}>
                            <Tag className="w-2.5 h-2.5 inline mr-0.5" />
                            {log.category}
                        </span>
                    )}
                    <span className={clsx(
                        "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border shrink-0 min-w-[84px] text-center",
                        isCritical ? "bg-[color:var(--tone-critical-bg)] text-[color:var(--tone-critical-text)] border-[color:var(--tone-critical-border)]" :
                            isWarning ? "bg-[color:var(--tone-warning-bg)] text-[color:var(--tone-warning-text)] border-[color:var(--tone-warning-border)]" :
                                "bg-[var(--accent-200)] text-[var(--accent-500)] border-[var(--accent-400)]"
                    )}>
                        {severityLabel}
                    </span>
                    {log.confidence != null && (
                        <span className="text-[9px] font-mono text-text-muted opacity-50 ml-1" title={`Confidence: ${Math.round(log.confidence * 100)}%`}>
                            {Math.round(log.confidence * 100)}%
                        </span>
                    )}
                    {isExpanded ? <ChevronDown className="w-4 h-4 opacity-40" /> : <ChevronRight className="w-4 h-4 opacity-20 group-hover:opacity-60 transition-opacity" />}
                </div>
            </div>

            {/* Expanded Content (Accordion Body) */}
            {isExpanded && (
                <div className="px-14 pb-6 pt-2 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-4">
                        <div className="relative group/suggest">
                            <div className="absolute inset-0 bg-black/5 blur-xl rounded-2xl" />
                            <div className="relative bg-[var(--panel-muted)] border border-border-main p-5 rounded-2xl">
                                <div className="mb-4 rounded-xl border border-border-main bg-surface/70 px-4 py-3">
                                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">
                                        {t("critique.filePath")}
                                    </div>
                                    <div className="font-mono text-xs break-all opacity-90">
                                        {log.file_path}
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 mb-4">
                                    <div className={clsx(
                                        "p-2 rounded-lg",
                                        isCritical
                                            ? "bg-[color:var(--tone-critical-bg)]"
                                            : isWarning
                                                ? "bg-[color:var(--tone-warning-bg)]"
                                                : "bg-[var(--accent-200)]"
                                    )}>
                                        {isCritical ? <ShieldAlert className="w-5 h-5 text-[color:var(--tone-critical-text)]" /> :
                                            isWarning ? <AlertCircle className="w-5 h-5 text-[color:var(--tone-warning-text)]" /> :
                                                <BadgeInfo className="w-5 h-5 text-[var(--accent-500)]" />}
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold opacity-60 uppercase tracking-widest mb-1 flex items-center gap-2">
                                            <Activity className="w-3 h-3" /> {t("critique.violationDetails")}
                                        </h4>
                                        <p className="text-sm leading-relaxed opacity-90">{log.message}</p>
                                    </div>
                                </div>

                                {log.evidence_snippet && (
                                    <div className="mt-4 space-y-3">
                                        <div className="h-px w-full bg-border-main" />
                                        <div className="flex items-center gap-2 text-[10px] font-bold opacity-60 uppercase tracking-widest">
                                            <Code2 className="w-3 h-3" /> Evidence
                                            {log.line_start && (
                                                <span className="font-mono text-[var(--accent-500)] normal-case">
                                                    L{log.line_start}{log.line_end && log.line_end !== log.line_start ? `–${log.line_end}` : ''}
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-[#1e1e2e] border border-border-main p-4 rounded-xl font-mono text-xs leading-relaxed overflow-x-auto">
                                            <pre className="text-emerald-300/90 whitespace-pre-wrap">{log.evidence_snippet}</pre>
                                        </div>
                                    </div>
                                )}

                                {log.suggestion && (
                                    <div className="mt-4 space-y-3">
                                        <div className="h-px w-full bg-border-main" />
                                        <div className="flex items-center gap-2 text-[10px] font-bold opacity-60 uppercase tracking-widest">
                                            <Terminal className="w-3 h-3" /> {t("critique.verdictSuggestion")}
                                        </div>
                                        <div className="bg-surface border border-border-main p-4 rounded-xl font-mono text-xs leading-relaxed opacity-80 whitespace-pre-wrap">
                                            {log.suggestion}
                                        </div>
                                    </div>
                                )}

                                {log.suggested_diff && (
                                    <div className="mt-4 space-y-3">
                                        <div className="h-px w-full bg-border-main" />
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--accent-500)] uppercase tracking-widest">
                                            <Hammer className="w-3 h-3" /> {t("critique.autopilotProposedFix")}
                                        </div>
                                        <div className="bg-surface border border-border-main p-4 rounded-xl font-mono text-xs overflow-x-auto">
                                            <pre className="text-text-main opacity-80">{log.suggested_diff}</pre>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (undoReady) {
                                                    void undoFixNow();
                                                } else {
                                                    void applyFixNow();
                                                }
                                            }}
                                            className={clsx(
                                                "w-full py-2 font-bold rounded-lg text-xs transition-colors shadow-lg shadow-black/40 flex items-center justify-center gap-2 cursor-pointer",
                                                undoReady
                                                    ? "bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] text-text-main border border-border-main"
                                                    : "bg-[var(--accent-500)] hover:opacity-90 text-background"
                                            )}
                                        >
                                            {undoReady ? (
                                                <>
                                                    <RotateCcw className="w-3 h-3 fill-current" /> {t("critique.undo")}
                                                </>
                                            ) : (
                                                <>
                                                    <Hammer className="w-3 h-3 fill-current" /> {t("critique.applyThisFix")}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {(log.category || log.confidence != null) && (
                                    <div className="mt-4 flex items-center gap-4 text-[10px] text-text-muted opacity-60">
                                        {log.category && (
                                            <span className="flex items-center gap-1">
                                                <Tag className="w-3 h-3" /> Category: <strong>{log.category}</strong>
                                            </span>
                                        )}
                                        {log.confidence != null && (
                                            <span className="flex items-center gap-1">
                                                <Target className="w-3 h-3" /> Confidence: <strong>{Math.round(log.confidence * 100)}%</strong>
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
});
