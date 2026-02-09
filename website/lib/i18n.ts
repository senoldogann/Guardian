import en from "../content/i18n/en.json";

export type SiteDictionary = {
  localeLabel?: string;
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
    manual: string;
    noMatch: string;
    detecting: string;
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
  common: {
    latestVersion: string;
    viewOnGithub: string;
    openDistributionRepo: string;
    releaseNotAvailable: string;
    updatedAt: string;
  };
};

const DICTIONARY: SiteDictionary = en as SiteDictionary;

export function getDictionary(): SiteDictionary {
  return DICTIONARY;
}
