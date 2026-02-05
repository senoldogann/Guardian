import type { ReactElement } from "react";
import { ShieldAlert } from "lucide-react";

export interface StallOverlayProps {
  stalled: { file: string; reason: string } | null;
  open: boolean;
  onResolve: () => void;
  onDismiss: () => void;
}

export function StallOverlay({ stalled, open, onResolve, onDismiss }: StallOverlayProps): ReactElement | null {
  if (!stalled || !open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div
        className="max-w-xl w-[90%] bg-surface border border-border-main rounded-2xl p-8 shadow-2xl shadow-black/25"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center gap-3 mb-4">
          <ShieldAlert className="w-6 h-6 text-[var(--accent-500)] animate-pulse" />
          <h2 className="text-lg font-black uppercase tracking-widest text-text-main">Critical Stall</h2>
        </div>
        <p className="text-sm text-text-muted leading-relaxed">
          Critical violation detected in <span className="font-bold">{stalled.file.split('/').pop()}</span>.
          Real-time monitoring is paused for safety. Resolve the issue in Guru to continue.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              onResolve();
            }}
            className="px-4 py-2 bg-[var(--accent-500)] hover:opacity-90 text-background font-bold rounded-lg text-xs uppercase tracking-widest transition-colors"
          >
            Resolve In Guru
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 bg-[var(--accent-200)] hover:opacity-90 text-text-main font-bold rounded-lg text-xs uppercase tracking-widest transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export default StallOverlay;
