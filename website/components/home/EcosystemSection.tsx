"use client";

import Link from "next/link";
import {
    Terminal,
    Plug,
    Code2,
    ShieldAlert,
    Brain,
    Search,
    type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import type { Locale } from "../../lib/locale";
import { withLocale } from "../../lib/locale";

type EcoTool = {
    title: { en: string; tr: string };
    description: { en: string; tr: string };
    icon: LucideIcon;
    link: string;
    badge?: { en: string; tr: string };
};

const ecoTools: EcoTool[] = [
    {
        title: { en: "CLI for CI/CD", tr: "CI/CD için CLI" },
        description: {
            en: "Run security scans from terminal or any CI pipeline. JSON output, scan profiles, offline mode.",
            tr: "Terminal veya herhangi bir CI pipeline'ından güvenlik taramaları çalıştırın. JSON çıktı, tarama profilleri, çevrimdışı mod."
        },
        icon: Terminal,
        link: "/docs/cli",
    },
    {
        title: { en: "MCP Server", tr: "MCP Sunucusu" },
        description: {
            en: "Connect Guardian to Cursor, Claude Desktop, or any MCP-compatible editor for inline governance.",
            tr: "Guardian'ı Cursor, Claude Desktop veya herhangi bir MCP uyumlu editöre bağlayın."
        },
        icon: Plug,
        link: "/docs/mcp-server",
        badge: { en: "New", tr: "Yeni" },
    },
    {
        title: { en: "VS Code Extension", tr: "VS Code Eklentisi" },
        description: {
            en: "Real-time code governance directly in your editor with inline findings and quick fixes.",
            tr: "Editörünüzde satır içi bulgular ve hızlı düzeltmelerle gerçek zamanlı kod yönetişimi."
        },
        icon: Code2,
        link: "/docs/get-started",
        badge: { en: "New", tr: "Yeni" },
    },
    {
        title: { en: "19+ Secret Patterns", tr: "19+ Gizli Bilgi Kalıbı" },
        description: {
            en: "Auto-redacts API keys, JWTs, database URLs, and PII before any code reaches AI providers.",
            tr: "Kod AI sağlayıcılarına gitmeden önce API anahtarlarını, JWT'leri, DB URL'lerini ve PII'yi otomatik maskeler."
        },
        icon: ShieldAlert,
        link: "/docs/redaction",
    },
    {
        title: { en: "Multi-Provider AI", tr: "Çoklu AI Sağlayıcı" },
        description: {
            en: "OpenAI, Anthropic, Google Gemini, GitHub Models, and Ollama. Switch without losing context.",
            tr: "OpenAI, Anthropic, Google Gemini, GitHub Models ve Ollama. Bağlam kaybetmeden geçiş yapın."
        },
        icon: Brain,
        link: "/docs/configuration",
    },
    {
        title: { en: "Evidence-Based Findings", tr: "Kanıt Tabanlı Bulgular" },
        description: {
            en: "Every finding includes line numbers, code evidence, confidence scores, and category tags.",
            tr: "Her bulgu satır numaraları, kod kanıtları, güven skorları ve kategori etiketleri içerir."
        },
        icon: Search,
        link: "/docs/reviews",
    },
];

export function EcosystemSection({ locale }: { locale: Locale }) {
    const eyebrow = locale === "tr" ? "Ekosistem" : "Ecosystem";
    const title = locale === "tr"
        ? "Her Yerde Guardian"
        : "Guardian Everywhere";
    const desc = locale === "tr"
        ? "Desktop, terminal, CI/CD pipeline ve editörünüz — Guardian'ı zaten çalıştığınız yerde kullanın."
        : "Desktop, terminal, CI/CD pipeline, and your editor — use Guardian where you already work.";

    return (
        <section className="home-section-soft py-20 md:py-24 relative bg-white dark:bg-black transition-colors duration-300">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(15,23,42,0.03),transparent_55%)] dark:bg-[radial-gradient(circle_at_75%_30%,rgba(148,163,184,0.04),transparent_55%)]" />

            <div className="container px-4 sm:px-6 lg:px-8 mx-auto relative z-10 max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-14 md:mb-16"
                >
                    <span className="inline-block px-4 py-1.5 mb-4 text-xs sm:text-sm font-medium tracking-wider text-neutral-500 dark:text-neutral-400 uppercase bg-neutral-100 dark:bg-neutral-900 rounded-full border border-neutral-200 dark:border-neutral-800">
                        {eyebrow}
                    </span>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 md:mb-6 text-black dark:text-white" style={{ fontFamily: 'var(--font-poppins)' }}>
                        {title}
                    </h2>
                    <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto" style={{ fontFamily: 'var(--font-poppins)' }}>
                        {desc}
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                    {ecoTools.map((tool, idx) => {
                        const Icon = tool.icon;
                        return (
                            <motion.div
                                key={tool.title.en}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.45, delay: idx * 0.07 }}
                                viewport={{ once: true, margin: "-40px" }}
                            >
                                <Link
                                    href={withLocale(locale, tool.link)}
                                    className="group block h-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black hover:border-neutral-400 dark:hover:border-neutral-600 hover:shadow-lg transition-all duration-300 p-6"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Icon className="w-5 h-5 text-black dark:text-white" strokeWidth={1.5} />
                                        </div>
                                        {tool.badge && (
                                            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-black">
                                                {tool.badge[locale]}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-base font-semibold text-black dark:text-white mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
                                        {tool.title[locale]}
                                    </h3>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed" style={{ fontFamily: 'var(--font-poppins)' }}>
                                        {tool.description[locale]}
                                    </p>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
