"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
    BadgeCheck,
    ShieldCheck,
    UserRoundCheck,
    Scale,
    ScanSearch,
    LockKeyhole,
    type LucideIcon
} from "lucide-react";
import { Button } from "../ui/button";
import type { Locale } from "../../lib/locale";
import { withLocale } from "../../lib/locale";

type Pillar = {
    title: { en: string; tr: string };
    description: { en: string; tr: string };
    icon: LucideIcon;
};

type ComparisonRow = {
    label: { en: string; tr: string };
    generic: { en: string; tr: string };
    guardian: { en: string; tr: string };
};

const pillars: Pillar[] = [
    {
        title: {
            en: "Decision, Not Just Detection",
            tr: "Sadece Tespit Değil, Karar"
        },
        description: {
            en: "Guardian does not stop at '7 issues found'. It produces a release decision with evidence.",
            tr: "Guardian '7 bulgu bulundu' noktasında durmaz. Kanıta dayalı bir release kararı üretir."
        },
        icon: BadgeCheck
    },
    {
        title: {
            en: "Human Accountability Built In",
            tr: "İnsan Sorumluluğu Dahili"
        },
        description: {
            en: "High-risk flows require a named approver, override owner, and reason recorded in audit history.",
            tr: "Yüksek riskli akışlarda onaylayan kişi, override sahibi ve gerekçe denetim geçmişine yazılır."
        },
        icon: UserRoundCheck
    },
    {
        title: {
            en: "Policy-Driven and Local-First",
            tr: "Policy Tabanlı ve Local-First"
        },
        description: {
            en: "Policy-as-code stays in your repo and the desktop + CLI flow works locally when needed.",
            tr: "Policy-as-code repo içinde kalır; desktop + CLI akışı gerektiğinde lokal çalışır."
        },
        icon: ShieldCheck
    }
];

const comparisonRows: ComparisonRow[] = [
    {
        label: { en: "Primary output", tr: "Ana çıktı" },
        generic: { en: "Issue list", tr: "Bulgu listesi" },
        guardian: { en: "Release decision + rationale", tr: "Release kararı + gerekçe" }
    },
    {
        label: { en: "High-risk handling", tr: "Yüksek risk yönetimi" },
        generic: { en: "Suggestion only", tr: "Sadece öneri" },
        guardian: { en: "Block + human approval + override reason", tr: "Blok + insan onayı + override gerekçesi" }
    },
    {
        label: { en: "Team memory", tr: "Takım hafızası" },
        generic: { en: "Session-bound chat context", tr: "Oturumla sınırlı sohbet bağlamı" },
        guardian: { en: "Versioned policy + audit trail", tr: "Versiyonlu policy + denetim izi" }
    },
    {
        label: { en: "Release gate fit", tr: "Release gate uyumu" },
        generic: { en: "Ad-hoc usage", tr: "Ad-hoc kullanım" },
        guardian: { en: "Strict/warn/off gate modes in CLI/CI", tr: "CLI/CI için strict/warn/off gate modları" }
    }
];

