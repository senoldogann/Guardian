import { useRef, type ReactElement } from "react";
import { ShieldAlert } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useI18n } from "../i18n";

export interface StallOverlayProps {
  stalled: { file: string; reason: string } | null;
  open: boolean;
  onResolve: () => void;
  onDismiss: () => void;
}

export function StallOverlay({ stalled, open, onResolve, onDismiss }: StallOverlayProps): ReactElement | null {
  const { t } = useI18n();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const resolveButtonRef = useRef<HTMLButtonElement | null>(null);

  useFocusTrap({
    active: open && Boolean(stalled),
    containerRef: modalRef,
    onEscape: onDismiss,
    initialFocusRef: resolveButtonRef,
  });

  if (!stalled || !open) return null;
  const fileName = stalled.file.split("/").pop() || stalled.file;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div
        ref={modalRef}
        className="max-w-xl w-[90%] bg-surface border border-border-main rounded-2xl p-8 shadow-2xl shadow-black/25"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guardian-stall-title"
      >
        <div className="flex items-center gap-3 mb-4">
          <ShieldAlert className="w-6 h-6 text-[var(--accent-500)] animate-pulse" />
          <h2
            id="guardian-stall-title"
            className="text-lg font-black uppercase tracking-widest text-text-main"
          >
            {t("stall.title")}
          </h2>
        </div>
        <p className="text-sm text-text-muted leading-relaxed">
          {t("stall.notePrefix")}{" "}
          <span className="font-bold break-all">{fileName}</span>.{" "}
          {t("stall.noteSuffix")}
        </p>
        <p className="text-xs text-text-muted/70 mt-2 break-all">
          {stalled.file}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              onResolve();
            }}
            className="px-4 py-2 bg-[var(--accent-500)] hover:opacity-90 text-background font-bold rounded-lg text-xs uppercase tracking-widest transition-colors"
            ref={resolveButtonRef}
          >
            {t("stall.resolve")}
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 bg-[var(--accent-200)] hover:opacity-90 text-text-main font-bold rounded-lg text-xs uppercase tracking-widest transition-colors"
          >
            {t("stall.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StallOverlay;
