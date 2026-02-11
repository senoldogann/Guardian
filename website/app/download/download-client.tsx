"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GithubAsset } from "../../lib/github";
import { formatBytes, getAssetKind } from "../../lib/github";
import type { SiteDictionary } from "../../lib/i18n";
import { detectPlatform, getPlatformLabel, pickBestAsset, type Platform, type PlatformChoice } from "../../lib/download";

export function DownloadClient({
  assets,
  dict
}: {
  assets: GithubAsset[];
  dict: SiteDictionary;
}) {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [isDetecting, setIsDetecting] = useState(true);
  const [platformChoice, setPlatformChoice] = useState<PlatformChoice>("auto");

  useEffect(() => {
    let active = true;
    detectPlatform()
      .then((resolved) => {
        if (active) setPlatform(resolved);
      })
      .catch(() => {
        if (active) setPlatform("unknown");
      })
      .finally(() => {
        if (active) setIsDetecting(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const effectivePlatform: Platform = platformChoice === "auto" ? platform : platformChoice;
  const selected = useMemo(() => pickBestAsset(assets, effectivePlatform), [assets, effectivePlatform]);

  const headlineLabel = platformChoice === "auto"
    ? (isDetecting ? dict.download.detecting : getPlatformLabel(platform))
    : getPlatformLabel(platformChoice);

  const downloadLabel =
    effectivePlatform === "unknown"
      ? dict.nav.download
      : `${dict.nav.download} (${getPlatformLabel(effectivePlatform)})`;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8">
        <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur p-6 shadow-[0_1px_0_rgba(17,19,23,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-[0.22em] uppercase text-neutral-500">
                {dict.download.recommended}
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                {headlineLabel}
              </h2>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                {dict.download.description}
              </p>
            </div>

            <div className="w-full sm:w-auto sm:min-w-[210px]">
              <label htmlFor="platform-picker-select" className="text-xs font-medium tracking-[0.18em] uppercase text-neutral-500">
                Platform
              </label>
              <select
                id="platform-picker-select"
                onChange={(event) => setPlatformChoice(event.target.value as PlatformChoice)}
                value={platformChoice}
                disabled={isDetecting}
                className="mt-2 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 focus-visible:ring-offset-2"
              >
                <option value="auto">Auto (detect)</option>
                <option value="mac_arm64">macOS (Apple Silicon)</option>
                <option value="mac_x64">macOS (Intel)</option>
                <option value="windows_x64">Windows</option>
                <option value="linux_x64">Linux</option>
              </select>
              <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                {isDetecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{dict.download.detecting}</span>
                  </>
                ) : (
                  <span>Detected: {getPlatformLabel(platform)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-neutral-200/70 dark:border-neutral-800/70 pt-6">
            {selected ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium text-neutral-950 dark:text-white">{selected.name}</span>
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                    {dict.download.size}: {formatBytes(selected.size)}
                  </p>
                </div>
                <a
                  className="inline-flex max-w-full items-center justify-center rounded-full px-5 py-3 text-center text-sm font-medium leading-tight whitespace-normal bg-neutral-950 text-white hover:bg-neutral-900 transition-colors"
                  href={selected.browser_download_url}
                >
                  {downloadLabel}
                </a>
              </div>
            ) : (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {isDetecting && platformChoice === "auto" ? dict.download.detecting : dict.download.noMatch}
              </p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur p-6">
          <p className="text-xs font-medium tracking-[0.22em] uppercase text-neutral-500">
            {dict.download.manual}
          </p>
          <div className="mt-4 divide-y divide-neutral-200/70 dark:divide-neutral-800/70">
            {assets.map((asset) => (
              <div key={asset.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-950 dark:text-white">
                    {asset.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="inline-flex items-center rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-0.5">
                      {getAssetKind(asset.name)}
                    </span>
                    <span>{dict.download.size}: {formatBytes(asset.size)}</span>
                  </div>
                </div>
                <a
                  className="shrink-0 inline-flex min-h-10 items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  href={asset.browser_download_url}
                >
                  {dict.nav.download}
                </a>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