export function DifferentiatorsSection({ locale }: { locale: Locale }) {
    const title =
        locale === "tr"
            ? "Neden Guardian Rakiplerden Farklı?"
            : "What Separates Guardian From Generic Tools?";
    const subtitle =
        locale === "tr"
            ? "Guardian, AI ile üretilen kod için release karar katmanıdır. Tarayıcı değil, karar sistemi olarak çalışır."
            : "Guardian is the release decision layer for AI-generated code. It behaves like a governance system, not a scanner.";
    const matrixTitle = locale === "tr" ? "Karşılaştırma Matrisi" : "Decision Surface Comparison";
    const leftCol = locale === "tr" ? "Genel Araçlar" : "Generic Tools";
    const rightCol = locale === "tr" ? "Guardian" : "Guardian";
    const cta =
        locale === "tr" ? "Karar Akışını Dokümanda İncele" : "Review the Governance Workflow";

    return (
        <section className="home-section-soft relative py-20 md:py-24 overflow-hidden bg-white dark:bg-black transition-colors duration-300">
            <div className="absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(15,23,42,0.08),transparent_52%)] dark:bg-[radial-gradient(circle_at_25%_20%,rgba(148,163,184,0.10),transparent_52%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(2,6,23,0.03),transparent_30%,rgba(2,6,23,0.02))] dark:bg-[linear-gradient(120deg,rgba(248,250,252,0.05),transparent_30%,rgba(248,250,252,0.02))]" />
            </div>

            <div className="container relative z-10 px-4 sm:px-6 lg:px-8 mx-auto max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.55 }}
                    className="text-center mb-14 md:mb-16"
                >
                    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white/80 dark:bg-black/70 backdrop-blur px-3 py-1.5 text-xs tracking-[0.18em] uppercase text-neutral-600 dark:text-neutral-300">
                        <Scale className="w-3.5 h-3.5" aria-hidden="true" />
                        {locale === "tr" ? "Rekabet Farkı" : "Competitive Edge"}
                    </div>
                    <h2 className="mt-5 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-black dark:text-white">
                        {title}
                    </h2>
                    <p className="mt-4 max-w-3xl mx-auto text-base sm:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {subtitle}
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10 md:mb-12">
                    {pillars.map((pillar, idx) => {
                        const Icon = pillar.icon;
                        return (
                            <motion.article
                                key={pillar.title.en}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-40px" }}
                                transition={{ duration: 0.45, delay: idx * 0.08 }}
                                className="group rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/70 backdrop-blur p-6 md:p-7 shadow-[0_10px_40px_-28px_rgba(2,6,23,0.55)]"
                            >
                                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 mb-4">
                                    <Icon className="w-5 h-5" aria-hidden="true" />
                                </div>
                                <h3 className="text-lg md:text-xl font-semibold text-black dark:text-white mb-2">
                                    {pillar.title[locale]}
                                </h3>
                                <p className="text-sm md:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                    {pillar.description[locale]}
                                </p>
                            </motion.article>
                        );
                    })}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-30px" }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="rounded-2xl border border-neutral-200/70 dark:border-neutral-800/60 bg-white/95 dark:bg-neutral-950/75 backdrop-blur overflow-hidden"
                >
                    <div className="flex items-center justify-between px-5 md:px-7 py-4 border-b border-neutral-200/70 dark:border-neutral-800/60">
                        <div className="inline-flex items-center gap-2 text-sm md:text-base font-medium text-black dark:text-white">
                            <ScanSearch className="w-4 h-4" aria-hidden="true" />
                            {matrixTitle}
                        </div>
                        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                            <LockKeyhole className="w-3.5 h-3.5" aria-hidden="true" />
                            {locale === "tr" ? "Production Ready" : "Production Ready"}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr]">
                        <div className="hidden md:flex items-center px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/70 dark:border-neutral-800/60">
                            {locale === "tr" ? "Kriter" : "Criteria"}
                        </div>
                        <div className="hidden md:flex items-center px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/70 dark:border-neutral-800/60 bg-neutral-50/40 dark:bg-neutral-900/20">
                            {leftCol}
                        </div>
                        <div className="hidden md:flex items-center px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/70 dark:border-neutral-800/60 bg-neutral-100/60 dark:bg-neutral-900/35">
                            {rightCol}
                        </div>

                        {comparisonRows.map((row, idx) => (
                            <div key={row.label.en} className="contents">
                                <div className={`px-6 py-4 text-sm font-medium text-neutral-800 dark:text-neutral-200 ${idx !== comparisonRows.length - 1 ? "border-b border-neutral-200/70 dark:border-neutral-800/60" : ""}`}>
                                    {row.label[locale]}
                                </div>
                                <div className={`px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400 bg-neutral-50/40 dark:bg-neutral-900/20 ${idx !== comparisonRows.length - 1 ? "border-b border-neutral-200/70 dark:border-neutral-800/60" : ""}`}>
                                    {row.generic[locale]}
                                </div>
                                <div className={`px-6 py-4 text-sm text-neutral-800 dark:text-neutral-200 bg-neutral-100/60 dark:bg-neutral-900/35 ${idx !== comparisonRows.length - 1 ? "border-b border-neutral-200/70 dark:border-neutral-800/60" : ""}`}>
                                    <span className="inline-flex items-start gap-2">
                                        <BadgeCheck className="w-4 h-4 mt-0.5 text-neutral-700 dark:text-neutral-300" aria-hidden="true" />
                                        <span>{row.guardian[locale]}</span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: 0.2 }}
                    className="mt-10 md:mt-12 text-center"
                >
                    <Button
                        asChild
                        variant="outline"
                        className="rounded-full px-8 h-11 md:h-12 border-neutral-300 dark:border-neutral-700 text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    >
                        <Link href={withLocale(locale, "/docs/get-started")}>{cta}</Link>
                    </Button>
                </motion.div>
            </div>
        </section>
    );
}
