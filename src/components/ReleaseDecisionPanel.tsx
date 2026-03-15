import { useEffect, useState, type ReactElement } from "react";
import clsx from "clsx";
import { ShieldCheck, ShieldAlert, ShieldX, RefreshCcw } from "lucide-react";
import type { ReleaseDecisionStatus, ReleaseDecisionView } from "../types";

interface ReleaseDecisionPanelProps {
  decision: ReleaseDecisionView | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onSetDecision: (
    decision: Exclude<ReleaseDecisionStatus, "OVERRIDDEN">,
    approver: string,
    reason?: string,
  ) => Promise<void>;
  onOverride: (approver: string, reason: string) => Promise<void>;
}

const decisionLabel: Record<ReleaseDecisionStatus, string> = {
  PASS: "Pass",
  PASS_WITH_WARNING: "Pass With Warning",
  BLOCK_UNTIL_APPROVED: "Block Until Approved",
  OVERRIDDEN: "Overridden",
};

function DecisionIcon({ decision }: { decision: ReleaseDecisionStatus }): ReactElement {
  if (decision === "PASS") return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
  if (decision === "PASS_WITH_WARNING") return <ShieldAlert className="w-4 h-4 text-amber-400" />;
  return <ShieldX className="w-4 h-4 text-rose-400" />;
}

export function ReleaseDecisionPanel({
  decision,
  loading,
  error,
  onRefresh,
  onSetDecision,
  onOverride,
}: ReleaseDecisionPanelProps): ReactElement {
  const [approver, setApprover] = useState("");
  const [reason, setReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [selectedDecision, setSelectedDecision] = useState<
    Exclude<ReleaseDecisionStatus, "OVERRIDDEN">
  >("PASS_WITH_WARNING");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (decision?.approver) {
      setApprover((prev) => (prev.trim() ? prev : decision.approver ?? ""));
    }
    if (decision?.reason && !reason.trim()) {
      setReason(decision.reason);
    }
  }, [decision, reason]);

  const currentDecision = decision?.decision ?? "PASS";
  const needsOverride = currentDecision === "BLOCK_UNTIL_APPROVED";

  const handleSetDecision = async (): Promise<void> => {
    if (!approver.trim()) return;
    setSaving(true);
    try {
      await onSetDecision(selectedDecision, approver.trim(), reason.trim() || undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleOverride = async (): Promise<void> => {
    if (!approver.trim() || !overrideReason.trim()) return;
    setSaving(true);
    try {
      await onOverride(approver.trim(), overrideReason.trim());
      setOverrideReason("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border-main bg-background/30 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Release Decision
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <DecisionIcon decision={currentDecision} />
            <span>{decisionLabel[currentDecision]}</span>
          </div>
          {decision && (
            <div className="text-[10px] text-text-muted">
              Critical: {decision.critical_findings} • Warning: {decision.warning_findings} • AI-heavy:{" "}
              {decision.ai_heavy_change ? "yes" : "no"}
            </div>
          )}
        </div>
        <button
          onClick={() => void onRefresh()}
          disabled={loading || saving}
          className={clsx(
            "px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors flex items-center gap-2 cursor-pointer",
            "bg-background/60 text-text-muted border-border-main hover:bg-border-main",
            (loading || saving) && "opacity-50 cursor-not-allowed",
          )}
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {error && <div className="text-[10px] font-mono text-rose-400">{error}</div>}

      {decision?.decision_reasons?.length ? (
        <div className="rounded-xl border border-border-main bg-background/40 p-3 space-y-1">
          {decision.decision_reasons.slice(0, 4).map((item) => (
            <div key={item} className="text-[10px] text-text-muted">
              • {item}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-[10px] text-text-muted uppercase tracking-widest">
          Approver
          <input
            className="mt-1 w-full rounded-lg border border-border-main bg-background/40 px-3 py-2 text-xs outline-none"
            value={approver}
            onChange={(event) => setApprover(event.target.value)}
            placeholder="release-manager"
          />
        </label>
        <label className="text-[10px] text-text-muted uppercase tracking-widest">
          Reason
          <input
            className="mt-1 w-full rounded-lg border border-border-main bg-background/40 px-3 py-2 text-xs outline-none"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Approved after architectural review"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={selectedDecision}
          onChange={(event) =>
            setSelectedDecision(event.target.value as Exclude<ReleaseDecisionStatus, "OVERRIDDEN">)
          }
          className="rounded-lg border border-border-main bg-background/60 px-3 py-2 text-[10px] font-bold uppercase tracking-widest"
        >
          <option value="PASS">Pass</option>
          <option value="PASS_WITH_WARNING">Pass With Warning</option>
          <option value="BLOCK_UNTIL_APPROVED">Block Until Approved</option>
        </select>
        <button
          onClick={() => void handleSetDecision()}
          disabled={saving || !approver.trim()}
          className={clsx(
            "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15",
            (saving || !approver.trim()) && "opacity-50 cursor-not-allowed",
          )}
        >
          Save Decision
        </button>
      </div>

      {needsOverride && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-rose-300">
            Block override
          </div>
          <input
            className="w-full rounded-lg border border-rose-500/20 bg-background/40 px-3 py-2 text-xs outline-none"
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            placeholder="Override reason (required)"
          />
          <button
            onClick={() => void handleOverride()}
            disabled={saving || !approver.trim() || !overrideReason.trim()}
            className={clsx(
              "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
              "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/15",
              (saving || !approver.trim() || !overrideReason.trim()) &&
                "opacity-50 cursor-not-allowed",
            )}
          >
            Override Block
          </button>
        </div>
      )}
    </div>
  );
}

