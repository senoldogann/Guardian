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
    { href: "/docs", label: dict.nav.docs },
    { href: "/changelog", label: dict.nav.changelog }
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
            pathname === localizedHref || pathname.startsWith(`${localizedHref}/`);

          return (
            <Link key={link.href} className="nav-link" data-active={active ? "true" : "false"} href={localizedHref}>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="topbar-actions">
        <Link aria-label={dict.common.languageSwitch} className="locale-pill" href={buildLocalizedPath(altLocale, basePath)}>
          {altLocale === "en" ? dict.common.english : dict.common.turkish}
        </Link>
        <Link className="button button-compact" href={buildLocalizedPath(locale, "/download")}>
          <span>{dict.nav.download}</span>
          <svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18">
            <path
              d="M12 3v10.2l3.6-3.6 1.4 1.4-6 6-6-6 1.4-1.4 3.6 3.6V3h2zM5 19h14v2H5v-2z"
              fill="currentColor"
            />
          </svg>
        </Link>
      </div>
    </header>
  );
}
