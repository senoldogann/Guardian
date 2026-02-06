import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "../components/site-header";
import { SITE_URL } from "../lib/seo";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading"
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body"
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Guardian | Release-Driven Governance Platform",
    template: "%s | Guardian"
  },
  description:
    "Guardian is a desktop governance app for architecture quality, secure release operations, and in-app update management.",
  alternates: {
    canonical: `${SITE_URL}/`,
    languages: {
      tr: `${SITE_URL}/`,
      en: `${SITE_URL}/en`
    }
  },
  openGraph: {
    title: "Guardian",
    description:
      "Architecture and security governance with release-driven desktop operations.",
    type: "website",
    url: SITE_URL
  },
  twitter: {
    card: "summary_large_image",
    title: "Guardian",
    description: "Release-driven architecture governance for production engineering teams."
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${dmSans.variable}`}>
        <div className="site-shell">
          <SiteHeader />
          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
