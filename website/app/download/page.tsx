import type { Metadata } from "next";
import { DownloadPageView } from "../../components/download/download-page-view";
import { getDictionary } from "../../lib/i18n";
import { buildPageMetadata } from "../../lib/seo";

export const metadata: Metadata = buildPageMetadata({
  locale: "tr",
  title: "İndir",
  description: "İşletim sisteminize uygun Guardian paketini otomatik seçerek indirin.",
  path: "/download"
});

export default async function DownloadPage() {
  return <DownloadPageView dict={getDictionary("tr")} locale="tr" />;
}
