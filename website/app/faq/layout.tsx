import type { Metadata } from "next";
import { buildPageMetadata } from "../../lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "FAQ",
  description: "Frequently asked questions about Guardian, installation, security, and pricing.",
  path: "/faq"
});

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children;
}
