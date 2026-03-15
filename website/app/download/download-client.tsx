"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download, Loader2, Sparkles } from "lucide-react";
import type { GithubAsset } from "../../lib/github";
import { formatBytes, getAssetKind } from "../../lib/github";
import type { SiteDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/locale";
import { detectPlatform, getPlatformLabel, pickBestAsset, type Platform, type PlatformChoice } from "../../lib/download";

function AppleLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.5 13.6c0 3.4 2.8 4.7 2.9 4.7-.1.3-.4 1.1-.9 1.9-.8 1.4-1.8 2.8-3.1 2.8-1.2 0-1.6-.7-3.1-.7-1.4 0-1.9.7-3 .7-1.3 0-2.3-1.3-3.1-2.7-1.7-2.8-3.1-7.6-1.3-10.8.9-1.6 2.5-2.6 4.2-2.6 1.3 0 2.4.9 3 .9.6 0 2-.9 3.5-.8.6 0 2.3.2 3.4 1.8-.1.1-2 1.2-2 3.8Z" />
      <path d="M15 5.6c.7-.9 1.2-2.1 1.1-3.3-1 .1-2.2.7-2.9 1.6-.6.8-1.2 2-1.1 3.1 1.1.1 2.2-.5 2.9-1.4Z" />
    </svg>
  );
}

function WindowsLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M2.6 4.6 10.9 3v8.2H2.6V4.6Zm9.6 6.6V2.8L21.4 1v10.2h-9.2Zm-9.6 1.4h8.3v8.2l-8.3-1.6v-6.6Zm9.6 0h9.2v10.2l-9.2-1.8v-8.4Z" />
    </svg>
  );
}

export function DownloadClient({
  assets,
  dict,
  locale
}: {
  assets: GithubAsset[];
  dict: SiteDictionary;
  locale: Locale;
}) {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [isDetecting, setIsDetecting] = useState(true);
  const [platformChoice, setPlatformChoice] = useState<PlatformChoice>("auto");
  const [showManual, setShowManual] = useState(false);

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
  const windowsAsset = useMemo(() => pickBestAsset(assets, "windows_x64"), [assets]);
  const macArmAsset = useMemo(() => pickBestAsset(assets, "mac_arm64"), [assets]);
  const macIntelAsset = useMemo(() => pickBestAsset(assets, "mac_x64"), [assets]);

  const headlineLabel = platformChoice === "auto"
    ? (isDetecting ? dict.download.detecting : getPlatformLabel(platform, locale))
    : getPlatformLabel(platformChoice, locale);

  const downloadLabel =
    effectivePlatform === "unknown"
      ? dict.nav.download
      : `${dict.nav.download} (${getPlatformLabel(effectivePlatform, locale)})`;

  const directOptions = [
    {
      key: "mac_arm64",
      label: getPlatformLabel("mac_arm64", locale),
      asset: macArmAsset,
      icon: <AppleLogo />,
    },
    {
      key: "mac_x64",
      label: getPlatformLabel("mac_x64", locale),
      asset: macIntelAsset,
      icon: <AppleLogo />,
    },
    {
      key: "windows_x64",
      label: getPlatformLabel("windows_x64", locale),
      asset: windowsAsset,
      icon: <WindowsLogo />,
    },
  ] as const;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-6 lg:gap-8">
        <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 p-6 sm:p-7 shadow-[0_8px_30px_-25px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
            <div>
              <p className="text-xs font-medium tracking-[0.22em] uppercase text-neutral-500">
                {dict.download.recommended}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                  {headlineLabel}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-3 py-1 text-xs text-neutral-700 dark:text-neutral-200">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {dict.download.recommendedBadge}
                </span>
              </div>
              <p className="mt-3 max-w-xl text-sm text-neutral-600 dark:text-neutral-400">
                {dict.download.description}
              </p>
            </div>

            <div className="w-full sm:w-auto sm:min-w-[210px]">
              <label htmlFor="platform-picker-select" className="text-xs font-medium tracking-[0.18em] uppercase text-neutral-500">
                {dict.download.platformLabel}
              </label>
              <select
                id="platform-picker-select"
                onChange={(event) => setPlatformChoice(event.target.value as PlatformChoice)}
                value={platformChoice}
                disabled={isDetecting}
                className="mt-2 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 focus-visible:ring-offset-2"
              >
                <option value="auto">{dict.download.platformAuto}</option>
                <option value="mac_arm64">{getPlatformLabel("mac_arm64", locale)}</option>
                <option value="mac_x64">{getPlatformLabel("mac_x64", locale)}</option>
                <option value="windows_x64">{getPlatformLabel("windows_x64", locale)}</option>
                <option value="linux_x64">{getPlatformLabel("linux_x64", locale)}</option>
              </select>
              <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                {isDetecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{dict.download.detecting}</span>
                  </>
                ) : (
                  <span>{dict.download.platformDetected}: {getPlatformLabel(platform, locale)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-neutral-200/70 dark:border-neutral-800/70 pt-6">
            {selected ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-800/40 p-4 sm:p-5">
                <div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium text-neutral-950 dark:text-white">{selected.name}</span>
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                    {dict.download.size}: {formatBytes(selected.size)}
                  </p>
                </div>
                <a
                  className="inline-flex max-w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-center text-sm font-medium leading-tight whitespace-normal bg-neutral-950 text-white hover:bg-neutral-900 transition-colors"
                  href={selected.browser_download_url}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
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

        <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 p-6 sm:p-7">
          <p className="text-xs font-medium tracking-[0.22em] uppercase text-neutral-500">
            {dict.download.direct}
          </p>
          <div className="mt-4 space-y-3">
            {directOptions.map((option) => (
              <div
                key={option.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/70 dark:bg-neutral-800/40 px-3 py-3"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-950 text-white dark:bg-white dark:text-black">
                    {option.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-950 dark:text-white">{option.label}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {option.asset ? `${getAssetKind(option.asset.name)} • ${formatBytes(option.asset.size)}` : dict.download.noPackageForPlatform}
                    </p>
                  </div>
                </div>
                {option.asset ? (
                  <a
                    className="shrink-0 inline-flex min-h-9 items-center justify-center rounded-full px-3 py-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    href={option.asset.browser_download_url}
                  >
                    {dict.nav.download}
                  </a>
                ) : null}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white"
            onClick={() => setShowManual((prev) => !prev)}
          >
            {showManual ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
            {showManual ? dict.download.hideManual : dict.download.showManual}
          </button>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{dict.download.manualHint}</p>

          {showManual ? (
            <div className="mt-4 divide-y divide-neutral-200/70 dark:divide-neutral-800/70 border-t border-neutral-200/70 dark:border-neutral-800/70">
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
          ) : null}
        </article>
      </div>
    </section>
  );
}
