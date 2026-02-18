import type { Metadata } from "next";
import type { Locale } from "./locale";
import { swapLocaleInPath } from "./locale";

export const SITE_URL = "https://guardianide.com";

/**
 * Generate OpenGraph image URL with dynamic content
 */
function generateOgImageUrl(title: string, description: string): string {
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = encodeURIComponent(description);
  return `${SITE_URL}/og?title=${encodedTitle}&description=${encodedDesc}`;
}

export function buildPageMetadata(input: {
  title: string;
  description: string;
  path: string;
  locale?: Locale;
}): Metadata {
  const { title, description, path, locale = "en" } = input;
  const currentUrl = `${SITE_URL}${path}`;
  const ogImageUrl = generateOgImageUrl(title, description);
  const ogLocale = locale === "tr" ? "tr_TR" : "en_US";

  return {
    title,
    description,
    alternates: {
      canonical: currentUrl,
      languages: {
        en: `${SITE_URL}${swapLocaleInPath(path, "en")}`,
        tr: `${SITE_URL}${swapLocaleInPath(path, "tr")}`,
      }
    },
    openGraph: {
      title,
      description,
      url: currentUrl,
      siteName: "Guardian",
      type: "website",
      locale: ogLocale,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    }
  };
}

export function buildSoftwareApplicationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Guardian",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Windows, Linux",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD"
    },
    description: "Guardian is a desktop app for architecture governance and release quality.",
    url: SITE_URL
  };
}

export function buildOrganizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Guardian",
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`
  };
}

export function buildWebsiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Guardian",
    url: SITE_URL
  };
}
