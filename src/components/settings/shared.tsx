import type { ReactElement } from "react";
import { ChevronDown, CircleHelp } from "lucide-react";
import clsx from "clsx";

export const PROVIDER_OPTIONS = [
  { id: "ollama", label: "Ollama (Local/Hosted)", baseUrl: "http://localhost:11434" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", label: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com/v1" },
  { id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { id: "github-models", label: "GitHub Models", baseUrl: "https://models.github.ai" },
] as const;

export const getProviderDefaults = (providerId: string) => {
  const match = PROVIDER_OPTIONS.find((p) => p.id === providerId);
  return match ?? PROVIDER_OPTIONS[0];
};

export const DEFAULT_LIGHT_PALETTE = {
  accent: "#5f879a",
  panel: "#f7f9fc",
  text: "#1f2b38",
} as const;

export const DEFAULT_DARK_PALETTE = {
  accent: "#5f8fa5",
  panel: "#141a21",
  text: "#e6edf5",
} as const;

export type PalettePreset = {
  id: string;
  accent: string;
  panel: string;
  text: string;
  labelKey: string;
};

export const LIGHT_PALETTE_PRESETS: PalettePreset[] = [
  { id: "cloud", accent: "#5f879a", panel: "#f7f9fc", text: "#1f2b38", labelKey: "settings.general.paletteCloud" },
  { id: "stone", accent: "#6f7f92", panel: "#f4f6f9", text: "#2a3440", labelKey: "settings.general.paletteStone" },
  { id: "mint", accent: "#4f8b79", panel: "#f3faf7", text: "#1e342d", labelKey: "settings.general.paletteMint" },
  { id: "sand", accent: "#9a7858", panel: "#faf6f1", text: "#3d2d1f", labelKey: "settings.general.paletteSand" },
];

export const DARK_PALETTE_PRESETS: PalettePreset[] = [
  { id: "midnight", accent: "#5f8fa5", panel: "#141a21", text: "#e6edf5", labelKey: "settings.general.paletteMidnight" },
  { id: "graphite", accent: "#7a8ea8", panel: "#151821", text: "#e8ecf4", labelKey: "settings.general.paletteGraphite" },
  { id: "aurora", accent: "#5d9b88", panel: "#131a1a", text: "#deefe8", labelKey: "settings.general.paletteAurora" },
  { id: "ember", accent: "#a87f5f", panel: "#1a1613", text: "#f1e6d8", labelKey: "settings.general.paletteEmber" },
];

export const API_KEY_MASK = "••••••";

export function normalizeHexColor(value: string | undefined, fallback: string): string {
  const raw = (value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
}

interface InfoPopoverProps {
  title: string;
  note: string;
}

export function InfoPopover({ title, note }: InfoPopoverProps): ReactElement {
  return (
    <details className="relative inline-block">
      <summary className="list-none cursor-pointer select-none text-text-muted hover:text-text-main transition-colors">
        <CircleHelp className="w-3.5 h-3.5" />
      </summary>
      <div className="absolute right-0 bottom-full mb-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-border-main bg-surface p-3 shadow-2xl z-[70]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-main">{title}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-text-muted">{note}</p>
      </div>
    </details>
  );
}

interface StyledSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

export function StyledSelect({ children, className, ...props }: StyledSelectProps) {
  return (
    <div className="relative group">
      <select
        className={clsx(
          "appearance-none w-full bg-[var(--panel-muted)] border border-border-main rounded-lg py-2 pl-3 pr-8 text-xs text-text-main outline-none focus:border-[var(--focus-border)] cursor-pointer transition-colors group-hover:border-[var(--accent-500)]",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none group-hover:text-text-main transition-colors" />
    </div>
  );
}
