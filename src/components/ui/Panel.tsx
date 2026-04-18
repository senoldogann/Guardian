import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import clsx from "clsx";

export type PanelSurface = "elevated" | "subtle" | "muted" | "background";
export type PanelPadding = "none" | "sm" | "md" | "lg";
export type PanelRounded = "lg" | "xl" | "2xl";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
    surface: PanelSurface;
    padding: PanelPadding;
    rounded: PanelRounded;
    children: ReactNode;
}

const surfaceClasses: Record<PanelSurface, string> = {
    elevated: "guardian-elevated-card",
    subtle: "guardian-subtle-card",
    muted: "border border-border-main bg-[var(--panel-muted)]",
    background: "border border-border-main bg-background/60",
};

const paddingClasses: Record<PanelPadding, string> = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
};

const roundedClasses: Record<PanelRounded, string> = {
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
};

export function Panel({ surface, padding, rounded, className, children, ...props }: PanelProps): ReactElement {
    return (
        <div
            className={clsx(surfaceClasses[surface], paddingClasses[padding], roundedClasses[rounded], className)}
            {...props}
        >
            {children}
        </div>
    );
}

export const Card = Panel;