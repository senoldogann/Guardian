import type { ReactElement, ReactNode, SelectHTMLAttributes } from "react";
import { CircleHelp } from "lucide-react";
import { SelectControl } from "../ui/Field";

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
  accent: "#059669",
  panel: "#ffffff",
  text: "#09090b",
} as const;

export const DEFAULT_DARK_PALETTE = {
  accent: "#10b981",
  panel: "#18181b",
  text: "#fafafa",
} as const;

export type PalettePreset = {
  id: string;
  accent: string;
  panel: string;
  text: string;
  labelKey: string;
};

export const LIGHT_PALETTE_PRESETS: PalettePreset[] = [
  { id: "slate", accent: "#059669", panel: "#ffffff", text: "#09090b", labelKey: "settings.general.paletteSlate" },
  { id: "stone", accent: "#7c3aed", panel: "#fafafa", text: "#18181b", labelKey: "settings.general.paletteStone" },
  { id: "ocean", accent: "#0284c7", panel: "#ffffff", text: "#0f172a", labelKey: "settings.general.paletteOcean" },
  { id: "sand", accent: "#c2410c", panel: "#fffbf5", text: "#431407", labelKey: "settings.general.paletteSand" },
];

export const DARK_PALETTE_PRESETS: PalettePreset[] = [
  { id: "slate", accent: "#10b981", panel: "#18181b", text: "#fafafa", labelKey: "settings.general.paletteSlate" },
  { id: "graphite", accent: "#a78bfa", panel: "#110f1e", text: "#ede9fe", labelKey: "settings.general.paletteGraphite" },
  { id: "midnight", accent: "#38bdf8", panel: "#0f172a", text: "#e2e8f0", labelKey: "settings.general.paletteMidnight" },
  { id: "ember", accent: "#fb923c", panel: "#1c1410", text: "#fed7aa", labelKey: "settings.general.paletteEmber" },
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
        <p className="text-xs font-semibold text-text-main">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">{note}</p>
      </div>
    </details>
  );
}

interface StyledSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

export function StyledSelect({ children, className, ...props }: StyledSelectProps) {
  return <SelectControl className={className} {...props}>{children}</SelectControl>;
}
