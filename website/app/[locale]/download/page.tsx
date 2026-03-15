import type { Metadata } from "next";
import { DownloadPageView } from "../../../components/download/download-page-view";
import { getDictionary } from "../../../lib/i18n";
import { buildPageMetadata } from "../../../lib/seo";
import { normalizeLocale, withLocale } from "../../../lib/locale";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  const title = locale === "tr" ? "İndir" : "Download";
  const description =
    locale === "tr"
      ? "İşletim sisteminiz için önerilen Guardian kurulum paketini indirin."
      : "Download the Guardian installer recommended for your operating system.";

  return buildPageMetadata({
    title,
    description,
    path: withLocale(locale, "/download"),
    locale,
  });
}

export default async function DownloadPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  return <DownloadPageView dict={getDictionary(locale)} locale={locale} />;
}
