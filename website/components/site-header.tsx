"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildLocalizedPath, detectLocaleFromPath, getAlternateLocale, getDictionary } from "../lib/i18n";

function stripLocale(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3);
  return pathname;
}

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const locale = detectLocaleFromPath(pathname);
  const altLocale = getAlternateLocale(locale);
  const dict = getDictionary(locale);
  const basePath = stripLocale(pathname);

  const links = [
    { href: "/", label: dict.nav.home },
    { href: "/download", label: dict.nav.download },
    { href: "/changelog", label: dict.nav.changelog },
    { href: "/docs", label: dict.nav.docs }
  ];

  return (
    <header className="topbar section-enter" data-delay="0">
      <Link className="brand" href={buildLocalizedPath(locale, "/")}> 
        <span className="brand-mark">Guardian</span>
        <span className="brand-sub">{dict.brandTagline}</span>
      </Link>

      <nav className="nav" aria-label="Primary">
        {links.map((link) => {
          const localizedHref = buildLocalizedPath(locale, link.href);
          const active =
            link.href === "/"
              ? pathname === localizedHref
              : pathname === localizedHref || pathname.startsWith(`${localizedHref}/`);

          return (
            <Link key={link.href} className="nav-link" data-active={active ? "true" : "false"} href={localizedHref}>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="locale-switch">
        <span>{dict.common.languageSwitch}</span>
        <Link className="locale-pill" href={buildLocalizedPath(altLocale, basePath)}>
          {altLocale === "en" ? dict.common.english : dict.common.turkish}
        </Link>
      </div>
    </header>
  );
}
