import { useId, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

export interface DialogShellProps {
    open: boolean;
    title?: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    onClose?: () => void;
    closeLabel?: string;
    footer?: ReactNode;
    overlayClassName?: string;
    panelClassName?: string;
    contentClassName?: string;
    headerClassName?: string;
    dismissOnBackdrop?: boolean;
    showCloseButton?: boolean;
    header?: ReactNode;
}

export function DialogShell({
    open,
    title,
    description,
    children,
    onClose,
    closeLabel,
    footer,
    overlayClassName,
    panelClassName,
    contentClassName,
    headerClassName,
    dismissOnBackdrop,
    showCloseButton,
    header,
}: DialogShellProps): ReactElement | null {
    const titleId = useId();
    const descriptionId = useId();
    const resolvedDismissOnBackdrop = dismissOnBackdrop ?? true;
    const resolvedShowCloseButton = showCloseButton ?? true;
    const resolvedCloseLabel = closeLabel ?? "Close";

    if (!open) {
        return null;
    }

    const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
        if (!resolvedDismissOnBackdrop || !onClose) {
            return;
        }
        if (event.target === event.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className={clsx("fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm", overlayClassName)}
            onMouseDown={handleBackdropMouseDown}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-describedby={description ? descriptionId : undefined}
                className={twMerge("guardian-elevated-card w-[92%] max-w-lg rounded-2xl shadow-2xl", panelClassName)}
            >
                {header ? (
                    header
                ) : title || description || resolvedShowCloseButton ? (
                    <div className={clsx("flex items-start justify-between gap-4 px-5 pt-5", headerClassName)}>
                        <div className="min-w-0">
                            {title ? (
                                <div id={titleId} className="text-sm font-semibold text-text-main">
                                    {title}
                                </div>
                            ) : null}
                            {description ? (
                                <div id={descriptionId} className="mt-1 text-xs text-text-muted">
                                    {description}
                                </div>
                            ) : null}
                        </div>
                        {resolvedShowCloseButton && onClose ? (
                            <button
                                type="button"
                                onClick={onClose}
                                className="guardian-focus-ring rounded-lg p-1.5 text-text-muted transition-colors hover:bg-[var(--panel-muted)] hover:text-text-main cursor-pointer"
                                aria-label={resolvedCloseLabel}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        ) : null}
                    </div>
                ) : null}

                <div className={twMerge("px-5 pb-5 pt-4", contentClassName)}>{children}</div>
                {footer ? <div className="px-5 pb-5">{footer}</div> : null}
            </div>
        </div>
    );
}