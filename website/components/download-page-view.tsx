"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Download, Apple, Monitor, Laptop, Package, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import type { GithubAsset } from "../lib/github";
import type { SiteDictionary } from "../lib/i18n";
import { pickBestAsset, detectPlatform, type Platform } from "../lib/download";
import { formatBytes } from "../lib/github";

const PLATFORM_ICONS: Record<Platform, LucideIcon> = {
    linux_x64: Laptop,
    mac_arm64: Apple,
    mac_x64: Apple,
    unknown: Package,
    windows_x64: Monitor,
};

type Props = {
    dict: SiteDictionary;
    assets: GithubAsset[];
    latestTag: string;
};

export function DownloadPageView({ dict, assets, latestTag }: Props) {
    const [platform, setPlatform] = useState<Platform>("unknown");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        detectPlatform()
            .then(setPlatform)
            .finally(() => setLoading(false));
    }, []);

    const bestAsset = pickBestAsset(assets, platform);

    const PlatformIcon = PLATFORM_ICONS[platform];

    return (
        <div className="min-h-screen bg-background font-sans text-foreground">
            <main className="container mx-auto px-4 py-32 text-center max-w-3xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-8">
                        <Download className="h-10 w-10" aria-hidden="true" />
                    </div>

                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                        {dict.download.title}
                    </h1>
                    <p className="text-xl text-muted-foreground mb-12 flex flex-col items-center gap-2">
                        {dict.download.description}
                        {latestTag !== "—" && (
                            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                                v{latestTag}
                            </span>
                        )}
                    </p>

                    {!loading && bestAsset ? (
                        <div className="mb-16">
                            <Button size="lg" className="h-14 px-8 text-lg gap-3 rounded-full shadow-xl shadow-primary/20" asChild>
                                <a href={bestAsset.browser_download_url}>
                                    <PlatformIcon className="h-5 w-5" aria-hidden="true" />
                                    {platform === "unknown"
                                        ? dict.nav.download
                                        : dict.download.recommended}
                                </a>
                            </Button>
                            <div className="mt-4 text-sm text-muted-foreground">
                                {bestAsset.name} • {formatBytes(bestAsset.size)}
                            </div>
                        </div>
                    ) : (
                        <div className="mb-16 h-14" /> // Spacer
                    )}

                    <div className="text-left bg-card border rounded-3xl p-8 shadow-sm">
                        <h3 className="font-bold mb-6 flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" aria-hidden="true" />
                            {dict.download.manual}
                        </h3>

                        <div className="grid gap-4 md:grid-cols-2">
                            {assets.map((asset) => (
                                <a
                                    key={asset.id}
                                    href={asset.browser_download_url}
                                    className="group p-4 rounded-xl border bg-muted/30 hover:bg-muted hover:border-primary/50 transition-all"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="font-semibold text-sm truncate pr-2 text-foreground">{asset.name}</div>
                                        <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                                    </div>
                                    <div className="text-xs text-muted-foreground flex justify-between">
                                        <span>{formatBytes(asset.size)}</span>
                                        <span className="uppercase tracking-wider opacity-70">{asset.name.split('.').pop()}</span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
