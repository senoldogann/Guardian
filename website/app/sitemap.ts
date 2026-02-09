import type { MetadataRoute } from "next";
import { getDocs } from "../lib/docs";
import { fetchReleaseSnapshot } from "../lib/releases-source";
import { SITE_URL } from "../lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [docs, releases] = await Promise.all([
    getDocs(),
    fetchReleaseSnapshot(1).catch(() => [])
  ]);
  const latestRelease = releases[0];
  const latestReleaseDate = latestRelease?.published_at
    ? new Date(latestRelease.published_at)
    : undefined;

  const staticRoutes = [
    "/",
    "/download",
    "/changelog",
    "/docs",
    "/faq",
    "/privacy-policy",
    "/contact"
  ];

  const docRoutes = docs.map((doc) => `/docs/${doc.meta.slug}`);

  return [...staticRoutes, ...docRoutes].map((route) => {
    const isChangelog = route === "/changelog";
    const isDownload = route === "/download";
    const changeFrequency = isChangelog ? "daily" : "weekly";
    const priority = route === "/" ? 1 : isDownload ? 0.85 : 0.7;

    return {
      url: `${SITE_URL}${route}`,
      changeFrequency,
      priority,
      lastModified: (isChangelog || isDownload) && latestReleaseDate ? latestReleaseDate : undefined
    };
  });
}
