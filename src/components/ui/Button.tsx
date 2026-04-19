import { forwardRef, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from "react";
import clsx from "clsx";

export type ButtonVariant =
    | "primary"
    | "secondary"
    | "ghost"
    | "danger"
    | "success"
    | "warning"
    | "accent";

export type ButtonSize = "sm" | "md" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant: ButtonVariant;
    size: ButtonSize;
    leadingIcon?: ReactNode;
    trailingIcon?: ReactNode;
    fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary: "bg-[var(--accent-500)] text-[var(--on-accent)] hover:opacity-90",
    secondary: "border border-border-main bg-[var(--panel-muted)] text-text-main hover:bg-[var(--panel-bg)]",
    ghost: "text-text-muted hover:bg-[var(--panel-muted)] hover:text-text-main",
    danger:
        "border border-[color:var(--tone-critical-border)] bg-[color:var(--tone-critical-bg)] text-[color:var(--tone-critical-text)] hover:opacity-90",
    success:
        "border border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-bg)] text-[color:var(--tone-success-text)] hover:opacity-90",
    warning:
        "border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-bg)] text-[color:var(--tone-warning-text)] hover:opacity-90",
    accent: "border border-[var(--accent-400)] bg-[var(--accent-200)] text-[var(--accent-500)] hover:opacity-90",
};

const sizeClasses: Record<ButtonSize, string> = {
    sm: "min-h-8 rounded-md px-2.5 py-1.5 text-[11px]",
    md: "min-h-9 rounded-lg px-3 py-2 text-xs",
    icon: "h-9 w-9 rounded-lg p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
        variant,
        size,
        leadingIcon,
        trailingIcon,
        fullWidth,
        className,
        children,
        type,
        ...props
    }: ButtonProps,
    ref,
): ReactElement {
    const resolvedType = type ?? "button";

    return (
        <button
            ref={ref}
            type={resolvedType}
            className={clsx(
                "guardian-focus-ring inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
                variantClasses[variant],
                sizeClasses[size],
                fullWidth && "w-full",
                className,
            )}
            {...props}
        >
            {leadingIcon ? <span className="shrink-0" aria-hidden="true">{leadingIcon}</span> : null}
            {children}
            {trailingIcon ? <span className="shrink-0" aria-hidden="true">{trailingIcon}</span> : null}
        </button>
    );
});