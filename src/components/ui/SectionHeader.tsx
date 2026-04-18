import type { ReactElement, ReactNode } from "react";
import clsx from "clsx";

export interface SectionHeaderProps {
    title: ReactNode;
    icon?: ReactNode;
    note?: ReactNode;
    action?: ReactNode;
    className?: string;
}

export function SectionHeader({ title, icon, note, action, className }: SectionHeaderProps): ReactElement {
    return (
        <div className={clsx("flex items-start justify-between gap-4", className)}>
            <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
                    {icon}
                    {title}
                </div>
                {note ? <div className="mt-1 text-xs text-text-muted">{note}</div> : null}
            </div>
            {action}
        </div>
    );
}