import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProLayout } from "../../../../components/docs/pro-layout";
import { MarkdownBlock } from "../../../../components/markdown-block";
import { getDoc, getDocs, getDocSections } from "../../../../lib/docs";
import { buildPageMetadata } from "../../../../lib/seo";
import { getDictionary } from "../../../../lib/i18n";
import { normalizeLocale, type Locale, withLocale } from "../../../../lib/locale";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  const locales: Locale[] = ["en", "tr"];
  const results: Array<{ locale: Locale; slug: string }> = [];

  for (const locale of locales) {
    const docs = await getDocs(locale);
    for (const doc of docs) {
      results.push({ locale, slug: doc.meta.slug });
    }
  }

  return results;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocale(rawLocale);

  const doc = await getDoc(locale, slug);
  if (!doc) {
    return buildPageMetadata({
      title: locale === "tr" ? "Dokümantasyon" : "Documentation",
      description: locale === "tr" ? "Guardian dokümantasyonu." : "Guardian documentation.",
      path: withLocale(locale, `/docs/${slug}`),
      locale,
    });
  }

  return buildPageMetadata({
    title: doc.meta.title,
    description: doc.meta.summary,
    path: withLocale(locale, `/docs/${slug}`),
    locale,
  });
}

export default async function DocsDetailPage({ params }: Props) {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocale(rawLocale);

  if (slug === "getting-started") {
    redirect(`/${locale}/docs/get-started`);
  }

  const [doc, sections] = await Promise.all([getDoc(locale, slug), getDocSections(locale)]);
  if (!doc) {
    notFound();
  }

  const dict = getDictionary(locale);

  const sidebar = sections.map((section) => ({
    title: section.title,
    items: section.docs.map((d) => ({ title: d.title, slug: d.slug })),
  }));

  const toc = doc.headings.map((h) => ({
    title: h.text,
    url: `#${h.id}`,
  }));

  return (
    <ProLayout sidebar={sidebar} toc={toc} dict={dict} locale={locale}>
      <section className="hero">
        <div className="eyebrow mb-2 text-xs font-semibold tracking-[0.24em] uppercase text-neutral-500 dark:text-neutral-400">
          {dict.docs.eyebrow}
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-neutral-950 dark:text-white">
          {doc.meta.title}
        </h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">{doc.meta.summary}</p>
      </section>

      <div className="prose dark:prose-invert max-w-none" data-docs-body>
        <MarkdownBlock value={doc.content} locale={locale} />
      </div>
    </ProLayout>
  );
}
