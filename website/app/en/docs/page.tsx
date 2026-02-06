import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "../../../components/docs/docs-shell";
import { getDictionary } from "../../../lib/i18n";
import { buildLocalizedPath } from "../../../lib/i18n";
import { getDocs, getDocSections } from "../../../lib/docs";
import { buildPageMetadata } from "../../../lib/seo";

export const metadata: Metadata = buildPageMetadata({
  locale: "en",
  title: "Documentation",
  description: "Operational Guardian docs for installation, updates, troubleshooting, and security.",
  path: "/docs"
});

export default async function EnglishDocsPage() {
  const locale = "en";
  const dict = getDictionary(locale);
  const sections = await getDocSections(locale);
  const docs = await getDocs(locale);

  return (
    <>
      <section className="hero section-enter" data-delay="1">
        <div className="eyebrow">{dict.docs.eyebrow}</div>
        <h1>{dict.docs.title}</h1>
        <p>{dict.docs.description}</p>
      </section>

      <DocsShell dict={dict} locale={locale} sections={sections}>
        <div className="panel" style={{ border: 0, boxShadow: "none", padding: 0 }}>
          <h2>{dict.docs.title}</h2>
          <p className="meta" style={{ marginTop: 10 }}>
            {docs.length} documents are available. Select a topic to open the full operational guide.
          </p>
          <div className="asset-list" style={{ marginTop: 16 }}>
            {docs.map((doc) => (
              <div className="asset-item" key={doc.meta.slug}>
                <div className="asset-name">
                  <strong>{doc.meta.title}</strong>
                  <p className="meta">{doc.meta.summary}</p>
                </div>
                <div className="asset-actions">
                  <Link className="button-subtle" href={buildLocalizedPath(locale, `/docs/${doc.meta.slug}`)}>
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DocsShell>
    </>
  );
}
