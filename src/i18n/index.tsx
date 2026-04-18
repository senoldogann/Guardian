import { createContext, useContext, useMemo, type ReactNode } from "react";
import { STORAGE_KEYS } from "../constants";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { en, tr } from "./locales";

export type AppLocale = "en" | "tr";

const SUPPORTED_LOCALES: readonly AppLocale[] = ["en", "tr"] as const;
const DEFAULT_LOCALE: AppLocale = "en";

type Params = Record<string, string | number | boolean | null | undefined>;

type Messages = Record<string, unknown>;

const MESSAGES: Record<AppLocale, Messages> = { en, tr };

function isLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

const serializeLocale = (value: AppLocale): string => JSON.stringify(value);

function deserializeLocale(raw: string): AppLocale {
  try {
    const parsed = JSON.parse(raw);
    if (isLocale(parsed)) return parsed;
  } catch {
    // Ignore and fall through.
  }
  const trimmed = raw.trim().replace(/^"|"$/g, "");
  return isLocale(trimmed) ? trimmed : DEFAULT_LOCALE;
}

function getPathValue(messages: Messages, key: string): unknown {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function formatTemplate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    void match;
    const value = params[name];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

export function createTranslator(locale: AppLocale) {
  const messages = MESSAGES[locale] ?? MESSAGES.en;
  return (key: string, params?: Params): string => {
    const raw = getPathValue(messages, key);
    if (typeof raw === "string") return formatTemplate(raw, params);
    return key;
  };
}

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, params?: Params) => string;
  hydrated: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleRaw, hydrated] = useLocalStorage<AppLocale>(
    STORAGE_KEYS.LANGUAGE,
    DEFAULT_LOCALE,
    {
      deserialize: deserializeLocale,
      serialize: serializeLocale,
    }
  );

  const t = useMemo(() => createTranslator(locale), [locale]);
  const setLocale = (next: AppLocale) => setLocaleRaw(next);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t, hydrated }),
    [hydrated, locale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    const t = createTranslator(DEFAULT_LOCALE);
    return { locale: DEFAULT_LOCALE, setLocale: () => {}, t, hydrated: false };
  }
  return ctx;
}
