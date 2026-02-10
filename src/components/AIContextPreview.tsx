import type { ReactElement } from "react";
import { EyeOff, RefreshCw } from "lucide-react";
import clsx from "clsx";
import type { AiContextSnapshot } from "../types";

export interface AIContextPreviewProps {
  context: AiContextSnapshot | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export function AIContextPreview({
  context,
  loading = false,
  error = null,
  onRefresh,
}: AIContextPreviewProps): ReactElement {
  if (!context && !loading && !error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4 py-12">
        <div className="w-16 h-16 rounded-2xl border border-border-main bg-background/40 flex items-center justify-center">
          <EyeOff className="w-7 h-7 text-text-muted/80" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="font-bold text-sm text-zinc-500">No Captured Context</h3>
          <p className="text-[10px] text-zinc-500 font-mono italic">
            Start monitoring and modify a file to capture the outbound AI payload.
          </p>
        </div>
      </div>
    );
  }

  const files = context?.files ?? [];
  const redactedCount = files.filter((f) => f.redacted).length;
  const truncatedCount = files.filter((f) => f.truncated).length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-4 border-b border-border-main bg-surface/30">
        <div className="space-y-1 min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
            AI Outbound Context
          </h2>
          {context && (
            <div className="text-[10px] font-mono text-text-muted space-y-0.5">
              <div className="truncate">
                Provider: <span className="text-[var(--text-main)]">{context.provider_id}</span>{" "}
                | Model: <span className="text-[var(--text-main)]">{context.model}</span>
              </div>
              <div className="truncate">
                Timestamp: <span className="text-[var(--text-main)]">{context.timestamp}</span>
              </div>
              <div>
                Files: <span className="text-[var(--text-main)]">{files.length}</span> | Tokens (est):
                {" "}
                <span className="text-[var(--text-main)]">{context.tokens_in}</span>
              </div>
            </div>
          )}
          {error && (
            <div className="text-[10px] text-rose-400 font-mono">
              {error}
            </div>
          )}
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className={clsx(
              "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors flex items-center gap-2 cursor-pointer",
              "bg-background/60 text-text-muted border-border-main hover:bg-border-main",
              loading && "opacity-50 cursor-not-allowed"
            )}
            title="Refresh from backend"
          >
            <RefreshCw className={clsx("w-3 h-3", loading && "animate-spin")} />
            Refresh
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar space-y-3">
        {(redactedCount > 0 || truncatedCount > 0) && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200 px-4 py-3 text-[10px] font-mono">
            Sensitive content was redacted. Context: {redactedCount} redacted, {truncatedCount} truncated.
          </div>
        )}

        {files.length === 0 ? (
          <div className="text-[10px] text-text-muted font-mono italic">
            No files were included in the last outbound context.
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <details
                key={file.file_path}
                className="rounded-xl border border-border-main bg-background/40 overflow-hidden"
              >
                <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate" title={file.file_path}>
                      {file.file_path}
                    </div>
                    <div className="text-[10px] font-mono text-text-muted">
                      Tokens (est): {file.token_estimate}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {file.redacted && (
                      <span className="px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border bg-amber-500/10 text-amber-200 border-amber-500/20">
                        REDACTED
                      </span>
                    )}
                    {file.truncated && (
                      <span className="px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border bg-white/5 text-text-muted border-border-main">
                        TRUNCATED
                      </span>
                    )}
                  </div>
                </summary>
                <div className="px-4 pb-4">
                  <pre className="whitespace-pre-wrap break-words text-[10px] leading-relaxed font-mono text-[var(--text-main)] bg-background/60 border border-border-main rounded-lg p-3 overflow-x-auto custom-scrollbar">
                    {file.content}
                  </pre>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
