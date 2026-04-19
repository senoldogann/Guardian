"use client";

import Link from "next/link";
import { ShieldCheck, Mail } from "lucide-react";

// LinkedIn logolu SVG icon (lucide-react'te kararsız, inline kullanıyoruz)
function LinkedInIcon({ className }: { className?: string }) {
    return (
        <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
    );
}
import type { Locale } from "../lib/locale";
import { withLocale } from "../lib/locale";
import type { SiteDictionary } from "../lib/i18n";

export function SiteFooter({ dict, locale }: { dict: SiteDictionary; locale: Locale }) {
    const currentYear = new Date().getFullYear();

    const footerLinks = {
        product: [
            { label: dict.nav.changelog, href: withLocale(locale, "/changelog") },
            { label: dict.nav.docs, href: withLocale(locale, "/docs") },
            { label: dict.nav.faq, href: withLocale(locale, "/faq") },
            { label: dict.nav.contact, href: withLocale(locale, "/contact") },
        ],
        resources: [
            { label: dict.footer.links.gettingStarted, href: withLocale(locale, "/docs/get-started") },
            { label: dict.footer.links.security, href: withLocale(locale, "/docs/security") },
            { label: dict.footer.links.configuration, href: withLocale(locale, "/docs/configuration") },
            { label: dict.footer.links.guru, href: withLocale(locale, "/docs/guru") },
            { label: dict.footer.links.monitoring, href: withLocale(locale, "/docs/monitoring") },
        ],
        legal: [
            { label: dict.nav.privacy, href: withLocale(locale, "/privacy-policy") },
        ],
    };

    return (
        <footer className="border-t border-black/10 dark:border-white/10 bg-white dark:bg-black transition-colors duration-300">
            <div className="container px-4 mx-auto">
                {/* Main Footer Content */}
                <div className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
                    {/* Brand Column */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck className="w-6 h-6 text-black dark:text-white" aria-hidden="true" />
                            <span className="text-xl font-bold text-black dark:text-white">Guardian</span>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-500 text-sm leading-relaxed mb-6 max-w-sm">
                            {dict.footer.tagline}
                        </p>

                        <div className="flex items-center gap-4">
                            <a
                                href="https://www.linkedin.com/in/senoldogann"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-all cursor-pointer"
                                aria-label="LinkedIn"
                            >
                                <LinkedInIcon className="w-5 h-5" aria-hidden="true" />
                            </a>
                            <a
                                href="mailto:contact@senoldogan.dev"
                                className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-all cursor-pointer"
                                aria-label="Email"
                            >
                                <Mail className="w-5 h-5" aria-hidden="true" />
                            </a>
                        </div>
                    </div>

                    {/* Product Links */}
                    <div>
                        <h3 className="text-sm font-semibold text-black dark:text-white uppercase tracking-wider mb-4">
                            {dict.footer.sections.product}
                        </h3>
                        <ul className="space-y-3">
                            {footerLinks.product.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-white transition-colors text-sm cursor-pointer"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Resources Links */}
                    <div>
                        <h3 className="text-sm font-semibold text-black dark:text-white uppercase tracking-wider mb-4">
                            {dict.footer.sections.resources}
                        </h3>
                        <ul className="space-y-3">
                            {footerLinks.resources.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-white transition-colors text-sm cursor-pointer"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div>
                        <h3 className="text-sm font-semibold text-black dark:text-white uppercase tracking-wider mb-4">
                            {dict.footer.sections.legal}
                        </h3>
                        <ul className="space-y-3">
                            {footerLinks.legal.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-white transition-colors text-sm cursor-pointer"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="py-6 border-t border-black/5 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-zinc-500 dark:text-zinc-600">
                        &copy; {currentYear} Guardian Project. {dict.footer.rights}
                    </p>

                    {/* Designed & Developed by Credit */}
                    <p className="text-sm text-zinc-500 flex items-center gap-1">
                        <span className="text-zinc-500 dark:text-zinc-600">{dict.footer.builtBy}</span>
                        <a
                            href="https://www.senoldogan.dev"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-black dark:text-white hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors font-medium cursor-pointer"
                        >
                            Senol Dogan
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    );
}
