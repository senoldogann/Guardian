import type { Metadata } from "next";
import { DownloadPageView } from "../../../components/download/download-page-view";
import { getDictionary } from "../../../lib/i18n";
import { buildPageMetadata } from "../../../lib/seo";

export const metadata: Metadata = buildPageMetadata({
  locale: "en",
  title: "Download",
  description: "Download the best Guardian package for your operating system automatically.",
  path: "/download"
});

export default async function EnglishDownloadPage() {
  return <DownloadPageView dict={getDictionary("en")} locale="en" />;
}
