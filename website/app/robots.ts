import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  const host = new URL(SITE_URL).host;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/_next/", "/api/"]
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host
  };
}
