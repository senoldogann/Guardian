import en from "../content/i18n/en.json";
import tr from "../content/i18n/tr.json";
import type { Locale } from "./locale";

export type SiteDictionary = {
  localeLabel?: string;
  brandTagline: string;
  nav: {
    home: string;
    download: string;
    changelog: string;
    docs: string;
    faq: string;
    contact: string;
    privacy: string;
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
    sections: {
      guru: {
        title: string;
        description: string;
      };
      auth: {
        title: string;
        description: string;
      };
    };
  };
  download: {
    eyebrow: string;
    title: string;
    description: string;
    latestLabel: string;
    recommended: string;
    recommendedBadge: string;
    direct: string;
    manual: string;
    showManual: string;
    hideManual: string;
    manualHint: string;
    noPackageForPlatform: string;
    noMatch: string;
    detecting: string;
    platformLabel: string;
    platformAuto: string;
    platformDetected: string;
    size: string;
  };
  changelog: {
    eyebrow: string;
    title: string;
    description: string;
    highlights: string;
    sections: string;
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
  footer: {
    sections: {
      product: string;
      resources: string;
      legal: string;
    };
    links: {
      gettingStarted: string;
      security: string;
      configuration: string;
      guru: string;
      monitoring: string;
    };
    tagline: string;
    rights: string;
    builtBy: string;
  };
  theme: {
    light: string;
    dark: string;
    system: string;
  };
  language: {
    label: string;
    english: string;
    turkish: string;
  };
  common: {
    latestVersion: string;
    releaseNotAvailable: string;
    updatedAt: string;
    skipToContent: string;
    openMenu: string;
    closeMenu: string;
    mobileNavigation: string;
    themeSelection: string;
  };
};

const DICTIONARIES: Record<Locale, SiteDictionary> = {
  en: en as SiteDictionary,
  tr: tr as SiteDictionary,
};

export function getDictionary(locale: Locale = "en"): SiteDictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES.en;
}
