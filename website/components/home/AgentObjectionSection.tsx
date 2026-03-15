"use client";

import { motion } from "framer-motion";
import { Bot, GitBranchPlus, ShieldCheck, Stamp, type LucideIcon } from "lucide-react";
import type { Locale } from "../../lib/locale";

type Differentiator = {
  title: { en: string; tr: string };
  description: { en: string; tr: string };
  icon: LucideIcon;
};

const differentiators: Differentiator[] = [
  {
    title: {
      en: "Agents produce analysis",
      tr: "Ajanlar analiz üretir",
    },
    description: {
      en: "Great models can review code, but output quality still varies by prompt, model choice, and operator discipline.",
      tr: "Güçlü modeller kodu inceleyebilir; ancak çıktı kalitesi prompt, model seçimi ve operatör disiplinine göre değişir.",
    },
    icon: Bot,
  },
  {
    title: {
      en: "Guardian enforces policy",
      tr: "Guardian policy uygulatır",
    },
    description: {
      en: "The same repo policy is applied across desktop, CLI, and CI so release decisions do not drift between people or tools.",
      tr: "Aynı repo policy'si desktop, CLI ve CI tarafında tutarlı çalışır; kararlar kişiye veya araca göre kaymaz.",
    },
    icon: ShieldCheck,
  },
  {
    title: {
      en: "Guardian controls release gates",
      tr: "Guardian release gate’i yönetir",
    },
    description: {
      en: "Strict/warn/off gate behavior blocks risky releases when required, instead of stopping at a suggestion list.",
      tr: "Strict/warn/off gate davranışı, yalnızca öneri listesi üretmek yerine gerektiğinde riskli release'i gerçekten durdurur.",
    },
    icon: GitBranchPlus,
  },
  {
    title: {
      en: "Guardian preserves accountability",
      tr: "Guardian hesap verilebilirlik sağlar",
    },
    description: {
      en: "Approver, override owner, and reason are written to an auditable decision trail before code ships.",
      tr: "Kod release'e çıkmadan önce onaylayan, override sahibi ve gerekçe denetlenebilir karar izine kaydedilir.",
    },
    icon: Stamp,
  },
];

export function AgentObjectionSection({ locale }: { locale: Locale }) {
  const title =
    locale === "tr"
      ? "Neden sadece kendi ajan review süreci yeterli değil?"
      : "Why not rely only on your own agent reviews?";
  const subtitle =
    locale === "tr"
      ? "Guardian, ajanların ürettiği incelemeyi kurumsal release kararına çeviren governance katmanıdır."
      : "Guardian is the governance layer that turns agent output into a consistent release decision process.";

  return (
    <section className="home-section-soft relative py-20 md:py-24 bg-white dark:bg-black transition-colors duration-300 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_12%,rgba(15,23,42,0.08),transparent_48%)] dark:bg-[radial-gradient(circle_at_70%_12%,rgba(148,163,184,0.12),transparent_48%)]" />
      <div className="container relative z-10 px-4 sm:px-6 lg:px-8 mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="text-center mb-12 md:mb-14"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
            {locale === "tr" ? "Karar Katmanı" : "Decision Layer"}
          </p>
          <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-black dark:text-white">
            {title}
          </h2>
          <p className="mt-4 max-w-3xl mx-auto text-base md:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {differentiators.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.article
                key={item.title.en}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: idx * 0.06 }}
                className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/70 p-6 md:p-7"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 mb-4">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-black dark:text-white mb-2">
                  {item.title[locale]}
                </h3>
                <p className="text-sm md:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {item.description[locale]}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
