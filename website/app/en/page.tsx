import type { Metadata } from "next";
import { HomePageView } from "../../components/home-page";
import { getDictionary } from "../../lib/i18n";
import { buildPageMetadata } from "../../lib/seo";

export const metadata: Metadata = buildPageMetadata({
  locale: "en",
  title: "Guardian",
  description: "Run architecture quality and release safety in a single production workflow.",
  path: "/"
});

export default async function EnglishHomePage() {
  return <HomePageView dict={getDictionary("en")} locale="en" />;
}
