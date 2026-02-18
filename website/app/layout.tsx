import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "../lib/seo";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk"
});

const THEME_INIT_SCRIPT = `(() => {
  try {
    const stored = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = stored === "light" || stored === "dark" ? stored : (prefersDark ? "dark" : "light");
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
  } catch {
    document.documentElement.classList.add("dark");
  }
})();`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Guardian | Release-Driven Governance Platform",
    template: "%s | Guardian"
  },
  description:
    "Guardian is a desktop governance app for architecture quality, secure release operations, and in-app update management.",
  alternates: {
    canonical: `${SITE_URL}/en`,
    languages: {
      en: `${SITE_URL}/en`,
      tr: `${SITE_URL}/tr`,
    },
  },
  openGraph: {
    title: "Guardian | Release-Driven Governance Platform",
    description:
      "Architecture and security governance with release-driven desktop operations.",
    type: "website",
    url: SITE_URL,
    siteName: "Guardian",
    locale: "en_US",
    images: [
      {
        url: `${SITE_URL}/og?title=Guardian&description=Release-Driven Governance Platform`,
        width: 1200,
        height: 630,
        alt: "Guardian - Release-Driven Governance Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Guardian | Release-Driven Governance Platform",
    description: "Release-driven architecture governance for production engineering teams.",
    images: [`${SITE_URL}/og?title=Guardian&description=Release-Driven Governance Platform`],
  },
  verification: {
    google: "X7Ebs2nZd78TDzrvFYP_2txP8qS_LeEqJqitJlIj-rs"
  },
  robots: {
    index: true,
    follow: true
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#0a0a0a" },
  ],
  colorScheme: "dark light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const localeHeader = hdrs.get("x-guardian-locale") ?? "en";
  const lang = localeHeader.toLowerCase().startsWith("tr") ? "tr" : "en";

  return (
    <html lang={lang} className="scroll-smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${dmSans.variable} ${spaceGrotesk.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
