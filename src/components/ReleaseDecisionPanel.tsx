import { useEffect, useState, type ReactElement } from "react";
import { RefreshCcw, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import type { ReleaseDecisionStatus, ReleaseDecisionView } from "../types";
import { useI18n } from "../i18n";
import { Button } from "./ui/Button";
import { Field, SelectControl, TextInput } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { handleAsync } from "../lib/safeAsync";

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
    <Panel surface="elevated" padding="md" rounded="2xl" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs font-medium text-text-muted">
            {t("releaseDecision.title")}
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <DecisionIcon decision={currentDecision} />
            <span>{t(`releaseDecision.labels.${currentDecision}`)}</span>
          </div>
          {decision && (
            <div className="text-xs text-text-muted">
              {t("releaseDecision.metrics", {
                critical: decision.critical_findings,
                warning: decision.warning_findings,
                aiHeavy: decision.ai_heavy_change ? t("common.yes") : t("common.no"),
              })}
            </div>
          )}
        </div>
        <Button
          onClick={handleAsync(() => onRefresh(), "Refresh failed")}
          disabled={loading || saving}
          variant="secondary"
          size="sm"
          leadingIcon={<RefreshCcw className="w-3.5 h-3.5" />}
        >
          {t("common.refresh")}
        </Button>
      </div>

      {error && <div className="text-xs font-mono text-[color:var(--tone-critical-text)]">{error}</div>}

      {decision?.decision_reasons?.length ? (
        <Panel surface="subtle" padding="sm" rounded="xl" className="space-y-1">
          {decision.decision_reasons.slice(0, 4).map((item) => (
            <div key={item} className="text-xs text-text-muted">
              • {item}
            </div>
          ))}
        </Panel>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label={t("releaseDecision.approver")}>
          <TextInput
            value={approver}
            onChange={(event) => setApprover(event.target.value)}
            placeholder={t("releaseDecision.approverPlaceholder")}
          />
        </Field>
        <Field label={t("releaseDecision.reason")}>
          <TextInput
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("releaseDecision.reasonPlaceholder")}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <SelectControl
          value={selectedDecision}
          onChange={(event) =>
            setSelectedDecision(event.target.value as Exclude<ReleaseDecisionStatus, "OVERRIDDEN">)
          }
          className="min-w-[220px]"
        >
          <option value="PASS">{t("releaseDecision.labels.PASS")}</option>
          <option value="PASS_WITH_WARNING">{t("releaseDecision.labels.PASS_WITH_WARNING")}</option>
          <option value="BLOCK_UNTIL_APPROVED">
            {t("releaseDecision.labels.BLOCK_UNTIL_APPROVED")}
          </option>
        </SelectControl>
        <Button
          onClick={handleAsync(() => handleSetDecision(), "Decision failed")}
          disabled={saving || !approver.trim()}
          variant="secondary"
          size="md"
          className="text-[var(--accent-500)] border-[var(--panel-border-strong)]"
        >
          {t("releaseDecision.saveDecision")}
        </Button>
      </div>

      {needsOverride && (
        <Panel
          surface="muted"
          padding="sm"
          rounded="xl"
          className="space-y-2 border-[color:var(--tone-critical-border)] bg-[color:var(--tone-critical-bg)]"
        >
          <div className="text-xs text-[color:var(--tone-critical-text)]">
            {t("releaseDecision.overrideTitle")}
          </div>
          <TextInput
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            placeholder={t("releaseDecision.overridePlaceholder")}
            className="border-[color:var(--tone-critical-border)]"
          />
          <Button
            onClick={handleAsync(() => handleOverride(), "Override failed")}
            disabled={saving || !approver.trim() || !overrideReason.trim()}
            variant="danger"
            size="md"
          >
            {t("releaseDecision.overrideButton")}
          </Button>
        </Panel>
      )}

      {decision?.audit_path && (
        <div className="text-xs text-text-muted font-mono break-all">
          {t("releaseDecision.auditPath")}: {decision.audit_path}
        </div>
      )}
    </Panel>
  );
}
