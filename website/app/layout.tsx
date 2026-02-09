import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ClientLayout } from "../components/client-layout";
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Guardian | Release-Driven Governance Platform",
    template: "%s | Guardian"
  },
  description:
    "Guardian is a desktop governance app for architecture quality, secure release operations, and in-app update management.",
  alternates: {
    canonical: `${SITE_URL}/`
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${dmSans.variable} ${spaceGrotesk.variable} antialiased`}>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
