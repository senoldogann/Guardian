import type {
    InputHTMLAttributes,
    ReactElement,
    ReactNode,
    SelectHTMLAttributes,
    TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

export interface FieldProps {
    label?: ReactNode;
    note?: ReactNode;
    error?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
}

const controlClassName =
    "guardian-focus-ring w-full rounded-lg border border-border-main bg-[var(--panel-muted)] px-3 py-2 text-xs text-text-main outline-none transition-colors focus:border-[var(--focus-border)]";

export function Field({ label, note, error, action, children, className, contentClassName }: FieldProps): ReactElement {
    return (
        <div className={clsx("space-y-1.5", className)}>
            {label || action ? (
                <div className="flex items-center justify-between gap-3">
                    {label ? <label className="text-xs text-text-muted">{label}</label> : <span />}
                    {action}
                </div>
            ) : null}
            <div className={contentClassName}>{children}</div>
            {note ? <div className="text-xs text-text-muted">{note}</div> : null}
            {error ? <div className="text-xs text-[color:var(--tone-critical-text)]">{error}</div> : null}
        </div>
    );
}

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className, type, ...props }: TextInputProps): ReactElement {
    const resolvedType = type ?? "text";
    return <input type={resolvedType} className={clsx(controlClassName, className)} {...props} />;
}

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ className, ...props }: TextAreaProps): ReactElement {
    return <textarea className={clsx(controlClassName, "min-h-24 resize-y", className)} {...props} />;
}

export interface SelectControlProps extends SelectHTMLAttributes<HTMLSelectElement> {
    children: ReactNode;
}

export function SelectControl({ children, className, ...props }: SelectControlProps): ReactElement {
    return (
        <div className="relative group">
            <select
                className={clsx(controlClassName, "appearance-none cursor-pointer pr-8", className)}
                {...props}
            >
                {children}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted transition-colors group-hover:text-text-main" />
        </div>
    );
}

export const FieldControlClassName = controlClassName;