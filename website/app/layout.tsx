import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://guardian-app.vercel.app"),
  title: {
    default: "Guardian | Architectural Governance Desktop App",
    template: "%s | Guardian"
  },
  description:
    "Guardian is a desktop governance app for real-time code auditing, release-driven updates, and production-safe development workflows.",
  openGraph: {
    title: "Guardian",
    description:
      "Real-time architecture and security governance for modern codebases.",
    type: "website"
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <header className="topbar">
            <a className="brand" href="/">
              Guardian
            </a>
            <nav className="nav">
              <a href="/download">Download</a>
              <a href="/changelog">Changelog</a>
              <a href="/docs">Docs</a>
            </nav>
          </header>
          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
