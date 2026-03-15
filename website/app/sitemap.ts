import type { MetadataRoute } from "next";
import { getDocs } from "../lib/docs";
import { fetchReleaseSnapshot } from "../lib/releases-source";
import { SUPPORTED_LOCALES, withLocale } from "../lib/locale";
import { SITE_URL } from "../lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [docsByLocale, releases] = await Promise.all([
    Promise.all(SUPPORTED_LOCALES.map((locale) => getDocs(locale))),
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

  const localizedStaticRoutes = SUPPORTED_LOCALES.flatMap((locale) =>
    staticRoutes.map((route) => withLocale(locale, route))
  );

  const localizedDocRoutes = SUPPORTED_LOCALES.flatMap((locale, index) => {
    const docs = docsByLocale[index] ?? [];
    return docs.map((doc) => withLocale(locale, `/docs/${doc.meta.slug}`));
  });

  return [...localizedStaticRoutes, ...localizedDocRoutes].map((route) => {
    const baseRoute = route.replace(/^\/(en|tr)(?=\/|$)/, "") || "/";
    const isChangelog = baseRoute === "/changelog";
    const isDownload = baseRoute === "/download";
    const changeFrequency = isChangelog ? "daily" : "weekly";
    const priority = baseRoute === "/" ? 1 : isDownload ? 0.85 : 0.7;

    return {
      url: `${SITE_URL}${route}`,
      changeFrequency,
      priority,
      lastModified: (isChangelog || isDownload) && latestReleaseDate ? latestReleaseDate : undefined
    };
  });
}
