import type { Metadata } from "next";

export const SITE_URL = "https://guardian-app.vercel.app";

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
}): Metadata {
  const { title, description, path } = input;
  const currentUrl = `${SITE_URL}${path}`;
  const ogImageUrl = generateOgImageUrl(title, description);

  return {
    title,
    description,
    alternates: {
      canonical: currentUrl
    },
    openGraph: {
      title,
      description,
      url: currentUrl,
      siteName: "Guardian",
      type: "website",
      locale: "en_US",
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
    operatingSystem: "macOS, Windows",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD"
    },
    description: "Guardian is a desktop app for architecture governance and release quality.",
    url: SITE_URL
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
