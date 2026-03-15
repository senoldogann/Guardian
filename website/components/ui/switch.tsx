"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
}

export function Switch({ checked, onCheckedChange, disabled = false, className, ariaLabel }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => !disabled && onCheckedChange(!checked)}
            className={cn(
                "w-12 h-7 rounded-full p-1 transition-colors relative focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white",
                checked ? "bg-black dark:bg-white" : "bg-zinc-200 dark:bg-zinc-800",
                disabled && "opacity-50 cursor-not-allowed",
                className
            )}
        >
            <motion.div
                initial={false}
                animate={{
                    x: checked ? 20 : 0
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                    "w-5 h-5 rounded-full shadow-sm block",
                    checked ? "bg-white dark:bg-black" : "bg-white dark:bg-zinc-400"
                )}
            />
        </button>
    );
}
