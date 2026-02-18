import { redirect } from "next/navigation";
import { getDocs } from "../../../lib/docs";
import { normalizeLocale } from "../../../lib/locale";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DocsPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const docs = await getDocs(locale);

  if (docs.length > 0) {
    const getStarted = docs.find((d) => d.meta.slug === "get-started");
    const firstDoc = getStarted || docs[0];
    redirect(`/${locale}/docs/${firstDoc.meta.slug}`);
  }

  redirect(`/${locale}`);
}

