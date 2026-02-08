"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "./button";
import { detectPlatform, pickBestAsset } from "@/lib/download";
import { getLatestRelease, type GithubAsset, releaseTagToVersion } from "@/lib/github";
import { trackDownload } from "@/lib/analytics";
import { useRouter } from "next/navigation";

export function DirectDownloadButton() {
    const [assets, setAssets] = React.useState<GithubAsset[]>([]);
    const [version, setVersion] = React.useState<string>("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);
    const router = useRouter();

    React.useEffect(() => {
        setMounted(true);
        // Pre-fetch assets to make the click response instant
        getLatestRelease()
            .then(release => {
                if (release) {
                    setAssets(release.assets);
                    setVersion(releaseTagToVersion(release.tag_name));
                }
            })
            .catch(err => {
                if (process.env.NODE_ENV === "development") {
                    console.error("Failed to fetch assets for direct download", err);
                }
            });
    }, []);

    const handleDownload = async () => {
        // Direct download on click
        setIsLoading(true);
        try {
            const platform = await detectPlatform();
            const bestAsset = pickBestAsset(assets, platform);

            if (bestAsset) {
                // Track download event
                trackDownload({
                    platform,
                    version,
                    assetName: bestAsset.name,
                    downloadUrl: bestAsset.browser_download_url,
                });

                // Trigger download
                window.location.href = bestAsset.browser_download_url;
            } else {
                // Fallback to download page
                router.push("/download");
            }
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("Direct download failed", error);
            }
            router.push("/download");
        } finally {
            // Keep loading state for a bit to show something happened
            setTimeout(() => setIsLoading(false), 1000);
        }
    };

    // Prevent hydration mismatch: render static button until mounted
    if (!mounted) {
        return (
            <Button
                className="rounded-full bg-white hover:bg-zinc-200 text-black font-semibold shadow-lg shadow-white/10 px-6"
                disabled
                aria-disabled
                suppressHydrationWarning
            >
                <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                Download
            </Button>
        );
    }

    return (
        <Button
            className="rounded-full bg-white hover:bg-zinc-200 text-black font-semibold shadow-lg shadow-white/10 px-6"
            onClick={handleDownload}
            disabled={isLoading}
            aria-disabled={isLoading}
        >
            {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
            ) : (
                <Download className="w-4 h-4 mr-2" aria-hidden="true" />
            )}
            Download
        </Button>
    );
}
