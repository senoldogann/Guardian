import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Copy, FileText, Search } from "lucide-react";
import clsx from "clsx";
import type { FixProposal, FixProposalsSnapshot } from "../types";
import { basenameOf, copyToClipboard, formatTimestamp } from "../lib/uiFormat";
import { useToast } from "../hooks/useToast";
import { useI18n } from "../i18n";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

export interface FixProposalsViewProps {
  snapshot: FixProposalsSnapshot | null;
  loading?: boolean;
  error?: string | null;
  onRequestReview?: (proposal: FixProposal) => void | Promise<void>;
  onSetStatus?: (proposalId: string, status: string) => void | Promise<void>;
}

type ProposalFilter = "pending" | "review_requested" | "done" | "all";

const statusBadgeVariant = (status: string): "warning" | "neutral" | "success" | "danger" => {
  const s = (status || "pending").toLowerCase();
  if (s === "pending") return "warning";
  if (s === "review_requested") return "neutral";
  if (s === "applied") return "success";
  if (s === "rejected") return "danger";
  return "neutral";
};

export function FixProposalsView({
  snapshot,
  loading = false,
  error = null,
  onRequestReview,
  onSetStatus,
}: FixProposalsViewProps): ReactElement {
  const toast = useToast();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProposalFilter>("pending");

  const proposals = useMemo(() => snapshot?.proposals ?? [], [snapshot]);
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
  const showEmpty =
    (!snapshot && !loading && !error) || (snapshot && isEmpty && !loading && !error);

  if (showEmpty) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-muted gap-4 py-12 px-6">
        <div className="w-16 h-16 rounded-2xl border border-border-main bg-[var(--panel-muted)] flex items-center justify-center">
          <ClipboardList className="w-7 h-7 text-text-muted/80" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="font-bold text-sm text-text-main">{t("fixProposals.emptyTitle")}</h3>
          <p className="text-xs leading-relaxed max-w-md">
            {t("fixProposals.emptyNote")}
          </p>
          <p className="text-xs leading-relaxed max-w-md">
            {t("fixProposals.emptyAdvanced")}
          </p>
        </div>
        {/* Refresh is intentionally not shown here; use the global refresh controls instead. */}
      </div>
    );
  }

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
    try {
      await copyToClipboard(selectedProposal.proposed_content);
      toast.showSuccess(t("toast.copied"), 2500);
    } catch {
      toast.showError(t("toast.copyFailed"), 3000);
    }
  }, [selectedProposal, toast, t]);

  const onCopyProposalJson = useCallback(async (): Promise<void> => {
    if (!selectedProposal) return;
    try {
      await copyToClipboard(JSON.stringify(selectedProposal, null, 2));
      toast.showSuccess(t("toast.copied"), 2500);
    } catch {
      toast.showError(t("toast.copyFailed"), 3000);
    }
  }, [selectedProposal, toast, t]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-4 border-b border-border-main bg-surface/20">
        <div className="space-y-1 min-w-0">
          <h2 className="text-xs font-medium text-text-muted">
            {t("fixProposals.title")}
          </h2>
          {snapshot && (
            <div className="text-xs font-mono text-text-muted space-y-0.5">
              <div className="truncate">
                {t("fixProposals.source")}:{" "}
                <span className="text-[var(--text-main)]">{snapshot.source_path}</span>
              </div>
              <div className="truncate">
                {t("fixProposals.updated")}:{" "}
                <span className="text-[var(--text-main)]">{formatTimestamp(snapshot.timestamp)}</span>
              </div>
              <div>
                {t("fixProposals.pending")}:{" "}
                <span className="text-[var(--text-main)]">{pending.length}</span> | {t("fixProposals.done")}:{" "}
                <span className="text-[var(--text-main)]">{done.length}</span> | {t("fixProposals.total")}:{" "}
                <span className="text-[var(--text-main)]">{proposals.length}</span>
              </div>
            </div>
          )}
          {error && <div className="text-xs text-[color:var(--tone-critical-text)] font-mono">{error}</div>}
        </div>

        {/* Refresh is intentionally not shown here; use the global refresh controls instead. */}
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col px-6 py-4 gap-3">
          <div className="flex-1 min-h-0 rounded-2xl border border-border-main bg-[var(--panel-muted)] overflow-hidden flex">
            <div className="w-[360px] shrink-0 border-r border-border-main bg-[var(--panel-bg)] flex flex-col">
              <div className="p-3 border-b border-border-main space-y-2">
                <div className="group relative flex items-center gap-2 rounded-xl border border-border-main bg-[var(--panel-muted)] px-3 py-2">
                  <Search className="w-3.5 h-3.5 text-text-muted group-focus-within:text-text-main transition-colors" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("fixProposals.searchPlaceholder")}
                    className="guardian-focus-ring w-full bg-transparent text-xs outline-none placeholder:opacity-50"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { key: "pending", label: `${t("fixProposals.filterPending")} ${pending.length}` },
                      { key: "review_requested", label: `${t("fixProposals.filterReviewRequested")} ${reviewRequested.length}` },
                      { key: "done", label: `${t("fixProposals.filterDone")} ${done.length}` },
                      { key: "all", label: `${t("fixProposals.filterAll")} ${proposals.length}` },
                    ] as const
                  ).map(({ key, label }) => {
                    const active = filter === key;
                    return (
                      <Button
                        key={key}
                        type="button"
                        onClick={() => setFilter(key)}
                        variant={active ? "accent" : "secondary"}
                        size="sm"
                        className={active ? "bg-surface/40 text-text-main border-border-main" : undefined}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {filteredProposals.length === 0 ? (
                  <div className="px-3 py-3 text-xs font-mono text-text-muted italic">
                    {t("fixProposals.noMatch")}
                  </div>
                ) : (
                  filteredProposals.map((p) => {
                    const selected = p.proposal_id === selectedProposalId;
                    const status = (p.status || "pending").toLowerCase();
                    const filePath = p.file_path || t("fixProposals.unknownFile");
                    const title = basenameOf(filePath);
                    const excerpt = (p.suggestion || "").trim().split("\n")[0] || "";
                    return (
                      <button
                        key={p.proposal_id}
                        type="button"
                        onClick={() => setSelectedProposalId(p.proposal_id)}
                        className={clsx(
                          "guardian-focus-ring w-full text-left rounded-xl border px-3 py-2 transition-colors",
                          selected
                            ? "bg-surface/30 border-border-main shadow-sm"
                            : "bg-[var(--panel-muted)] border-border-main hover:bg-[var(--panel-bg)]"
                        )}
                        aria-selected={selected}
                        title={filePath}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{title}</div>
                            <div className="text-xs font-mono text-text-muted truncate">
                              {filePath}
                            </div>
                            {excerpt && (
                              <div className="mt-1 text-xs text-text-muted line-clamp-2">
                                {excerpt}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <Badge variant={statusBadgeVariant(status)} size="md">
                              {status}
                            </Badge>
                            <div className="text-xs font-mono text-text-muted tabular-nums">
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
                  <div className="w-16 h-16 rounded-2xl border border-border-main bg-[var(--panel-muted)] flex items-center justify-center">
                    <FileText className="w-7 h-7 text-text-muted/80" />
                  </div>
                  <div className="text-xs">{t("fixProposals.selectTitle")}</div>
                  <div className="text-xs text-text-muted max-w-md text-center">
                    {t("fixProposals.selectNote")}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
                  <div className="max-w-5xl mx-auto space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate" title={selectedProposal.file_path || ""}>
                          {selectedProposal.file_path || t("fixProposals.unknownFile")}
                        </div>
                        <div className="text-xs font-mono text-text-muted">
                          {formatTimestamp(selectedProposal.timestamp)} • id: {selectedProposal.proposal_id}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={onCopyProposedContent}
                          disabled={!selectedHasContent}
                          variant="secondary"
                          size="md"
                          title={t("fixProposals.copyProposedContentTitle")}
                          leadingIcon={<Copy className="w-3 h-3" />}
                        >
                          {t("fixProposals.copyProposedContent")}
                        </Button>
                        <Button
                          type="button"
                          onClick={onCopyProposalJson}
                          variant="secondary"
                          size="md"
                          title={t("fixProposals.copyProposalJsonTitle")}
                          leadingIcon={<Copy className="w-3 h-3" />}
                        >
                          {t("fixProposals.copyProposalJson")}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={statusBadgeVariant(selectedStatus)} size="md">
                        {selectedStatus}
                      </Badge>
                      {selectedProposal.finding_id && (
                        <Badge variant="neutral" size="md">
                          finding_id: {selectedProposal.finding_id}
                        </Badge>
                      )}
                    </div>

                    {selectedProposal.suggestion && (
                      <div className="text-xs text-text-muted font-mono whitespace-pre-wrap">
                        {selectedProposal.suggestion}
                      </div>
                    )}

                    {!selectedHasContent && (
                      <div className="rounded-lg border border-[color:var(--tone-critical-border)] bg-[color:var(--tone-critical-bg)] text-[color:var(--tone-critical-text)] px-3 py-2 text-xs font-mono">
                        {t("fixProposals.missingProposedContent")}
                      </div>
                    )}

                    {selectedHasContent && (
                      <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed font-mono text-[var(--text-main)] bg-[var(--panel-muted)] border border-border-main rounded-lg p-3 overflow-x-auto custom-scrollbar max-h-[420px]">
                        {selectedProposal.proposed_content}
                      </pre>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {onRequestReview && !selectedIsDone && (
                        <Button
                          onClick={() => selectedProposal && onRequestReview(selectedProposal)}
                          disabled={!selectedHasContent}
                          variant="accent"
                          size="md"
                          title={t("fixProposals.requestReviewTitle")}
                        >
                          {t("fixProposals.requestReview")}
                        </Button>
                      )}

                      {onSetStatus && selectedStatus !== "rejected" && (
                        <Button
                          onClick={() => selectedProposal && onSetStatus(selectedProposal.proposal_id, "rejected")}
                          variant="danger"
                          size="md"
                          title={t("fixProposals.rejectTitle")}
                        >
                          {t("fixProposals.reject")}
                        </Button>
                      )}

                      {onSetStatus && selectedStatus !== "applied" && (
                        <Button
                          onClick={() => selectedProposal && onSetStatus(selectedProposal.proposal_id, "applied")}
                          variant="success"
                          size="md"
                          title={t("fixProposals.markAppliedTitle")}
                        >
                          {t("fixProposals.markApplied")}
                        </Button>
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
