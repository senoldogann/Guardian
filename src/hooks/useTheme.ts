import { useMemo } from "react";

export type ThemeMode = "dark" | "light" | "system";

export type ThemePalette = {
  accent: string;
  panel: string;
  text: string;
};

export const normalizeThemeMode = (value: unknown): ThemeMode => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "light" || raw === "system") return raw;
  return "dark";
};

export const normalizeHex = (value: unknown, fallback: string): string => {
  const raw = String(value ?? "").trim();
  const valid = /^#[0-9a-fA-F]{6}$/.test(raw);
  return valid ? raw : fallback;
};

export const normalizeFontFamily = (value: unknown): string => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  const allowList = new Set([
    "space-grotesk",
    "inter",
    "poppins",
    "system-ui",
    "source-sans-3",
    "ibm-plex-sans",
  ]);
  return allowList.has(raw) ? raw : "space-grotesk";
};

type UserPreferencesLike = {
  theme_mode?: unknown;
  light_palette?: { accent?: unknown; panel?: unknown; text?: unknown };
  dark_palette?: { accent?: unknown; panel?: unknown; text?: unknown };
  font_size_scale?: number;
  font_family?: unknown;
} | null;

const DEFAULT_LIGHT_PALETTE: ThemePalette = {
  accent: "#0284c7",
  panel: "#ffffff",
  text: "#0f172a",
};

const DEFAULT_DARK_PALETTE: ThemePalette = {
  accent: "#38bdf8",
  panel: "#111827",
  text: "#edf2f7",
};

export interface UseThemeReturn {
  themeMode: ThemeMode;
  lightPalette: ThemePalette;
  darkPalette: ThemePalette;
  fontSizeScale: number;
  fontFamily: string;
}

export function useTheme(userPreferences: UserPreferencesLike): UseThemeReturn {
  return useMemo(() => {
    const prefs = userPreferences;
    return {
      themeMode: normalizeThemeMode(prefs?.theme_mode),
      lightPalette: {
        accent: normalizeHex(prefs?.light_palette?.accent, DEFAULT_LIGHT_PALETTE.accent),
        panel: normalizeHex(prefs?.light_palette?.panel, DEFAULT_LIGHT_PALETTE.panel),
        text: normalizeHex(prefs?.light_palette?.text, DEFAULT_LIGHT_PALETTE.text),
      },
      darkPalette: {
        accent: normalizeHex(prefs?.dark_palette?.accent, DEFAULT_DARK_PALETTE.accent),
        panel: normalizeHex(prefs?.dark_palette?.panel, DEFAULT_DARK_PALETTE.panel),
        text: normalizeHex(prefs?.dark_palette?.text, DEFAULT_DARK_PALETTE.text),
      },
      fontSizeScale: Math.min(130, Math.max(85, Number(prefs?.font_size_scale ?? 100))),
      fontFamily: normalizeFontFamily(prefs?.font_family),
    };
  }, [userPreferences]);
}
