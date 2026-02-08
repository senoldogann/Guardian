import type { Metadata } from "next";
import { DownloadPageView } from "../../components/download/download-page-view";
import { getDictionary } from "../../lib/i18n";
import { buildPageMetadata } from "../../lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Download",
  description: "Download the Guardian installer recommended for your operating system.",
  path: "/download"
});

export default async function DownloadPage() {
  return <DownloadPageView dict={getDictionary()} />;
}
