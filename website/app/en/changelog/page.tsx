import type { Metadata } from "next";
import { ChangelogPageView } from "../../../components/changelog/changelog-page-view";
import { getDictionary } from "../../../lib/i18n";
import { buildPageMetadata } from "../../../lib/seo";

export const metadata: Metadata = buildPageMetadata({
  locale: "en",
  title: "Changelog",
  description: "Track Guardian release notes with archive navigation and release filters.",
  path: "/changelog"
});

export default async function EnglishChangelogPage() {
  return <ChangelogPageView dict={getDictionary("en")} locale="en" />;
}
