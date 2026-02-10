import type { ReactElement } from "react";
import { RefreshCw } from "lucide-react";
import clsx from "clsx";
import type { FixProposal, FixProposalsSnapshot } from "../types";

export interface FixProposalsViewProps {
  snapshot: FixProposalsSnapshot | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onRequestReview?: (proposal: FixProposal) => void | Promise<void>;
  onSetStatus?: (proposalId: string, status: string) => void | Promise<void>;
}

export function FixProposalsView({
  snapshot,
  loading = false,
  error = null,
  onRefresh,
  onRequestReview,
  onSetStatus,
}: FixProposalsViewProps): ReactElement {
  const proposals = snapshot?.proposals ?? [];
  const pending = proposals.filter((p) => {
    const status = (p.status || "").toLowerCase();
    return status !== "rejected" && status !== "applied";
  });
  const done = proposals.filter((p) => {
    const status = (p.status || "").toLowerCase();
    return status === "rejected" || status === "applied";
  });

  if (!snapshot && !loading && !error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4 py-12">
        <div className="text-center space-y-1">
          <h3 className="font-bold text-sm text-zinc-500">No Fix Proposals</h3>
          <p className="text-[10px] text-zinc-500 font-mono italic max-w-md">
            Append JSONL proposals to <span className="text-[var(--text-main)]">.guardian-proposals/fix_proposals.jsonl</span>{" "}
            to request review. Guardian will never auto-apply fixes without confirmation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-4 border-b border-border-main bg-surface/30">
        <div className="space-y-1 min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">
            Fix Proposals
          </h2>
          {snapshot && (
            <div className="text-[10px] font-mono text-text-muted space-y-0.5">
              <div className="truncate">
                Source: <span className="text-[var(--text-main)]">{snapshot.source_path}</span>
              </div>
              <div className="truncate">
                Updated: <span className="text-[var(--text-main)]">{snapshot.timestamp}</span>
              </div>
              <div>
                Pending: <span className="text-[var(--text-main)]">{pending.length}</span> | Done:{" "}
                <span className="text-[var(--text-main)]">{done.length}</span> | Total:{" "}
                <span className="text-[var(--text-main)]">{proposals.length}</span>
              </div>
            </div>
          )}
          {error && <div className="text-[10px] text-rose-400 font-mono">{error}</div>}
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

      <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar space-y-4">
        {pending.length === 0 && proposals.length > 0 ? (
          <div className="text-[10px] text-text-muted font-mono italic">
            No pending proposals. (Showing done proposals below.)
          </div>
        ) : pending.length === 0 ? (
          <div className="text-[10px] text-text-muted font-mono italic">
            No proposals found.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((p) => (
              <ProposalCard
                key={p.proposal_id}
                proposal={p}
                onRequestReview={onRequestReview}
                onSetStatus={onSetStatus}
              />
            ))}
          </div>
        )}

        {done.length > 0 && (
          <details className="rounded-xl border border-border-main bg-background/40 overflow-hidden">
            <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold truncate" title="Done proposals">
                  Done Proposals ({done.length})
                </div>
                <div className="text-[10px] font-mono text-text-muted">
                  Applied or rejected proposals
                </div>
              </div>
            </summary>
            <div className="px-4 pb-4 space-y-3">
              {done.map((p) => (
                <ProposalCard
                  key={p.proposal_id}
                  proposal={p}
                  onRequestReview={onRequestReview}
                  onSetStatus={onSetStatus}
                />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  onRequestReview,
  onSetStatus,
}: {
  proposal: FixProposal;
  onRequestReview?: (proposal: FixProposal) => void | Promise<void>;
  onSetStatus?: (proposalId: string, status: string) => void | Promise<void>;
}): ReactElement {
  const status = (proposal.status || "pending").toLowerCase();
  const isDone = status === "rejected" || status === "applied";
  const hasContent = typeof proposal.proposed_content === "string" && proposal.proposed_content.trim().length > 0;

  return (
    <details className="rounded-xl border border-border-main bg-background/40 overflow-hidden">
      <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold truncate" title={proposal.file_path}>
            {proposal.file_path || "<unknown file>"}
          </div>
          <div className="text-[10px] font-mono text-text-muted">
            {proposal.timestamp} • id: {proposal.proposal_id}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span
            className={clsx(
              "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border",
              status === "pending"
                ? "bg-amber-500/10 text-amber-200 border-amber-500/20"
                : status === "review_requested"
                  ? "bg-white/5 text-text-muted border-border-main"
                  : status === "applied"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            )}
          >
            {status || "pending"}
          </span>
        </div>
      </summary>
      <div className="px-4 pb-4 space-y-3">
        {proposal.suggestion && (
          <div className="text-[10px] text-text-muted font-mono whitespace-pre-wrap">
            {proposal.suggestion}
          </div>
        )}

        {!hasContent && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-200 px-3 py-2 text-[10px] font-mono">
            Proposal is missing <span className="font-bold">proposed_content</span>. Nothing can be reviewed or applied.
          </div>
        )}

        {hasContent && (
          <pre className="whitespace-pre-wrap break-words text-[10px] leading-relaxed font-mono text-[var(--text-main)] bg-background/60 border border-border-main rounded-lg p-3 overflow-x-auto custom-scrollbar max-h-64">
            {proposal.proposed_content}
          </pre>
        )}

        <div className="flex flex-wrap gap-2">
          {onRequestReview && !isDone && (
            <button
              onClick={() => onRequestReview(proposal)}
              disabled={!hasContent}
              className={clsx(
                "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
                "bg-[var(--accent-200)] text-[var(--accent-500)] border-[var(--accent-400)] hover:opacity-90",
                !hasContent && "opacity-50 cursor-not-allowed"
              )}
              title="Send this proposal to Guardian review (AI). You will still need to confirm apply."
            >
              Request Review
            </button>
          )}

          {onSetStatus && status !== "rejected" && (
            <button
              onClick={() => onSetStatus(proposal.proposal_id, "rejected")}
              className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20"
              title="Mark as rejected (append status to JSONL)"
            >
              Reject
            </button>
          )}

          {onSetStatus && status !== "applied" && (
            <button
              onClick={() => onSetStatus(proposal.proposal_id, "applied")}
              className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20"
              title="Mark as applied (append status to JSONL)"
            >
              Mark Applied
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

