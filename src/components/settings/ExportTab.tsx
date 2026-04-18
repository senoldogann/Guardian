import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Download, RefreshCw } from "lucide-react";
import { useI18n } from "../../i18n";

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
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
        <Download className="w-4 h-4 text-[var(--accent-500)]" />
        {t("settings.export.title")}
      </div>
      <div className="text-[10px] text-text-muted bg-[var(--panel-muted)] border border-border-main rounded-lg px-3 py-2">
        {t("settings.export.note")}
      </div>
      <button
        onClick={onExportPDF}
        disabled={exportPdfInProgress}
        className="w-full px-3 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] text-background rounded-md hover:opacity-90 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:opacity-60"
      >
        {exportPdfInProgress ? t("settings.export.exporting") : t("settings.export.exportPdf")}
      </button>
      {exportPdfInProgress && (
        <div className="rounded-lg border border-border-main bg-[var(--panel-muted)] px-3 py-2 text-[10px] text-text-muted flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent-500)] shrink-0" />
          <span className="transition-opacity duration-300">
            {exportStatusMessages[exportStatusMessageIndex]}
          </span>
        </div>
      )}
      {/* Success feedback is shown via top-right toast to reduce clutter in this tab. */}
      {exportPdfError && !exportPdfInProgress && (
        <div className="rounded-lg border border-[color:var(--tone-critical-border)] bg-[color:var(--tone-critical-bg)] px-3 py-2 text-[10px] text-[color:var(--tone-critical-text)] font-bold">
          {exportPdfError}
        </div>
      )}
    </div>
  );
}
