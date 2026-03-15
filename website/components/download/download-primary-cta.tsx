"use client";

import { useEffect, useMemo, useState } from "react";
import type { GithubAsset } from "../../lib/github";
import type { SiteDictionary } from "../../lib/i18n";
import { detectPlatform, getPlatformLabel, pickBestAsset, type Platform } from "../../lib/download";

type Props = {
  assets: GithubAsset[];
  dict: SiteDictionary;
  fallbackHref: string;
  className?: string;
};

export function DownloadPrimaryCta({ assets, dict, fallbackHref, className = "button" }: Props) {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [isDetecting, setIsDetecting] = useState(true);

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

  const selected = useMemo(() => pickBestAsset(assets, platform), [assets, platform]);
  const href = selected?.browser_download_url ?? fallbackHref;

  const label = useMemo(() => {
    if (isDetecting) return dict.nav.download;
    if (!selected || platform === "unknown") return dict.nav.download;
    return `${dict.nav.download} (${getPlatformLabel(platform)})`;
  }, [dict.nav.download, isDetecting, platform, selected]);

  return (
    <a className={`${className} cursor-pointer`} href={href}>
      {label}
    </a>
  );
}

