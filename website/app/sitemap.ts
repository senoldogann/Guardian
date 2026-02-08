import type { MetadataRoute } from "next";
import { getDocs } from "../lib/docs";
import { SITE_URL } from "../lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const docs = await getDocs();

  const staticRoutes = [
    "/",
    "/download",
    "/changelog",
    "/docs"
  ];

  const docRoutes = docs.map((doc) => `/docs/${doc.meta.slug}`);

  return [...staticRoutes, ...docRoutes].map((route) => ({
    url: `${SITE_URL}${route}`,
    changeFrequency: route.includes("changelog") ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.7
  }));
}
