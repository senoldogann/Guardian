"use client";

import {
    GitPullRequest,
    ShieldAlert,
    UserCheck,
    Rocket,
    type LucideIcon
} from "lucide-react";
import { motion } from "framer-motion";
import type { Locale } from "../../lib/locale";

type ScenarioStep = {
    title: { en: string; tr: string };
    description: { en: string; tr: string };
    icon: LucideIcon;
};

const scenarioSteps: ScenarioStep[] = [
    {
        title: {
            en: "AI-Heavy PR Intake",
            tr: "AI-Heavy PR Intake"
        },
        description: {
            en: "Guardian detects AI-assisted or unusually large refactor pull requests and routes them to stricter evaluation.",
            tr: "Guardian, AI destekli veya alışılmadık büyüklükte refactor PR'larını tespit eder ve daha sıkı değerlendirmeye alır."
        },
        icon: GitPullRequest
    },
    {
        title: {
            en: "Policy Drift Detection",
            tr: "Policy Drift Tespiti"
        },
        description: {
            en: "Architecture and security policy violations are surfaced with plain-language explanations of why they matter.",
            tr: "Mimari ve güvenlik politika ihlalleri, neden önemli olduğunu açıkça anlatan açıklamalarla görünür hale getirilir."
        },
        icon: ShieldAlert
    },
    {
        title: {
            en: "Human Approval Workflow",
            tr: "İnsan Onay Akışı"
        },
        description: {
            en: "Suggested fixes are reviewed by humans. Blocks and overrides require a named approver and reason.",
            tr: "Önerilen düzeltmeler insanlar tarafından gözden geçirilir. Blok ve override kararları sorumlu kişi ve gerekçe gerektirir."
        },
        icon: UserCheck
    },
    {
        title: {
            en: "Release Decision Surface",
            tr: "Release Decision Surface"
        },
        description: {
            en: "Final output is explicit: pass, pass with warning, or block before release, backed by an audit trail.",
            tr: "Nihai çıktı nettir: release öncesi pass, pass with warning veya block ve her karar denetim izi ile kaydedilir."
        },
        icon: Rocket
    }
];

const benefitsEn = [
    "Catch risky AI changes early",
    "Enforce team policies automatically",
    "Approve releases with an audit trail"
];

const benefitsTr = [
    "Riskli AI değişikliklerini erken yakalayın",
    "Takım politikalarını otomatik uygulatın",
    "Release onaylarını denetim iziyle verin"
];

export function UseCasesSection({ locale }: { locale: Locale }) {
    const heading = locale === "tr" ? "Tek Kahraman Senaryo" : "Single Hero Use Case";
    const sub =
        locale === "tr"
            ? "Bir geliştirici Copilot/Claude/Cursor ile büyük bir PR hazırlıyor. Guardian bu değişikliği release öncesi nasıl kontrol ediyor?"
            : "A developer uses Copilot/Claude/Cursor to build a large PR. Here is how Guardian controls that change before release.";
    const outcomeTitle = locale === "tr" ? "Sonuç" : "Outcome";
    const benefits = locale === "tr" ? benefitsTr : benefitsEn;

    return (
        <section className="py-24 md:py-32 relative bg-white dark:bg-black transition-colors duration-300">
            <div className="absolute inset-0 bg-gradient-to-b from-white via-zinc-50 to-white dark:from-black dark:via-zinc-950 dark:to-black" />

            <div className="container px-4 mx-auto relative max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-12 md:mb-16"
                >
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-black dark:text-white">
                        {heading}
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto text-base md:text-lg leading-relaxed">
                        {sub}
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-10">
                    {scenarioSteps.map((step, idx) => {
                        const Icon = step.icon;
                        return (
                            <motion.article
                                key={step.title.en}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-30px" }}
                                transition={{ duration: 0.45, delay: idx * 0.08 }}
                                className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black p-6 md:p-7 shadow-sm"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
                                        <Icon className="w-5 h-5 text-black dark:text-white" aria-hidden="true" />
                                    </div>
                                    <span className="text-xs font-mono tracking-wider text-neutral-500 dark:text-neutral-400">
                                        {locale === "tr" ? `ADIM 0${idx + 1}` : `STEP 0${idx + 1}`}
                                    </span>
                                </div>
                                <h3 className="text-lg md:text-xl font-semibold text-black dark:text-white mb-2">
                                    {step.title[locale]}
                                </h3>
                                <p className="text-sm md:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                    {step.description[locale]}
                                </p>
                            </motion.article>
                        );
                    })}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: 0.2 }}
                    className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 p-6 md:p-8"
                >
                    <h3 className="text-lg md:text-xl font-semibold text-black dark:text-white mb-4">{outcomeTitle}</h3>
                    <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                        {benefits.map((item) => (
                            <li
                                key={item}
                                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black px-4 py-3 text-sm md:text-base text-neutral-700 dark:text-neutral-300"
                            >
                                {item}
                            </li>
                        ))}
                    </ul>
                </motion.div>
            </div>
        </section>
    );
}
