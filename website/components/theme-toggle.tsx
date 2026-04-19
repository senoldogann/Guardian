"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "./theme-provider";
import { trackThemeToggle } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { SiteDictionary } from "@/lib/i18n";
import { useHydrated } from "@/lib/use-hydrated";

interface ThemeToggleProps {
  className?: string;
  dict: SiteDictionary;
}

export function ThemeToggle({ className, dict }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useHydrated();

  const themes: { value: "light" | "dark" | "system"; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun className="w-4 h-4" aria-hidden="true" />, label: dict.theme.light },
    { value: "dark", icon: <Moon className="w-4 h-4" aria-hidden="true" />, label: dict.theme.dark },
    { value: "system", icon: <Monitor className="w-4 h-4" aria-hidden="true" />, label: dict.theme.system },
  ];

  // Avoid hydration mismatch by rendering neutral state on server
  if (!mounted) {
    return (
      <div 
        className={cn("flex items-center gap-1 p-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10", className)}
        suppressHydrationWarning
      >
        {themes.map((t) => (
          <button
            key={t.value}
            className="p-2 rounded-full transition-all duration-200 text-zinc-500 dark:text-zinc-400"
            disabled
            aria-label={`Switch to ${t.label} mode`}
          >
            {t.icon}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 p-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10", className)}>
      {themes.map((t) => (
        <button
          key={t.value}
          onClick={() => {
            setTheme(t.value);
            if (t.value !== "system") {
              trackThemeToggle(t.value);
            }
          }}
          className={cn(
            "p-2 rounded-full transition-all duration-200",
            theme === t.value
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "text-zinc-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10"
          )}
          title={t.label}
          aria-label={`Switch to ${t.label} mode`}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}
