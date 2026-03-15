import type { Metadata } from "next";
import { ChangelogPageView } from "../../../components/changelog/changelog-page-view";
import { buildPageMetadata } from "../../../lib/seo";
import { normalizeLocale, withLocale } from "../../../lib/locale";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  const title = locale === "tr" ? "Değişiklikler" : "Changelog";
  const description =
    locale === "tr"
      ? "Guardian sürüm notlarını arşiv ve filtrelerle takip edin."
      : "Track Guardian release notes with archive and filters.";

  return buildPageMetadata({
    title,
    description,
    path: withLocale(locale, "/changelog"),
    locale,
  });
}

export default async function ChangelogPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  return <ChangelogPageView locale={locale} />;
}

