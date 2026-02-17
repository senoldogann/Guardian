import React, { type ReactElement, MouseEvent } from "react";
import { invoke } from "../lib/tauri";
import clsx from "clsx";
import { useToast } from "../hooks/useToast";
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
    RotateCcw
} from "lucide-react";

export interface Critique {
    file_path: string;
    severity: "Info" | "Warning" | "Critical";
    message: string;
    suggestion?: string;
    suggested_diff?: string;
    finding_id?: string;
}

interface CritiqueAccordionRowProps {
    log: Critique;
    index: number;
    isExpanded: boolean;
    onToggle: () => void;
    onAskGuru: () => void;
    rootPath: string;
    findingStatus?: "new" | "active";
}

export const CritiqueAccordionRow = React.memo(function CritiqueAccordionRow({ log, index, isExpanded, onToggle, onAskGuru, rootPath, findingStatus }: CritiqueAccordionRowProps): ReactElement {
    const severity = log.severity.toLowerCase();
    const isCritical = severity === "critical";
    const isWarning = severity === "warning";
    const { showError, showSuccess } = useToast();
    const [undoReady, setUndoReady] = React.useState(false);

    // Improved Path Logic: Handle short paths and Windows/Unix separators
    const parts = log.file_path.split(/[/\\]/);
    const fileName = parts.pop() || "System";
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
            showError("Cannot undo: workspace path is missing.", 4500);
            return;
        }
        try {
            await invoke("undo_fix", { filePath: log.file_path, root: rootPath });
            setUndoReady(false);
            showSuccess(`Undo complete for ${fileName}.`, 3000);
        } catch (err) {
            showError(`Undo failed: ${String(err)}`, 6000);
        }
    };

    const applyFixNow = async (): Promise<void> => {
        if (!log.suggested_diff) return;
        if (!rootPath?.trim()) {
            showError("Cannot apply fix: workspace path is missing.", 4500);
            return;
        }
        try {
            await invoke("apply_fix_now", { filePath: log.file_path, newContent: log.suggested_diff, root: rootPath });
            setUndoReady(true);
            showSuccess(
                `Applied fix to ${fileName}.`,
                6000,
                {
                    label: "Undo",
                    onClick: () => {
                        void undoFixNow();
                    }
                }
            );
        } catch (err) {
            showError(`Failed to apply fix: ${String(err)}`, 6000);
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
                    "flex items-center px-6 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors relative group",
                    isExpanded ? "bg-white/[0.03]" : ""
                )}
                role="button"
                tabIndex={0}
            >
                {/* Severity Accent */}
                <div className={clsx(
                    "absolute left-0 top-0 bottom-0 w-0.5 transition-all",
                    isExpanded ? "w-1" : "group-hover:w-1",
                    isCritical ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-[var(--accent-500)]"
                )} />

                <div className="w-8 shrink-0 text-xs font-mono opacity-20">{index.toString().padStart(2, '0')}</div>

                <div className="w-48 shrink-0 pr-4">
                    <div className="flex items-center gap-2">
                        <FileCode className={clsx("w-3.5 h-3.5", isCritical ? "text-rose-400" : isWarning ? "text-amber-400" : "text-[var(--accent-500)]")} />
                        <span className="font-bold text-sm truncate" title={log.file_path}>{fileName}</span>
                        {findingStatus && (
                            <span
                                className={clsx(
                                    "px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border",
                                    findingStatus === "new"
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : "bg-white/5 text-text-muted border-border-main"
                                )}
                                title={findingStatus === "new" ? "New since baseline" : "Present in baseline"}
                            >
                                {findingStatus === "new" ? "NEW" : "ACTIVE"}
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
                            className="p-2 rounded-lg border border-border-main bg-background/60 hover:bg-background transition-colors text-text-muted hover:text-text-main"
                            title="Ask Guru to resolve"
                            aria-label="Ask Guru to resolve"
                        >
                            <Bot className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {log.suggested_diff && !undoReady && (
                        <button
                            onClick={applyFix}
                            className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent-500)] bg-[var(--accent-200)] px-2.5 py-1.5 rounded-lg border border-[var(--accent-400)] hover:opacity-90 hover:scale-105 transition-all cursor-pointer z-10 min-w-[76px] justify-center"
                            title="Quick Fix: Apply this patch immediately"
                        >
                            <Hammer className="w-3.5 h-3.5" /> FIX
                        </button>
                    )}
                    {log.suggested_diff && undoReady && (
                        <button
                            onClick={undoFix}
                            className="flex items-center gap-1.5 text-xs font-bold text-text-main bg-background/60 px-2.5 py-1.5 rounded-lg border border-border-main hover:bg-background transition-colors cursor-pointer z-10 min-w-[76px] justify-center"
                            title="Undo last applied fix for this file"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> UNDO
                        </button>
                    )}
                    <span className={clsx(
                        "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border shrink-0 min-w-[84px] text-center",
                        isCritical ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                            isWarning ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                "bg-[var(--accent-200)] text-[var(--accent-500)] border-[var(--accent-400)]"
                    )}>
                        {log.severity}
                    </span>
                    {isExpanded ? <ChevronDown className="w-4 h-4 opacity-40" /> : <ChevronRight className="w-4 h-4 opacity-20 group-hover:opacity-60 transition-opacity" />}
                </div>
            </div>

            {/* Expanded Content (Accordion Body) */}
            {isExpanded && (
                <div className="px-14 pb-6 pt-2 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-4">
                        <div className="relative group/suggest">
                            <div className="absolute inset-0 bg-black/5 blur-xl rounded-2xl" />
                            <div className="relative bg-background border border-border-main p-5 rounded-2xl">
                                <div className="mb-4 rounded-xl border border-border-main bg-surface/70 px-4 py-3">
                                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">
                                        File Path
                                    </div>
                                    <div className="font-mono text-xs break-all opacity-90">
                                        {log.file_path}
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 mb-4">
                                    <div className={clsx(
                                        "p-2 rounded-lg",
                                        isCritical ? "bg-rose-500/10" : isWarning ? "bg-amber-500/10" : "bg-[var(--accent-200)]"
                                    )}>
                                        {isCritical ? <ShieldAlert className="w-5 h-5 text-rose-500" /> :
                                            isWarning ? <AlertCircle className="w-5 h-5 text-amber-500" /> :
                                                <BadgeInfo className="w-5 h-5 text-[var(--accent-500)]" />}
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold opacity-60 uppercase tracking-widest mb-1 flex items-center gap-2">
                                            <Activity className="w-3 h-3" /> System Violation Details
                                        </h4>
                                        <p className="text-sm leading-relaxed opacity-90">{log.message}</p>
                                    </div>
                                </div>

                                {log.suggestion && (
                                    <div className="mt-4 space-y-3">
                                        <div className="h-px w-full bg-border-main" />
                                        <div className="flex items-center gap-2 text-[10px] font-bold opacity-60 uppercase tracking-widest">
                                            <Terminal className="w-3 h-3" /> Architect's Verdict & Suggestion
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
                                            <Hammer className="w-3 h-3" /> Autopilot: Proposed Fix
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
                                                    ? "bg-background/60 hover:bg-background/80 text-text-main border border-border-main"
                                                    : "bg-[var(--accent-500)] hover:opacity-90 text-background"
                                            )}
                                        >
                                            {undoReady ? (
                                                <>
                                                    <RotateCcw className="w-3 h-3 fill-current" /> UNDO
                                                </>
                                            ) : (
                                                <>
                                                    <Hammer className="w-3 h-3 fill-current" /> APPLY THIS FIX
                                                </>
                                            )}
                                        </button>
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
