import { useEffect, useState, type ReactElement } from "react";
import clsx from "clsx";
import { RefreshCcw, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import type { ReleaseDecisionStatus, ReleaseDecisionView } from "../types";
import { useI18n } from "../i18n";

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

function DecisionIcon({ decision }: { decision: ReleaseDecisionStatus }): ReactElement {
  if (decision === "PASS") return <ShieldCheck className="w-4 h-4 text-[color:var(--tone-success-text)]" />;
  if (decision === "PASS_WITH_WARNING") return <ShieldAlert className="w-4 h-4 text-[color:var(--tone-warning-text)]" />;
  return <ShieldX className="w-4 h-4 text-[color:var(--tone-critical-text)]" />;
}

export function ReleaseDecisionPanel({
  decision,
  loading,
  error,
  onRefresh,
  onSetDecision,
  onOverride,
}: ReleaseDecisionPanelProps): ReactElement {
  const { t } = useI18n();
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
    <div className="guardian-elevated-card rounded-2xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            {t("releaseDecision.title")}
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <DecisionIcon decision={currentDecision} />
            <span>{t(`releaseDecision.labels.${currentDecision}`)}</span>
          </div>
          {decision && (
            <div className="text-[10px] text-text-muted">
              {t("releaseDecision.metrics", {
                critical: decision.critical_findings,
                warning: decision.warning_findings,
                aiHeavy: decision.ai_heavy_change ? t("common.yes") : t("common.no"),
              })}
            </div>
          )}
        </div>
        <button
          onClick={() => void onRefresh()}
          disabled={loading || saving}
          className={clsx(
            "guardian-focus-ring px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors flex items-center gap-2 cursor-pointer",
            "bg-[var(--panel-muted)] text-text-muted border-border-main hover:bg-[var(--panel-bg)]",
            (loading || saving) && "opacity-50 cursor-not-allowed",
          )}
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          {t("common.refresh")}
        </button>
      </div>

      {error && <div className="text-[10px] font-mono text-[color:var(--tone-critical-text)]">{error}</div>}

      {decision?.decision_reasons?.length ? (
        <div className="guardian-subtle-card rounded-xl p-3 space-y-1">
          {decision.decision_reasons.slice(0, 4).map((item) => (
            <div key={item} className="text-[10px] text-text-muted">
              • {item}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-[10px] text-text-muted uppercase tracking-widest">
          {t("releaseDecision.approver")}
          <input
            className="guardian-focus-ring mt-1 w-full rounded-lg border border-border-main bg-[var(--panel-muted)] px-3 py-2 text-xs outline-none"
            value={approver}
            onChange={(event) => setApprover(event.target.value)}
            placeholder={t("releaseDecision.approverPlaceholder")}
          />
        </label>
        <label className="text-[10px] text-text-muted uppercase tracking-widest">
          {t("releaseDecision.reason")}
          <input
            className="guardian-focus-ring mt-1 w-full rounded-lg border border-border-main bg-[var(--panel-muted)] px-3 py-2 text-xs outline-none"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("releaseDecision.reasonPlaceholder")}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={selectedDecision}
          onChange={(event) =>
            setSelectedDecision(event.target.value as Exclude<ReleaseDecisionStatus, "OVERRIDDEN">)
          }
          className="guardian-focus-ring rounded-lg border border-border-main bg-[var(--panel-muted)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest"
        >
          <option value="PASS">{t("releaseDecision.labels.PASS")}</option>
          <option value="PASS_WITH_WARNING">{t("releaseDecision.labels.PASS_WITH_WARNING")}</option>
          <option value="BLOCK_UNTIL_APPROVED">
            {t("releaseDecision.labels.BLOCK_UNTIL_APPROVED")}
          </option>
        </select>
        <button
          onClick={() => void handleSetDecision()}
          disabled={saving || !approver.trim()}
          className={clsx(
            "guardian-focus-ring px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
            "bg-[var(--panel-muted)] text-[var(--accent-500)] border-[var(--panel-border-strong)] hover:bg-[var(--panel-bg)]",
            (saving || !approver.trim()) && "opacity-50 cursor-not-allowed",
          )}
        >
          {t("releaseDecision.saveDecision")}
        </button>
      </div>

      {needsOverride && (
        <div className="rounded-xl border p-3 space-y-2 border-[color:var(--tone-critical-border)] bg-[color:var(--tone-critical-bg)]">
          <div className="text-[10px] uppercase tracking-widest text-[color:var(--tone-critical-text)]">
            {t("releaseDecision.overrideTitle")}
          </div>
          <input
            className="guardian-focus-ring w-full rounded-lg border border-[color:var(--tone-critical-border)] bg-[var(--panel-muted)] px-3 py-2 text-xs outline-none text-text-main"
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            placeholder={t("releaseDecision.overridePlaceholder")}
          />
          <button
            onClick={() => void handleOverride()}
            disabled={saving || !approver.trim() || !overrideReason.trim()}
            className={clsx(
              "guardian-focus-ring px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
              "bg-[var(--panel-muted)] text-[color:var(--tone-critical-text)] border-[color:var(--tone-critical-border)] hover:bg-[color:var(--tone-critical-bg)]",
              (saving || !approver.trim() || !overrideReason.trim()) && "opacity-50 cursor-not-allowed",
            )}
          >
            {t("releaseDecision.overrideButton")}
          </button>
        </div>
      )}

      {decision?.audit_path && (
        <div className="text-[10px] text-text-muted font-mono break-all">
          {t("releaseDecision.auditPath")}: {decision.audit_path}
        </div>
      )}
    </div>
  );
}
