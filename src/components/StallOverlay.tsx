import { useRef, type ReactElement } from "react";
import { ShieldAlert } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useI18n } from "../i18n";
import { Button } from "./ui/Button";
import { DialogShell } from "./ui/DialogShell";
import { Panel } from "./ui/Panel";

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
    <DialogShell
      open={open && Boolean(stalled)}
      onClose={onDismiss}
      title={(
        <span className="inline-flex items-center gap-3 text-text-main">
          <ShieldAlert className="w-5 h-5 text-[var(--accent-500)] animate-pulse" />
          {t("stall.title")}
        </span>
      )}
      showCloseButton={false}
      panelClassName="max-w-xl w-[90%]"
      contentClassName="pt-4"
    >
      <div ref={modalRef} className="space-y-4">
        <Panel surface="background" padding="md" rounded="xl" className="space-y-2">
          <p className="text-sm text-text-muted leading-relaxed">
            {t("stall.notePrefix")} {" "}
            <span className="font-bold break-all">{fileName}</span>.{" "}
            {t("stall.noteSuffix")}
          </p>
          <p className="text-xs text-text-muted/70 break-all">
            {stalled.file}
          </p>
        </Panel>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              onResolve();
            }}
            variant="primary"
            size="md"
            ref={resolveButtonRef}
          >
            {t("stall.resolve")}
          </Button>
          <Button onClick={onDismiss} variant="secondary" size="md">
            {t("stall.dismiss")}
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}

export default StallOverlay;
