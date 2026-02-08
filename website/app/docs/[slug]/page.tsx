import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProLayout } from "../../../components/docs/pro-layout";
import { MarkdownBlock } from "../../../components/markdown-block";
import { getDoc, getDocs, getDocSections } from "../../../lib/docs";
import { buildPageMetadata } from "../../../lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const docs = await getDocs();
  return docs.map((doc) => ({ slug: doc.meta.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) {
    return buildPageMetadata({
      title: "Documentation",
      description: "Guardian documentation.",
      path: `/docs/${slug}`
    });
  }

  return buildPageMetadata({
    title: doc.meta.title,
    description: doc.meta.summary,
    path: `/docs/${slug}`
  });
}

export default async function DocsDetailPage({ params }: Props) {
  const { slug } = await params;
  if (slug === "getting-started") {
    redirect("/docs/get-started");
  }
  const [doc, sections] = await Promise.all([getDoc(slug), getDocSections()]);

  if (!doc) {
    notFound();
  }

  // Transform sections for ProLayout sidebar
  const sidebar = sections.map(section => ({
    title: section.title,
    items: section.docs.map(d => ({ title: d.title, slug: d.slug }))
  }));

  // Transform headings for ProLayout TOC
  const toc = doc.headings.map(h => ({
    title: h.text,
    url: `#${h.id}`
  }));

  return (
    <ProLayout sidebar={sidebar} toc={toc}>
      <section className="hero section-enter" data-delay="1">
        <div className="eyebrow text-white/60 mb-2 font-mono text-sm tracking-widest uppercase">Documentation</div>
        <h1 className="text-4xl font-bold mb-4 text-white">{doc.meta.title}</h1>
        <p className="text-xl text-zinc-400 mb-8">{doc.meta.summary}</p>
      </section>

      <div className="prose prose-invert max-w-none">
        <MarkdownBlock value={doc.content} />
      </div>
    </ProLayout>
  );
}
