import type { Metadata } from "next";
import { ChangelogPageView } from "../../components/changelog/changelog-page-view";
import { buildPageMetadata } from "../../lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Changelog",
  description: "Track Guardian release notes with archive and filters.",
  path: "/changelog"
});

export default async function ChangelogPage() {
  return <ChangelogPageView />;
}
