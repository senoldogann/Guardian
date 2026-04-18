import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import clsx from "clsx";

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger" | "ai";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant: BadgeVariant;
    size: BadgeSize;
    children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
    neutral: "border border-border-main bg-[var(--panel-muted)] text-text-muted",
    accent: "border border-[var(--accent-400)] bg-[var(--accent-200)] text-[var(--accent-500)]",
    success:
        "border border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-bg)] text-[color:var(--tone-success-text)]",
    warning:
        "border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-bg)] text-[color:var(--tone-warning-text)]",
    danger:
        "border border-[color:var(--tone-critical-border)] bg-[color:var(--tone-critical-bg)] text-[color:var(--tone-critical-text)]",
    ai: "border border-[color:var(--tone-ai-border)] bg-[color:var(--tone-ai-bg)] text-[color:var(--tone-ai-text)]",
};

const sizeClasses: Record<BadgeSize, string> = {
    sm: "rounded-md px-1.5 py-0.5 text-[11px]",
    md: "rounded-md px-2 py-1 text-xs",
};

export function Badge({ variant, size, className, children, ...props }: BadgeProps): ReactElement {
    return (
        <span
            className={clsx(
                "inline-flex items-center justify-center font-medium tabular-nums",
                variantClasses[variant],
                sizeClasses[size],
                className,
            )}
            {...props}
        >
            {children}
        </span>
    );
}