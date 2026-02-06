import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

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
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function MarkdownBlock({ value }: { value: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, ...props }) => {
            const external = typeof href === "string" ? /^https?:\/\//.test(href) : false;
            return (
              <a
                {...props}
                href={href}
                rel={external ? "noreferrer noopener" : undefined}
                target={external ? "_blank" : undefined}
              />
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
          }
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
