import Link from "next/link";
import type { ReactNode } from "react";
import type { DocLocale, SiteDictionary } from "../../lib/i18n";
import { buildLocalizedPath } from "../../lib/i18n";
import type { DocHeading, DocMeta } from "../../lib/docs";

type DocsSection = {
  title: string;
  docs: DocMeta[];
};

type Props = {
  locale: DocLocale;
  dict: SiteDictionary;
  sections: DocsSection[];
  activeSlug?: string;
  headings?: DocHeading[];
  children: ReactNode;
};

export function DocsShell({ locale, dict, sections, activeSlug, headings = [], children }: Props) {
  return (
    <section className="docs-layout section-enter" data-delay="2">
      <aside className="panel docs-side">
        <div className="eyebrow">{dict.docs.sections}</div>
        {sections.map((section) => (
          <div className="docs-nav-group" key={section.title}>
            <div className="docs-nav-title">{section.title}</div>
            <div className="docs-nav-list">
              {section.docs.map((doc) => {
                const href = buildLocalizedPath(locale, `/docs/${doc.slug}`);
                const isActive = activeSlug === doc.slug;
                return (
                  <Link className="docs-nav-link" data-active={isActive ? "true" : "false"} href={href} key={doc.slug}>
                    {doc.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </aside>

      <article className="docs-content">{children}</article>

      <aside className="panel docs-toc">
        <div className="eyebrow">{dict.docs.tableOfContents}</div>
        <div className="docs-toc-list">
          {headings.length > 0 ? (
            headings.map((heading) => (
              <a className="docs-toc-link" data-level={String(heading.level)} href={`#${heading.id}`} key={heading.id}>
                {heading.text}
              </a>
            ))
          ) : (
            <p className="meta">—</p>
          )}
        </div>
      </aside>
    </section>
  );
}
