import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Copy, FileText, RefreshCw, Search } from "lucide-react";
import clsx from "clsx";
import type { FixProposal, FixProposalsSnapshot } from "../types";
import { basenameOf, copyToClipboard, formatTimestamp } from "../lib/uiFormat";

export interface FixProposalsViewProps {
  snapshot: FixProposalsSnapshot | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onRequestReview?: (proposal: FixProposal) => void | Promise<void>;
  onSetStatus?: (proposalId: string, status: string) => void | Promise<void>;
}

type ProposalFilter = "pending" | "review_requested" | "done" | "all";

const statusBadgeClass = (status: string): string => {
  const s = (status || "pending").toLowerCase();
  if (s === "pending") return "bg-amber-500/10 text-amber-200 border-amber-500/20";
  if (s === "review_requested") return "bg-white/5 text-text-muted border-border-main";
  if (s === "applied") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (s === "rejected") return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  return "bg-white/5 text-text-muted border-border-main";
};

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
  const reviewRequested = proposals.filter((p) => (p.status || "").toLowerCase() === "review_requested");

  const isEmpty = proposals.length === 0;

  if ((!snapshot && !loading && !error) || (snapshot && isEmpty && !loading && !error)) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-muted gap-4 py-12 px-6">
        <div className="w-16 h-16 rounded-2xl border border-border-main bg-background/40 flex items-center justify-center">
          <ClipboardList className="w-7 h-7 text-text-muted/80" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="font-bold text-sm text-text-main">Reviews Is Your Fix Proposal Inbox</h3>
          <p className="text-[10px] leading-relaxed max-w-md">
            Guardian can apply fixes instantly from <span className="font-bold">Monitor</span> and <span className="font-bold">Guru</span>.
            Fix Proposals are optional: use them when you want a review queue or CI-driven workflows.
          </p>
          <p className="text-[10px] leading-relaxed max-w-md">
            Advanced workflow: append JSONL proposals to{" "}
            <span className="font-mono text-[var(--text-main)]">.guardian-proposals/fix_proposals.jsonl</span>.
          </p>
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
    );
  }

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProposalFilter>("pending");

  const filteredProposals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return proposals
      .filter((p) => {
        const status = (p.status || "pending").toLowerCase();
        if (filter === "pending") return status !== "rejected" && status !== "applied" && status !== "review_requested";
        if (filter === "review_requested") return status === "review_requested";
        if (filter === "done") return status === "rejected" || status === "applied";
        return true;
      })
      .filter((p) => {
        if (!q) return true;
        const haystack = [
          p.file_path || "",
          p.proposal_id || "",
          p.status || "",
          p.timestamp || "",
          p.suggestion || "",
          p.proposed_content || "",
        ]
          .join("\n")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
  }, [proposals, query, filter]);

  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  useEffect(() => {
    if (filteredProposals.length === 0) {
      setSelectedProposalId(null);
      return;
    }
    if (!selectedProposalId) {
      setSelectedProposalId(filteredProposals[0].proposal_id);
      return;
    }
    const stillExists = filteredProposals.some((p) => p.proposal_id === selectedProposalId);
    if (!stillExists) {
      setSelectedProposalId(filteredProposals[0].proposal_id);
    }
  }, [filteredProposals, selectedProposalId]);

  const selectedProposal = useMemo(
    () => filteredProposals.find((p) => p.proposal_id === selectedProposalId) ?? null,
    [filteredProposals, selectedProposalId]
  );

  const selectedStatus = (selectedProposal?.status || "pending").toLowerCase();
  const selectedIsDone = selectedStatus === "rejected" || selectedStatus === "applied";
  const selectedHasContent =
    typeof selectedProposal?.proposed_content === "string" && selectedProposal.proposed_content.trim().length > 0;

  const onCopyProposedContent = useCallback(async (): Promise<void> => {
    if (!selectedProposal?.proposed_content) return;
    await copyToClipboard(selectedProposal.proposed_content);
  }, [selectedProposal]);

  const onCopyProposalJson = useCallback(async (): Promise<void> => {
    if (!selectedProposal) return;
    await copyToClipboard(JSON.stringify(selectedProposal, null, 2));
  }, [selectedProposal]);

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
                Updated: <span className="text-[var(--text-main)]">{formatTimestamp(snapshot.timestamp)}</span>
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

      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col px-6 py-4 gap-3">
          <div className="flex-1 min-h-0 rounded-2xl border border-border-main bg-background/30 overflow-hidden flex">
            <div className="w-[360px] shrink-0 border-r border-border-main bg-background/20 flex flex-col">
              <div className="p-3 border-b border-border-main space-y-2">
                <div className="group relative flex items-center gap-2 rounded-xl border border-border-main bg-background/60 px-3 py-2">
                  <Search className="w-3.5 h-3.5 text-zinc-500 group-focus-within:text-text-main transition-colors" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search proposals..."
                    className="w-full bg-transparent text-xs outline-none placeholder:opacity-50"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { key: "pending", label: `Pending ${pending.length}` },
                      { key: "review_requested", label: `Review Requested ${reviewRequested.length}` },
                      { key: "done", label: `Done ${done.length}` },
                      { key: "all", label: `All ${proposals.length}` },
                    ] as const
                  ).map(({ key, label }) => {
                    const active = filter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFilter(key)}
                        className={clsx(
                          "px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-colors",
                          active
                            ? "bg-surface/40 text-text-main border-border-main"
                            : "bg-background/60 text-text-muted border-border-main hover:bg-border-main"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {filteredProposals.length === 0 ? (
                  <div className="px-3 py-3 text-[10px] font-mono text-text-muted italic">
                    No proposals match the current filter.
                  </div>
                ) : (
                  filteredProposals.map((p) => {
                    const selected = p.proposal_id === selectedProposalId;
                    const status = (p.status || "pending").toLowerCase();
                    const filePath = p.file_path || "<unknown file>";
                    const title = basenameOf(filePath);
                    const excerpt = (p.suggestion || "").trim().split("\n")[0] || "";
                    return (
                      <button
                        key={p.proposal_id}
                        type="button"
                        onClick={() => setSelectedProposalId(p.proposal_id)}
                        className={clsx(
                          "w-full text-left rounded-xl border px-3 py-2 transition-colors",
                          selected
                            ? "bg-surface/30 border-border-main shadow-sm"
                            : "bg-background/40 border-border-main hover:bg-surface/20"
                        )}
                        aria-selected={selected}
                        title={filePath}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{title}</div>
                            <div className="text-[10px] font-mono text-text-muted truncate">
                              {filePath}
                            </div>
                            {excerpt && (
                              <div className="mt-1 text-[10px] text-text-muted line-clamp-2">
                                {excerpt}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <span
                              className={clsx(
                                "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border",
                                statusBadgeClass(status)
                              )}
                            >
                              {status}
                            </span>
                            <div className="text-[10px] font-mono text-text-muted tabular-nums">
                              {formatTimestamp(p.timestamp) || ""}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col">
              {!selectedProposal ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted text-sm px-6">
                  <div className="w-16 h-16 rounded-2xl border border-border-main bg-background/40 flex items-center justify-center">
                    <FileText className="w-7 h-7 text-text-muted/80" />
                  </div>
                  <div className="text-xs uppercase tracking-widest">Select a proposal.</div>
                  <div className="text-[10px] text-text-muted max-w-md text-center">
                    Use search and status filters to locate the proposal you want to inspect.
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
                  <div className="max-w-5xl mx-auto space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate" title={selectedProposal.file_path || ""}>
                          {selectedProposal.file_path || "<unknown file>"}
                        </div>
                        <div className="text-[10px] font-mono text-text-muted">
                          {formatTimestamp(selectedProposal.timestamp)} • id: {selectedProposal.proposal_id}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={onCopyProposedContent}
                          disabled={!selectedHasContent}
                          className={clsx(
                            "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors flex items-center gap-2 cursor-pointer",
                            "bg-background/60 text-text-muted border-border-main hover:bg-border-main",
                            !selectedHasContent && "opacity-50 cursor-not-allowed"
                          )}
                          title="Copy proposed content"
                        >
                          <Copy className="w-3 h-3" />
                          Copy Proposed Content
                        </button>
                        <button
                          type="button"
                          onClick={onCopyProposalJson}
                          className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors flex items-center gap-2 cursor-pointer bg-background/60 text-text-muted border-border-main hover:bg-border-main"
                          title="Copy proposal as JSON"
                        >
                          <Copy className="w-3 h-3" />
                          Copy Proposal JSON
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border",
                          statusBadgeClass(selectedStatus)
                        )}
                      >
                        {selectedStatus}
                      </span>
                      {selectedProposal.finding_id && (
                        <span className="px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border bg-background/60 text-text-muted border-border-main">
                          finding_id: {selectedProposal.finding_id}
                        </span>
                      )}
                    </div>

                    {selectedProposal.suggestion && (
                      <div className="text-[10px] text-text-muted font-mono whitespace-pre-wrap">
                        {selectedProposal.suggestion}
                      </div>
                    )}

                    {!selectedHasContent && (
                      <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-200 px-3 py-2 text-[10px] font-mono">
                        Proposal is missing <span className="font-bold">proposed_content</span>. Nothing can be reviewed or applied.
                      </div>
                    )}

                    {selectedHasContent && (
                      <pre className="whitespace-pre-wrap break-words text-[10px] leading-relaxed font-mono text-[var(--text-main)] bg-background/60 border border-border-main rounded-lg p-3 overflow-x-auto custom-scrollbar max-h-[420px]">
                        {selectedProposal.proposed_content}
                      </pre>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {onRequestReview && !selectedIsDone && (
                        <button
                          onClick={() => selectedProposal && onRequestReview(selectedProposal)}
                          disabled={!selectedHasContent}
                          className={clsx(
                            "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
                            "bg-[var(--accent-200)] text-[var(--accent-500)] border-[var(--accent-400)] hover:opacity-90",
                            !selectedHasContent && "opacity-50 cursor-not-allowed"
                          )}
                          title="Send this proposal to Guardian review (AI). You will still need to confirm apply."
                        >
                          Request Review
                        </button>
                      )}

                      {onSetStatus && selectedStatus !== "rejected" && (
                        <button
                          onClick={() => selectedProposal && onSetStatus(selectedProposal.proposal_id, "rejected")}
                          className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20"
                          title="Mark as rejected (append status to JSONL)"
                        >
                          Reject
                        </button>
                      )}

                      {onSetStatus && selectedStatus !== "applied" && (
                        <button
                          onClick={() => selectedProposal && onSetStatus(selectedProposal.proposal_id, "applied")}
                          className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20"
                          title="Mark as applied (append status to JSONL)"
                        >
                          Mark Applied
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
