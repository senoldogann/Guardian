import type { Metadata } from "next";
import type { DocLocale } from "./i18n";

export const SITE_URL = "https://guardian-app.vercel.app";

function localizedPath(locale: DocLocale, path: string): string {
  if (locale === "tr") return path;
  if (path === "/") return "/en";
  return `/en${path}`;
}

export function buildPageMetadata(input: {
  locale: DocLocale;
  title: string;
  description: string;
  path: string;
}): Metadata {
  const { locale, title, description, path } = input;
  const currentPath = localizedPath(locale, path);
  const currentUrl = `${SITE_URL}${currentPath}`;
  const trUrl = `${SITE_URL}${localizedPath("tr", path)}`;
  const enUrl = `${SITE_URL}${localizedPath("en", path)}`;

  return {
    title,
    description,
    alternates: {
      canonical: currentUrl,
      languages: {
        tr: trUrl,
        en: enUrl
      }
    },
    openGraph: {
      title,
      description,
      url: currentUrl,
      siteName: "Guardian",
      type: "website",
      locale: locale === "tr" ? "tr_TR" : "en_US"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export function buildSoftwareApplicationJsonLd(locale: DocLocale): Record<string, unknown> {
  const tr = locale === "tr";
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Guardian",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Windows",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD"
    },
    description: tr
      ? "Guardian, mimari yönetişim ve release kalitesi için masaüstü uygulamasıdır."
      : "Guardian is a desktop app for architecture governance and release quality.",
    url: `${SITE_URL}${locale === "en" ? "/en" : "/"}`
  };
}

export function buildWebsiteJsonLd(locale: DocLocale): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Guardian",
    url: `${SITE_URL}${locale === "en" ? "/en" : "/"}`
  };
}
