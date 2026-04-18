import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Download, RefreshCw } from "lucide-react";
import { useI18n } from "../../i18n";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { SectionHeader } from "../ui/SectionHeader";

export interface ExportTabProps {
  onExportPDF: () => void;
  exportPdfInProgress: boolean;
  exportPdfError: string | null;
}

export function ExportTab({
  onExportPDF,
  exportPdfInProgress,
  exportPdfError,
}: ExportTabProps): ReactElement {
  const { t } = useI18n();

  const exportStatusMessages = useMemo(
    () => [
      t("settings.export.preparing"),
      t("settings.export.rendering"),
      t("settings.export.finalizing"),
      t("settings.export.openingFolder"),
    ],
    [t],
  );

  const [exportStatusMessageIndex, setExportStatusMessageIndex] = useState(0);

  useEffect(() => {
    if (!exportPdfInProgress) {
      setExportStatusMessageIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      setExportStatusMessageIndex((prev) => (prev + 1) % exportStatusMessages.length);
    }, 1200);
    return () => window.clearInterval(interval);
  }, [exportPdfInProgress, exportStatusMessages.length]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("settings.export.title")}
        icon={<Download className="w-4 h-4 text-[var(--accent-500)]" />}
      />
      <Panel surface="muted" padding="sm" rounded="lg" className="text-xs text-text-muted">
        {t("settings.export.note")}
      </Panel>
      <Button
        onClick={onExportPDF}
        disabled={exportPdfInProgress}
        variant="primary"
        size="md"
        fullWidth
      >
        {exportPdfInProgress ? t("settings.export.exporting") : t("settings.export.exportPdf")}
      </Button>
      {exportPdfInProgress && (
        <Panel surface="muted" padding="sm" rounded="lg" className="flex items-center gap-2 text-xs text-text-muted">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent-500)] shrink-0" />
          <span className="transition-opacity duration-300">
            {exportStatusMessages[exportStatusMessageIndex]}
          </span>
        </Panel>
      )}
      {/* Success feedback is shown via top-right toast to reduce clutter in this tab. */}
      {exportPdfError && !exportPdfInProgress && (
        <div className="rounded-lg border border-[color:var(--tone-critical-border)] bg-[color:var(--tone-critical-bg)] px-3 py-2 text-xs text-[color:var(--tone-critical-text)] font-bold">
          {exportPdfError}
        </div>
      )}
    </div>
  );
}
