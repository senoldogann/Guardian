"use client";

import Link from "next/link";
import { Button } from "../ui/button";
import { ChevronRight, ShieldCheck, Zap, RefreshCw, Terminal, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

type LocalizedBlock = {
    title: string;
    description: string;
    icon: LucideIcon;
    link: string;
};

const featureBlocks: LocalizedBlock[] = [
    {
        title: "Live Monitoring",
        description: "Scans repository changes in real time and safely stalls execution on critical violations.",
        icon: Terminal,
        link: "/docs/monitoring"
    },
    {
        title: "Guru Assistance Layer",
        description: "Provides guided fixes, approval flow, and actionable context without slowing down delivery.",
        icon: Zap,
        link: "/docs/guru"
    },
    {
        title: "In-App Updates",
        description: "Consumes release metadata and executes secure update flow directly inside the desktop app.",
        icon: RefreshCw,
        link: "/docs/get-started"
    },
    {
        title: "Release Governance",
        description: "Supports private source + public distribution architecture for secure delivery.",
        icon: ShieldCheck,
        link: "/docs"
    }
];

export function FeaturesSection() {
    return (
        <section className="py-24 md:py-32 relative bg-white dark:bg-black transition-colors duration-300">
            <div className="absolute inset-0 bg-white dark:bg-black" />

            <div className="container px-4 sm:px-6 lg:px-8 mx-auto relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16 md:mb-20"
                >
                    <span className="inline-block px-4 py-1.5 mb-4 text-xs sm:text-sm font-medium tracking-wider text-neutral-500 dark:text-neutral-400 uppercase bg-neutral-100 dark:bg-neutral-900 rounded-full border border-neutral-200 dark:border-neutral-800">
                        Capabilities
                    </span>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 md:mb-6 text-black dark:text-white" style={{ fontFamily: 'var(--font-poppins)' }}>
                        Powerful Features
                    </h2>
                    <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto px-4" style={{ fontFamily: 'var(--font-poppins)' }}>
                        Everything you need to maintain code quality, all in one powerful desktop application
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                    {featureBlocks.map((feature, idx) => {
                        const Icon = feature.icon;
                        return (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: idx * 0.1 }}
                                viewport={{ once: true, margin: "-50px" }}
                                className="group relative"
                            >
                                <div className="relative h-full overflow-hidden rounded-2xl sm:rounded-3xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 transition-all duration-500 hover:border-neutral-400 dark:hover:border-neutral-600 hover:shadow-xl cursor-pointer">
                                    <div className="absolute inset-0 bg-gradient-to-br from-black/5 dark:from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-black/10 dark:from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-bl-full" />

                                    <div className="relative p-6 sm:p-8 flex flex-col h-full">
                                        <div className="mb-5 sm:mb-6">
                                            <div className="relative inline-flex">
                                                <div className="absolute inset-0 bg-black/20 dark:bg-white/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center group-hover:scale-110 group-hover:border-neutral-400 dark:group-hover:border-neutral-600 transition-all duration-300">
                                                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-black dark:text-white" strokeWidth={1.5} aria-hidden="true" />
                                                </div>
                                                <div className="absolute -top-2 -right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center">
                                                    <span className="text-[10px] sm:text-xs font-semibold text-black dark:text-white">{idx + 1}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-black dark:text-white transition-colors" style={{ fontFamily: 'var(--font-poppins)' }}>
                                            {feature.title}
                                        </h3>
                                        <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed flex-grow" style={{ fontFamily: 'var(--font-poppins)' }}>
                                            {feature.description}
                                        </p>

                                        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-neutral-200 dark:border-neutral-800">
                                            <Link href={feature.link} className="flex items-center gap-2 text-xs sm:text-sm text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors cursor-pointer">
                                                <span style={{ fontFamily: 'var(--font-poppins)' }}>Learn more about {feature.title}</span>
                                                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                                            </Link>
                                        </div>
                                    </div>

                                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-black/20 dark:via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="mt-12 sm:mt-16 text-center"
                >
                    <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-500 mb-4" style={{ fontFamily: 'var(--font-poppins)' }}>
                        Ready to see all features in action?
                    </p>
                    <Button
                        variant="outline"
                        className="rounded-full px-6 sm:px-8 py-2 sm:py-3 text-sm sm:text-base border-black/20 dark:border-white/20 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-all cursor-pointer"
                        asChild
                    >
                        <Link href="/docs">
                            <span style={{ fontFamily: 'var(--font-poppins)' }}>Explore Documentation</span>
                            <ChevronRight className="w-4 h-4 ml-2" aria-hidden="true" />
                        </Link>
                    </Button>
                </motion.div>
            </div>
        </section>
    );
}
