"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getLatestRelease, getDistributionRepoUrl, pickInstallers, releaseTagToVersion } from "../../lib/github";
import { detectPlatform, pickBestAsset } from "../../lib/download";
import type { SiteDictionary } from "../../lib/i18n";

interface HeroSectionProps {
    dict: SiteDictionary;
}

export function HeroSection({ dict }: HeroSectionProps) {
    const [releaseInfo, setReleaseInfo] = useState({
        tag: "—",
        date: "—",
        installers: [] as ReturnType<typeof pickInstallers>,
        url: getDistributionRepoUrl(),
        error: null as string | null
    });
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        getLatestRelease()
            .then(latest => {
                if (latest) {
                    setReleaseInfo({
                        tag: releaseTagToVersion(latest.tag_name),
                        date: new Date(latest.published_at || "").toLocaleDateString(),
                        installers: pickInstallers(latest.assets),
                        url: latest.html_url,
                        error: null
                    });
                } else {
                    setReleaseInfo(prev => ({
                        ...prev,
                        error: dict.common.releaseNotAvailable
                    }));
                }
            })
            .catch(error => {
                setReleaseInfo(prev => ({
                    ...prev,
                    error: error instanceof Error ? error.message : dict.common.releaseNotAvailable
                }));
            });
    }, [dict.common.releaseNotAvailable]);

    const handleDownload = async () => {
        if (releaseInfo.installers.length === 0) return;

        setIsDownloading(true);
        try {
            const platform = await detectPlatform();
            const asset = pickBestAsset(releaseInfo.installers, platform);

            if (asset) {
                window.location.href = asset.browser_download_url;
            } else {
                window.location.href = releaseInfo.installers[0].browser_download_url;
            }
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("Download failed:", error);
            }
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <section className="relative overflow-hidden pt-24 pb-32 md:pt-32 md:pb-48 bg-white dark:bg-black transition-colors duration-300">
            <div className="container px-4 mx-auto text-center z-10 relative max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="mb-8"
                >
                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] text-black dark:text-white">
                        Quality Standards
                        <br />
                        <span className="text-neutral-600 dark:text-neutral-400">at Release Speed</span>
                    </h1>
                </motion.div>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-12 leading-relaxed"
                >
                    Enterprise-grade architecture governance and security audit platform for engineering teams.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                >
                    <Button
                        size="lg"
                        className="rounded-lg px-8 h-12 text-base font-semibold gap-2 bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-md transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                        onClick={handleDownload}
                        disabled={isDownloading || releaseInfo.installers.length === 0}
                    >
                        {isDownloading && (
                            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                        )}
                        <span>{isDownloading ? "Preparing..." : dict.home.ctaPrimary}</span>
                        <span className="text-xs opacity-70 font-normal">v{releaseInfo.tag}</span>
                    </Button>

                    <Button
                        size="lg"
                        variant="outline"
                        className="rounded-lg px-8 h-12 text-base font-semibold gap-2 border-2 border-neutral-300 dark:border-white/20 text-neutral-700 dark:text-white hover:bg-neutral-100 dark:hover:bg-white/10 hover:border-neutral-400 dark:hover:border-white/40 transition-all duration-200"
                        asChild
                    >
                        <Link href="/docs">
                            <span>Documentation</span>
                        </Link>
                    </Button>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="mt-16 relative mx-auto max-w-5xl"
                >
                    <div className="relative rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-black shadow-2xl overflow-hidden">
                        <Image
                            alt="Guardian application dashboard"
                            src="/media/guardian-monitor.png"
                            width={1200}
                            height={675}
                            className="w-full h-auto"
                            priority
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                        />
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
