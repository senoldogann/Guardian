import type { ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { Locale } from "../lib/locale";
import { withLocale } from "../lib/locale";

function toText(value: ReactNode): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(toText).join("");
  if (value && typeof value === "object" && "props" in value) {
    const withProps = value as { props?: { children?: ReactNode } };
    return toText(withProps.props?.children ?? "");
  }
  return "";
}

function slugify(value: string): string {
  const lowered = value.toLowerCase().trim();
  const ascii = lowered
    // Minimal TR transliteration for stable anchor ids.
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    // Strip common diacritics.
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  return ascii
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeHrefForLocale(href: string, locale?: Locale): string {
  if (!locale) return href;
  if (!href.startsWith("/")) return href;
  if (/^\/(en|tr)(?=\/|$)/.test(href)) return href;
  return withLocale(locale, href);
}

export function MarkdownBlock({ value, locale }: { value: string; locale?: Locale }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, ...props }) => {
            const external = typeof href === "string" ? /^https?:\/\//.test(href) : false;
            const internalHref =
              typeof href === "string" ? normalizeHrefForLocale(href, locale) : href;
            const isHash = typeof href === "string" ? href.startsWith("#") : false;
            return (
              external || isHash || typeof internalHref !== "string" ? (
                <a
                  {...props}
                  href={internalHref}
                  rel={external ? "noreferrer noopener" : undefined}
                  target={external ? "_blank" : undefined}
                />
              ) : (
                <Link {...props} href={internalHref} />
              )
            );
          },
          h2: ({ children }) => {
            const text = toText(children);
            const id = slugify(text);
            return <h2 id={id}>{children}</h2>;
          },
          h3: ({ children }) => {
            const text = toText(children);
            const id = slugify(text);
            return <h3 id={id}>{children}</h3>;
          },
          pre: ({ children }) => {
            return (
              <div className="docs-pre-wrap">
                <pre>{children}</pre>
              </div>
            );
          },
          table: ({ children }) => {
            return (
              <div className="docs-table-wrap">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
