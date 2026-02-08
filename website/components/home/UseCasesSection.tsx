"use client";

import { Code2, Lock, GitBranch, Building2, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type UseCase = {
    title: string;
    description: string;
    icon: LucideIcon;
    scenarios: string[];
};

const useCases: UseCase[] = [
    {
        title: "Architecture Enforcement",
        description: "Ensure your codebase follows established architectural patterns and standards across the entire team.",
        icon: Code2,
        scenarios: [
            "Detect dependency violations between layers",
            "Enforce coding standards automatically",
            "Prevent architectural drift over time"
        ]
    },
    {
        title: "Security Compliance",
        description: "Continuously audit code for security vulnerabilities and compliance with industry standards.",
        icon: Lock,
        scenarios: [
            "Identify OWASP Top 10 vulnerabilities",
            "Detect exposed secrets and credentials",
            "Ensure compliance with security policies"
        ]
    },
    {
        title: "Release Quality Gates",
        description: "Implement automated quality checks that prevent poor-quality code from reaching production.",
        icon: GitBranch,
        scenarios: [
            "Block releases with critical issues",
            "Automated pre-deployment checks",
            "Quality metrics and reporting"
        ]
    },
    {
        title: "Enterprise Governance",
        description: "Scale code quality practices across large organizations with centralized governance.",
        icon: Building2,
        scenarios: [
            "Standardize practices across teams",
            "Centralized policy management",
            "Audit trails and compliance reporting"
        ]
    }
];

export function UseCasesSection() {
    return (
        <section className="py-32 relative bg-white dark:bg-black overflow-hidden transition-colors duration-300">
            <div className="absolute inset-0 bg-gradient-to-b from-white via-zinc-50 to-white dark:from-black dark:via-zinc-950 dark:to-black" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-32 bg-gradient-to-b from-transparent via-black/20 dark:via-white/20 to-transparent" />

            <div className="container px-4 mx-auto relative max-w-5xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-24"
                >
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-black dark:text-white">
                        Built for Real-World Challenges
                    </h2>
                    <p className="text-zinc-500 max-w-xl mx-auto">
                        How engineering teams use Guardian to maintain quality at scale
                    </p>
                </motion.div>

                <div className="relative">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black/5 dark:bg-white/5 -translate-x-1/2 hidden md:block" />

                    {useCases.map((useCase, idx) => {
                        const Icon = useCase.icon;
                        const isEven = idx % 2 === 0;

                        return (
                            <motion.div
                                key={useCase.title}
                                initial={{ opacity: 0, x: isEven ? -30 : 30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.6, delay: idx * 0.15 }}
                                viewport={{ once: true, margin: "-50px" }}
                                className="relative mb-20 last:mb-0"
                            >
                                <div className={cn(
                                    "flex items-center gap-8 md:gap-16",
                                    isEven ? "md:flex-row" : "md:flex-row-reverse"
                                )}>
                                    <div className={cn(
                                        "flex-1 md:text-right",
                                        isEven ? "md:text-right" : "md:text-left"
                                    )}>
                                        <div className="group">
                                            <div className={cn(
                                                "inline-flex items-center gap-3 mb-4",
                                                isEven ? "md:flex-row-reverse" : ""
                                            )}>
                                                <span className="text-xs font-mono text-zinc-400 dark:text-zinc-600">
                                                    0{idx + 1}
                                                </span>
                                                <h3 className="text-xl font-semibold text-black dark:text-white group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                                                    {useCase.title}
                                                </h3>
                                            </div>
                                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4 text-sm md:text-base">
                                                {useCase.description}
                                            </p>
                                            <ul className={cn(
                                                "space-y-2",
                                                isEven ? "md:items-end" : "md:items-start"
                                            )}>
                                                {useCase.scenarios.slice(0, 2).map((scenario, sIdx) => (
                                                    <li
                                                        key={sIdx}
                                                        className={cn(
                                                            "flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-600",
                                                            isEven ? "md:flex-row-reverse" : ""
                                                        )}
                                                    >
                                                        <span className="w-1 h-1 rounded-full bg-black/20 dark:bg-white/20" />
                                                        {scenario}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="hidden md:flex shrink-0 relative">
                                        <div className="w-12 h-12 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-black flex items-center justify-center relative z-10 group-hover:border-black/20 dark:group-hover:border-white/20 transition-colors">
                                            <Icon className="w-5 h-5 text-black/60 dark:text-white/60" />
                                        </div>
                                        <div className="absolute inset-0 rounded-full bg-black/5 dark:bg-white/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>

                                    <div className="hidden md:block flex-1" />
                                </div>

                                <div className="md:hidden absolute left-0 top-0 -translate-x-full pr-4">
                                    <span className="text-xs font-mono text-zinc-400 dark:text-zinc-700">0{idx + 1}</span>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
