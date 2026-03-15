export const SUPPORTED_LOCALES = ["en", "tr"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function normalizeLocale(value: unknown): Locale {
  if (typeof value !== "string") return "en";
  const lower = value.toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(lower) ? (lower as Locale) : "en";
}

export function withLocale(locale: Locale, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized === "/" ? "" : normalized}`;
}

export function stripLocalePrefix(pathname: string): string {
  return pathname.replace(/^\/(en|tr)(?=\/|$)/, "") || "/";
}

export function swapLocaleInPath(pathname: string, targetLocale: Locale): string {
  const rest = stripLocalePrefix(pathname);
  return withLocale(targetLocale, rest);
}

