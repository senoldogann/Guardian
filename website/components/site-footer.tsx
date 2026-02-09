"use client";

import Link from "next/link";
import { ShieldCheck, Linkedin, Mail } from "lucide-react";
import { useState, useEffect } from "react";

export function SiteFooter() {
    const [currentYear, setCurrentYear] = useState<number | null>(null);

    // Get year on client-side only to avoid hydration mismatch
    useEffect(() => {
        setCurrentYear(new Date().getFullYear());
    }, []);

    const footerLinks = {
        product: [
            { label: "Changelog", href: "/changelog" },
            { label: "Documentation", href: "/docs" },
            { label: "FAQ", href: "/faq" },
            { label: "Contact", href: "/contact" },
        ],
        resources: [
            { label: "Getting Started", href: "/docs/get-started" },
            { label: "Security", href: "/docs/security" },
            { label: "Configuration", href: "/docs/configuration" },
            { label: "Guru AI", href: "/docs/guru" },
            { label: "Monitoring", href: "/docs/monitoring" },
        ],
        legal: [
            { label: "Privacy Policy", href: "/privacy-policy" },
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
                            Release-driven governance platform for engineering teams. Maintain code quality and security at scale.
                        </p>

                        <div className="flex items-center gap-4">
                            <a
                                href="https://www.linkedin.com/in/senoldogann"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-all cursor-pointer"
                                aria-label="LinkedIn"
                            >
                                <Linkedin className="w-5 h-5" aria-hidden="true" />
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
                            Product
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
                            Resources
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
                            Legal
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
                    <p className="text-sm text-zinc-500 dark:text-zinc-600" suppressHydrationWarning>
                        &copy; {currentYear || "2026"} Guardian Project. All rights reserved.
                    </p>

                    {/* Designed & Developed by Credit */}
                    <p className="text-sm text-zinc-500 flex items-center gap-1">
                        <span className="text-zinc-500 dark:text-zinc-600">Designed & Developed by</span>
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
