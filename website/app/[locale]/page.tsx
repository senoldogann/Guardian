import type { Metadata } from "next";
import { HomePageView } from "../../components/home-page";
import { getDictionary } from "../../lib/i18n";
import { buildPageMetadata } from "../../lib/seo";
import { normalizeLocale, withLocale } from "../../lib/locale";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  const title = "Guardian";
  const description =
    locale === "tr"
      ? "Kalite ve güvenlik standartlarını sürüm hızında zorunlu kılın."
      : "Keep quality and security standards enforced at release speed.";

  return buildPageMetadata({
    title,
    description,
    path: withLocale(locale, "/"),
    locale,
  });
}

export default async function HomePage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  return <HomePageView dict={getDictionary(locale)} locale={locale} />;
}
