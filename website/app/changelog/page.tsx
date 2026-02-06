import type { Metadata } from "next";
import { ChangelogPageView } from "../../components/changelog/changelog-page-view";
import { getDictionary } from "../../lib/i18n";
import { buildPageMetadata } from "../../lib/seo";

export const metadata: Metadata = buildPageMetadata({
  locale: "tr",
  title: "Yenilikler",
  description: "Guardian sürüm notlarını ay bazlı arşiv ve filtrelerle takip edin.",
  path: "/changelog"
});

export default async function ChangelogPage() {
  return <ChangelogPageView dict={getDictionary("tr")} locale="tr" />;
}
