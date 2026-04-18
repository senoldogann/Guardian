import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLocalStorage } from "./useLocalStorage";
import { STORAGE_KEYS } from "../constants";
import type { ThemeMode } from "./useTheme";

// ── Helpers ────────────────────────────────────────────────────

function parseThemeStorage(raw: string): "dark" | "light" {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    const lowered = typeof parsed === "string" ? parsed.toLowerCase() : "";
    return lowered === "light" ? "light" : "dark";
  } catch {
    return raw.trim().toLowerCase() === "light" ? "light" : "dark";
  }
}

function resolveFontFamily(value: string | undefined): string {
  switch ((value ?? "").trim().toLowerCase()) {
    case "inter":
      return '"Inter", "Avenir Next", "Segoe UI", sans-serif';
    case "poppins":
      return '"Poppins", "Avenir Next", "Segoe UI", sans-serif';
    case "system-ui":
      return 'system-ui, -apple-system, "Segoe UI", sans-serif';
    case "source-sans-3":
      return '"Source Sans 3", "Avenir Next", "Segoe UI", sans-serif';
    case "ibm-plex-sans":
      return '"IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif';
    default:
      return '"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif';
  }
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  const raw = (value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
}

function isNearWhiteHex(hex: string, threshold = 0.94): boolean {
  const normalized = normalizeHexColor(hex, "#ffffff");
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance >= threshold;
}

// ── Types ──────────────────────────────────────────────────────

interface UserPreferencesLike {
  theme_mode?: string;
  font_family?: string;
  font_size_scale?: number;
  light_palette?: { accent?: string; panel?: string; text?: string };
  dark_palette?: { accent?: string; panel?: string; text?: string };
}

export interface UseThemeManagerReturn {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

// ── Hook ───────────────────────────────────────────────────────

export function useThemeManager(
  userPreferences: UserPreferencesLike | null | undefined,
  updateUserPreferences: (patch: { theme_mode?: ThemeMode }) => void,
): UseThemeManagerReturn {
  const [theme, setTheme] = useLocalStorage<"dark" | "light">(STORAGE_KEYS.THEME, "dark", {
    deserialize: parseThemeStorage,
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      updateUserPreferences({ theme_mode: next });
      return next;
    });
  }, [setTheme, updateUserPreferences]);

  // Sync data-theme attribute and native window theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    invoke("set_window_theme", { isDark: theme === "dark" }).catch(() => {
      // Tauri API olmayan ortamlarda (web preview) sessizce geç
    });
  }, [theme]);

  // Apply palette CSS variables
  useEffect(() => {
    const prefs = userPreferences;
    if (!prefs || typeof window === "undefined") return;

    const root = document.documentElement;
    root.style.setProperty("--app-font-family", resolveFontFamily(prefs.font_family));
    root.style.setProperty("--app-font-scale", String((prefs.font_size_scale ?? 100) / 100));

    const applyPalette = (mode: "dark" | "light"): void => {
      const palette =
        mode === "light"
          ? {
            accent: normalizeHexColor(prefs.light_palette?.accent, "#0284c7"),
            panel: normalizeHexColor(prefs.light_palette?.panel, "#ffffff"),
            text: normalizeHexColor(prefs.light_palette?.text, "#0f172a"),
          }
          : {
            accent: normalizeHexColor(prefs.dark_palette?.accent, "#38bdf8"),
            panel: normalizeHexColor(prefs.dark_palette?.panel, "#111827"),
            text: normalizeHexColor(prefs.dark_palette?.text, "#edf2f7"),
          };
      const panelIsNearWhite = mode === "light" && isNearWhiteHex(palette.panel);

      const dynamicSurface =
        mode === "light"
          ? panelIsNearWhite
            ? `color-mix(in oklab, ${palette.panel} 96%, #ffffff 4%)`
            : `color-mix(in oklab, ${palette.panel} 92%, #ffffff 8%)`
          : `color-mix(in oklab, ${palette.panel} 74%, #0f151d 26%)`;
      const dynamicBackground =
        mode === "light"
          ? panelIsNearWhite
            ? `color-mix(in oklab, ${palette.panel} 92%, #f3f3f3 8%)`
            : `color-mix(in oklab, ${palette.panel} 78%, #f4f4f4 22%)`
          : `color-mix(in oklab, ${palette.panel} 46%, #070b10 54%)`;
      const dynamicBorder =
        mode === "light"
          ? `color-mix(in oklab, ${palette.panel} 94%, #97a2ae 6%)`
          : `color-mix(in oklab, ${palette.panel} 90%, #4a5665 10%)`;
      const dynamicTextMain = palette.text;
      const dynamicTextMuted =
        mode === "light"
          ? `color-mix(in oklab, ${palette.text} 62%, ${palette.panel} 38%)`
          : `color-mix(in oklab, ${palette.text} 72%, ${palette.panel} 28%)`;

      root.style.setProperty("--surface", dynamicSurface);
      root.style.setProperty("--background", dynamicBackground);
      root.style.setProperty("--border-main", dynamicBorder);
      root.style.setProperty("--text-main", dynamicTextMain);
      root.style.setProperty("--text-muted", dynamicTextMuted);
      root.style.setProperty(
        "--stat-strong",
        mode === "light"
          ? `color-mix(in oklab, ${palette.text} 88%, #0f1722 12%)`
          : `color-mix(in oklab, ${palette.text} 90%, #ffffff 10%)`,
      );
      root.style.setProperty(
        "--edge-muted",
        mode === "light"
          ? `color-mix(in oklab, ${dynamicBorder} 92%, #d5dbe1 8%)`
          : `color-mix(in oklab, ${dynamicBorder} 88%, #404b59 12%)`,
      );
      root.style.setProperty(
        "--map-node-bg",
        mode === "light"
          ? `color-mix(in oklab, #1f2a36 88%, ${palette.accent} 12%)`
          : `color-mix(in oklab, #17212d 82%, ${palette.accent} 18%)`,
      );
      root.style.setProperty(
        "--map-node-text",
        mode === "light"
          ? `color-mix(in oklab, ${palette.text} 96%, #ffffff 4%)`
          : `color-mix(in oklab, ${palette.text} 90%, #ffffff 10%)`,
      );
      root.style.setProperty(
        "--map-node-muted",
        mode === "light"
          ? `color-mix(in oklab, #d7e0ea 88%, ${palette.accent} 12%)`
          : `color-mix(in oklab, #90a2b8 82%, ${palette.accent} 18%)`,
      );
      root.style.setProperty("--accent-500", palette.accent);
      root.style.setProperty(
        "--accent-400",
        `color-mix(in oklab, ${palette.accent} ${mode === "light" ? 34 : 42}%, transparent)`,
      );
      root.style.setProperty(
        "--accent-200",
        `color-mix(in oklab, ${palette.accent} ${mode === "light" ? 10 : 11}%, transparent)`,
      );
      root.style.setProperty("--guide-bg-raw", palette.panel);
      root.style.setProperty("--panel-bg", palette.panel);
      root.style.setProperty(
        "--topbar-bg",
        mode === "light" && panelIsNearWhite
          ? `color-mix(in oklab, ${palette.panel} 96%, var(--surface) 4%)`
          : `color-mix(in oklab, ${palette.panel} ${mode === "light" ? 84 : 76}%, var(--surface) ${mode === "light" ? 16 : 24}%)`,
      );
      root.style.setProperty(
        "--panel-muted",
        mode === "light" && panelIsNearWhite
          ? `color-mix(in oklab, ${palette.panel} 97%, var(--surface) 3%)`
          : `color-mix(in oklab, ${palette.panel} ${mode === "light" ? 92 : 90}%, var(--surface) ${mode === "light" ? 8 : 10}%)`,
      );
      root.style.setProperty(
        "--panel-border-strong",
        `color-mix(in oklab, var(--border-main) 86%, var(--text-main) 14%)`,
      );
      root.style.setProperty(
        "--code-block-bg",
        mode === "light"
          ? panelIsNearWhite
            ? `color-mix(in oklab, ${palette.panel} 96%, #d9e1ea 4%)`
            : `color-mix(in oklab, ${palette.panel} 92%, #d4dde8 8%)`
          : `color-mix(in oklab, ${palette.panel} 74%, #060b12 26%)`,
      );
      root.style.setProperty(
        "--code-block-text",
        mode === "light"
          ? `color-mix(in oklab, ${palette.text} 92%, #0f1a28 8%)`
          : `color-mix(in oklab, ${palette.text} 92%, #ffffff 8%)`,
      );
      root.style.setProperty(
        "--code-inline-bg",
        mode === "light"
          ? `color-mix(in oklab, ${palette.accent} 11%, ${palette.panel} 89%)`
          : `color-mix(in oklab, ${palette.accent} 18%, ${palette.panel} 82%)`,
      );
      root.style.setProperty(
        "--code-inline-text",
        mode === "light"
          ? `color-mix(in oklab, ${palette.text} 88%, ${palette.accent} 12%)`
          : `color-mix(in oklab, ${palette.text} 86%, ${palette.accent} 14%)`,
      );
      root.style.setProperty(
        "--code-keyword",
        mode === "light"
          ? `color-mix(in oklab, ${palette.accent} 70%, ${palette.text} 30%)`
          : `color-mix(in oklab, ${palette.accent} 76%, ${palette.text} 24%)`,
      );
      root.style.setProperty(
        "--code-string",
        mode === "light"
          ? `color-mix(in oklab, ${palette.accent} 56%, ${palette.text} 44%)`
          : `color-mix(in oklab, ${palette.accent} 62%, ${palette.text} 38%)`,
      );
      root.style.setProperty(
        "--code-number",
        mode === "light"
          ? `color-mix(in oklab, ${palette.accent} 66%, ${palette.text} 34%)`
          : `color-mix(in oklab, ${palette.accent} 70%, ${palette.text} 30%)`,
      );
      root.style.setProperty(
        "--code-comment",
        mode === "light"
          ? `color-mix(in oklab, ${palette.text} 52%, ${palette.panel} 48%)`
          : `color-mix(in oklab, ${palette.text} 56%, ${palette.panel} 44%)`,
      );
      root.style.setProperty(
        "--code-function",
        mode === "light"
          ? `color-mix(in oklab, ${palette.accent} 74%, ${palette.text} 26%)`
          : `color-mix(in oklab, ${palette.accent} 80%, ${palette.text} 20%)`,
      );
      root.style.setProperty(
        "--code-type",
        mode === "light"
          ? `color-mix(in oklab, ${palette.accent} 62%, ${palette.text} 38%)`
          : `color-mix(in oklab, ${palette.accent} 68%, ${palette.text} 32%)`,
      );
      root.style.setProperty(
        "--focus-border",
        `color-mix(in oklab, ${palette.accent} 30%, var(--border-main) 70%)`,
      );
      root.style.setProperty(
        "--hero-glow",
        `color-mix(in oklab, ${palette.accent} 16%, transparent)`,
      );
      root.style.setProperty("--guardian-dot", palette.accent);
      root.style.setProperty(
        "--guardian-core-bg",
        `color-mix(in oklab, var(--surface) ${mode === "light" ? 82 : 74}%, ${palette.accent} ${mode === "light" ? 18 : 26}%)`,
      );
      root.style.setProperty(
        "--guardian-ring",
        `color-mix(in oklab, ${palette.accent} ${mode === "light" ? 26 : 34}%, transparent)`,
      );
      root.style.setProperty(
        "--guardian-shadow",
        `color-mix(in oklab, ${palette.accent} 20%, transparent)`,
      );
      root.style.setProperty(
        "--tone-ai-bg",
        `color-mix(in oklab, ${palette.accent} ${mode === "light" ? 12 : 16}%, var(--surface) ${mode === "light" ? 88 : 84}%)`,
      );
      root.style.setProperty(
        "--tone-ai-border",
        `color-mix(in oklab, ${palette.accent} ${mode === "light" ? 24 : 34}%, var(--border-main) ${mode === "light" ? 76 : 66}%)`,
      );
      root.style.setProperty(
        "--tone-ai-text",
        `color-mix(in oklab, ${palette.accent} ${mode === "light" ? 72 : 64}%, var(--text-main) ${mode === "light" ? 28 : 36}%)`,
      );
      root.style.setProperty(
        "--backdrop",
        mode === "light"
          ? panelIsNearWhite
            ? `radial-gradient(920px 620px at -8% -10%, color-mix(in oklab, #ececec 28%, transparent), transparent 62%)`
            : `radial-gradient(980px 640px at -12% -12%, color-mix(in oklab, ${palette.accent} 14%, transparent), transparent 58%),
               radial-gradient(820px 560px at 108% -10%, color-mix(in oklab, #f2f2f2 42%, transparent), transparent 64%)`
          : `radial-gradient(1100px 700px at -12% -16%, color-mix(in oklab, ${palette.accent} 20%, transparent), transparent 58%),
             radial-gradient(900px 620px at 112% -12%, color-mix(in oklab, ${palette.panel} 40%, transparent), transparent 64%),
             radial-gradient(860px 620px at 50% 118%, color-mix(in oklab, ${palette.accent} 12%, transparent), transparent 72%)`,
      );
      root.style.setProperty(
        "--workspace-chrome",
        mode === "light" && panelIsNearWhite
          ? `color-mix(in oklab, ${palette.panel} 90%, var(--background) 10%)`
          : `color-mix(in oklab, ${palette.panel} ${mode === "light" ? 78 : 72}%, var(--background) ${mode === "light" ? 22 : 28}%)`,
      );
    };

    if (prefs.theme_mode === "dark" || prefs.theme_mode === "light") {
      setTheme(prefs.theme_mode);
      applyPalette(prefs.theme_mode);
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = (): void => {
      const nextTheme = media.matches ? "dark" : "light";
      setTheme(nextTheme);
      applyPalette(nextTheme);
    };
    applySystemTheme();
    media.addEventListener("change", applySystemTheme);
    return () => {
      media.removeEventListener("change", applySystemTheme);
    };
  }, [userPreferences, setTheme]);

  return { theme, toggleTheme };
}
