"use client";

import { motion } from "framer-motion";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tag, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Release {
    tag_name: string;
    name: string;
    published_at: string;
    body: string;
    html_url: string;
}

interface TimelineViewProps {
    releases: Release[];
}

export function TimelineView({ releases }: TimelineViewProps) {
    const dateLocale = enUS;

    return (
        <div className="relative max-w-4xl mx-auto py-12 px-4 min-h-[calc(100vh-200px)] pb-32">
            {/* Central Line */}
            <div className="absolute left-[28px] md:left-1/2 top-12 bottom-0 w-px bg-gradient-to-b from-black/20 dark:from-white/20 via-black/10 dark:via-white/10 to-transparent md:-translate-x-1/2" />

            <div className="space-y-16">
                {releases.map((release, index) => {
                    const date = new Date(release.published_at);
                    const isEven = index % 2 === 0;

                    return (
                        <motion.div
                            key={release.tag_name}
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className={cn(
                                "relative flex flex-col md:flex-row gap-8 items-start",
                                isEven ? "md:flex-row-reverse" : ""
                            )}
                        >
                            {/* Timeline Node */}
                            <div
                                className="absolute left-[20px] md:left-1/2 top-0 w-4 h-4 rounded-full bg-white dark:bg-black border-2 border-black dark:border-white z-10 md:-translate-x-1/2 translate-y-2 shadow-[0_0_15px_rgba(0,0,0,0.3)] dark:shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                            >
                                <div className="absolute inset-0 rounded-full bg-black dark:bg-white animate-ping opacity-20" />
                            </div>

                            {/* Date Badge (Desktop) */}
                            <div className={cn(
                                "hidden md:flex flex-1 justify-end items-center pt-1",
                                isEven ? "justify-start" : ""
                            )}>
                                <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 rounded-full px-3 py-1 border border-zinc-200 dark:border-zinc-800">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {format(date, "d MMMM yyyy", { locale: dateLocale })}
                                </div>
                            </div>

                            {/* Content Card */}
                            <div className="flex-1 w-full pl-12 md:pl-0">
                                <div className="group relative rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-6 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg transition-all duration-300 cursor-pointer">
                                    {/* Clean Design - No Glow */}

                                    {/* Header */}
                                    <div className="relative mb-6">
                                        <div className="flex flex-wrap items-center gap-3 mb-2">
                                            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                                {release.name || release.tag_name}
                                            </h2>
                                            <span className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
                                                <Tag className="w-3 h-3 mr-1" />
                                                {release.tag_name}
                                            </span>
                                            <span className="md:hidden text-xs text-zinc-500 ml-auto">
                                                {format(date, "d MMM yyyy", { locale: dateLocale })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Markdown Content */}
                                    <div className="prose prose-sm max-w-none text-zinc-600 dark:text-zinc-300 dark:prose-invert z-10 relative">
                                        <ReactMarkdown
                                            components={{
                                                a: ({ href, children }) => (
                                                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-4 cursor-pointer">
                                                        {children}
                                                    </a>
                                                ),
                                                ul: ({ children }) => <ul className="space-y-1 my-4 list-none pl-0">{children}</ul>,
                                                li: ({ children }) => (
                                                    <li className="flex items-start gap-2 pl-0 text-zinc-600 dark:text-zinc-300">
                                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 flex-shrink-0" />
                                                        <span>{children}</span>
                                                    </li>
                                                ),
                                            }}
                                        >
                                            {release.body}
                                        </ReactMarkdown>
                                    </div>

                                    {/* Footer Removed - No GitHub Links */}
                                    <div className="mt-6 pt-6 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                                            <Tag className="w-4 h-4" />
                                            {release.tag_name}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
