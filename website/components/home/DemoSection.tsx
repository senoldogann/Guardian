"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import type { SiteDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/locale";
import { withLocale } from "../../lib/locale";

interface DemoSectionProps {
    dict: SiteDictionary;
    locale: Locale;
}

// Video component with loading state
function VideoWithLoading({ src, poster }: { src: string; poster: string }) {
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (video) {
            const handleLoadedData = () => setIsLoading(false);
            const handleError = () => setIsLoading(false);

            video.addEventListener("loadeddata", handleLoadedData);
            video.addEventListener("error", handleError);

            // Check if already loaded
            if (video.readyState >= 3) {
                setIsLoading(false);
            }

            return () => {
                video.removeEventListener("loadeddata", handleLoadedData);
                video.removeEventListener("error", handleError);
            };
        }
    }, []);

    return (
        <div className="relative w-full">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                    <Loader2 className="w-8 h-8 text-white animate-spin" aria-hidden="true" />
                </div>
            )}
            <video
                ref={videoRef}
                className="w-full h-auto"
                autoPlay
                muted
                loop
                playsInline
                poster={poster}
                src={src}
            />
        </div>
    );
}

export function DemoSection({ dict, locale }: DemoSectionProps) {
    const guruBullets =
        locale === "tr"
            ? [
                "AI-heavy değişikliklerde mimari drift’i işaretler",
                "Riskleri reviewer için açık ve kısa anlatır",
                "Takım politikasına uyumlu fix önerileri sunar"
            ]
            : [
                "Flags architectural drift in AI-heavy changes",
                "Explains risk clearly for human reviewers",
                "Suggests fixes aligned with team policies"
            ];
    const authBullets =
        locale === "tr"
            ? [
                "Pass / Pass with warning / Block karar akışı",
                "Override için sorumlu kişi ve gerekçe zorunluluğu",
                "Her release kararı için tam denetim izi"
            ]
            : [
                "Pass / Pass with warning / Block decision flow",
                "Override requires owner and explicit reason",
                "Complete audit trail for each release decision"
            ];
    const guruCta = locale === "tr" ? "Risk Açıklamalarını Gör" : "See Risk Explanations";
    const securityCta = locale === "tr" ? "Onay Akışını Gör" : "See Approval Workflow";

    return (
        <>
            {/* Guru Section */}
            <section className="py-28 bg-white dark:bg-black transition-colors duration-300">
                <div className="container px-4 mx-auto">
                    <div className="flex flex-col md:flex-row items-center gap-16">
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="flex-1 space-y-8"
                        >
                            <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight text-black dark:text-white">{dict.home.sections.guru.title}</h2>
                            <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                {dict.home.sections.guru.description}
                            </p>
                            <ul className="space-y-4 pt-2">
                                {guruBullets.map((item, idx) => (
                                    <motion.li
                                        key={idx}
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        viewport={{ once: true }}
                                        className="flex items-center gap-4 text-base font-medium text-zinc-700 dark:text-zinc-200"
                                    >
                                        <div className="h-1.5 w-1.5 rounded-full bg-black dark:bg-white" />
                                        {item}
                                    </motion.li>
                                ))}
                            </ul>
                            <Button asChild className="mt-4 rounded-full px-6 h-12 gap-2 bg-black text-white dark:bg-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer">
                                <Link href={withLocale(locale, "/docs/guru")}>
                                    {guruCta}
                                </Link>
                            </Button>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="flex-1 relative"
                        >
                            <div className="absolute -inset-8 bg-gradient-to-r from-black/10 to-zinc-400/10 dark:from-white/10 dark:to-zinc-500/10 rounded-full blur-3xl opacity-60 -z-10" />
                            <div className="rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-black shadow-2xl">
                                <Image
                                    alt="Guardian Guru - AI Architect Interface"
                                    src="/media/guru-image.png"
                                    width={800}
                                    height={450}
                                    className="w-full h-auto"
                                    layout="responsive"
                                />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Approval Section */}
            <section className="py-28 relative bg-white dark:bg-black transition-colors duration-300">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-black/5 dark:via-white/5 dark:to-white/5" />
                <div className="container px-4 mx-auto relative">
                    <div className="flex flex-col md:flex-row-reverse items-center gap-16">
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="flex-1 space-y-8"
                        >
                            <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight text-black dark:text-white">{dict.home.sections.auth.title}</h2>
                            <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                {dict.home.sections.auth.description}
                            </p>
                            <ul className="space-y-4 pt-2">
                                {authBullets.map((item, idx) => (
                                    <motion.li
                                        key={idx}
                                        initial={{ opacity: 0, x: 20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        viewport={{ once: true }}
                                        className="flex items-center gap-4 text-base font-medium text-zinc-700 dark:text-zinc-200"
                                    >
                                        <div className="h-1.5 w-1.5 rounded-full bg-black dark:bg-white" />
                                        {item}
                                    </motion.li>
                                ))}
                            </ul>
                            <Button asChild variant="outline" className="mt-4 rounded-full px-6 h-12 gap-2 border border-black/20 dark:border-white/20 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer">
                                <Link href={withLocale(locale, "/docs/reviews")}>
                                    {securityCta}
                                </Link>
                            </Button>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="flex-1 relative"
                        >
                            <div className="absolute -inset-8 bg-gradient-to-r from-black/10 to-zinc-400/10 dark:from-white/10 dark:to-zinc-500/10 rounded-full blur-3xl opacity-60 -z-10" />
                            <div className="rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-black shadow-2xl">
                                <VideoWithLoading
                                    src="/media/secure-identity.mp4"
                                    poster="/media/secure-identity-poster.jpg"
                                />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>
        </>
    );
}
