import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsShell } from "../../../../components/docs/docs-shell";
import { MarkdownBlock } from "../../../../components/markdown-block";
import { getDictionary } from "../../../../lib/i18n";
import { getDoc, getDocs, getDocSections } from "../../../../lib/docs";
import { buildPageMetadata } from "../../../../lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const docs = await getDocs("en");
  return docs.map((doc) => ({ slug: doc.meta.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDoc("en", slug);
  if (!doc) {
    return buildPageMetadata({
      locale: "en",
      title: "Documentation",
      description: "Guardian documentation.",
      path: `/docs/${slug}`
    });
  }

  return buildPageMetadata({
    locale: "en",
    title: doc.meta.title,
    description: doc.meta.summary,
    path: `/docs/${slug}`
  });
}

export default async function EnglishDocsDetailPage({ params }: Props) {
  const { slug } = await params;
  const locale = "en";
  const dict = getDictionary(locale);
  const [doc, sections] = await Promise.all([getDoc(locale, slug), getDocSections(locale)]);

  if (!doc) {
    notFound();
  }

  return (
    <>
      <section className="hero section-enter" data-delay="1">
        <div className="eyebrow">{dict.docs.eyebrow}</div>
        <h1>{doc.meta.title}</h1>
        <p>{doc.meta.summary}</p>
      </section>

      <DocsShell activeSlug={slug} dict={dict} headings={doc.headings} locale={locale} sections={sections}>
        <MarkdownBlock value={doc.content} />
      </DocsShell>
    </>
  );
}
