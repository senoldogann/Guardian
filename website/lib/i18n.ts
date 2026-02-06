import tr from "../content/i18n/tr.json";
import en from "../content/i18n/en.json";

export type DocLocale = "tr" | "en";

export type SiteDictionary = {
  localeLabel: string;
  brandTagline: string;
  nav: {
    home: string;
    download: string;
    changelog: string;
    docs: string;
  };
  home: {
    eyebrow: string;
    title: string;
    description: string;
    ctaPrimary: string;
    ctaSecondaryDocs: string;
    ctaSecondaryChangelog: string;
    trustRelease: string;
    trustUpdates: string;
    trustSecurity: string;
  };
  download: {
    eyebrow: string;
    title: string;
    description: string;
    latestLabel: string;
    recommended: string;
    manual: string;
    noMatch: string;
    detecting: string;
    checksum: string;
    size: string;
  };
  changelog: {
    eyebrow: string;
    title: string;
    description: string;
    all: string;
    stable: string;
    prerelease: string;
    archive: string;
    published: string;
    noNotes: string;
  };
  docs: {
    eyebrow: string;
    title: string;
    description: string;
    tableOfContents: string;
    sections: string;
  };
  common: {
    latestVersion: string;
    viewOnGithub: string;
    openDistributionRepo: string;
    releaseNotAvailable: string;
    updatedAt: string;
    languageSwitch: string;
    english: string;
    turkish: string;
  };
};

const DICTIONARIES: Record<DocLocale, SiteDictionary> = {
  tr: tr as SiteDictionary,
  en: en as SiteDictionary
};

export function isLocale(value: string): value is DocLocale {
  return value === "tr" || value === "en";
}

export function getDictionary(locale: DocLocale): SiteDictionary {
  return DICTIONARIES[locale];
}

export function getAlternateLocale(locale: DocLocale): DocLocale {
  return locale === "tr" ? "en" : "tr";
}

export function buildLocalizedPath(locale: DocLocale, pathname: string): string {
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (locale === "tr") {
    if (cleanPath === "/en") return "/";
    if (cleanPath.startsWith("/en/")) return cleanPath.replace(/^\/en/, "");
    return cleanPath;
  }
  if (cleanPath === "/") return "/en";
  if (cleanPath.startsWith("/en/")) return cleanPath;
  return `/en${cleanPath}`;
}

export function detectLocaleFromPath(pathname: string): DocLocale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "tr";
}
