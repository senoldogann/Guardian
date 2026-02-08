import type { Metadata } from "next";
import { HomePageView } from "../components/home-page";
import { getDictionary } from "../lib/i18n";
import { buildPageMetadata } from "../lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Guardian",
  description: "Keep quality and security standards enforced at release speed.",
  path: "/"
});

export default async function HomePage() {
  return <HomePageView dict={getDictionary()} />;
}
