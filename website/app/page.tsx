import type { Metadata } from "next";
import { HomePageView } from "../components/home-page";
import { getDictionary } from "../lib/i18n";
import { buildPageMetadata } from "../lib/seo";

export const metadata: Metadata = buildPageMetadata({
  locale: "tr",
  title: "Guardian",
  description: "Guardian ile mimari kalite ve release güvenliğini tek ürün akışında yönetin.",
  path: "/"
});

export default async function HomePage() {
  return <HomePageView dict={getDictionary("tr")} locale="tr" />;
}
