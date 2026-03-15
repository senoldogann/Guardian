import type { Metadata } from "next";
import { buildPageMetadata } from "../../../lib/seo";
import { normalizeLocale, withLocale } from "../../../lib/locale";
import { getDictionary } from "../../../lib/i18n";
import { FAQPageView } from "../../../components/faq/faq-page-view";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  const title = locale === "tr" ? "SSS" : "FAQ";
  const description =
    locale === "tr"
      ? "Guardian hakkında sık sorulan soruların yanıtları."
      : "Frequently asked questions about Guardian.";

  return buildPageMetadata({
    title,
    description,
    path: withLocale(locale, "/faq"),
    locale,
  });
}

export default async function FAQPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const dict = getDictionary(locale);
  return <FAQPageView dict={dict} locale={locale} />;
}

