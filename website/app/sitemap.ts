import type { MetadataRoute } from "next";
import { getDocs } from "../lib/docs";
import { SITE_URL } from "../lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const trDocs = await getDocs("tr");
  const enDocs = await getDocs("en");

  const staticRoutes = [
    "/",
    "/download",
    "/changelog",
    "/docs",
    "/en",
    "/en/download",
    "/en/changelog",
    "/en/docs"
  ];

  const trDocRoutes = trDocs.map((doc) => `/docs/${doc.meta.slug}`);
  const enDocRoutes = enDocs.map((doc) => `/en/docs/${doc.meta.slug}`);

  return [...staticRoutes, ...trDocRoutes, ...enDocRoutes].map((route) => ({
    url: `${SITE_URL}${route}`,
    changeFrequency: route.includes("changelog") ? "daily" : "weekly",
    priority: route === "/" || route === "/en" ? 1 : 0.7
  }));
}
