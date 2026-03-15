import { notFound } from "next/navigation";
import { ClientLayout } from "../../components/client-layout";
import { getDictionary } from "../../lib/i18n";
import { normalizeLocale } from "../../lib/locale";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "tr" }];
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  const dict = getDictionary(locale);
  return (
    <ClientLayout dict={dict} locale={locale}>
      {children}
    </ClientLayout>
  );
}
