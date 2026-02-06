"use client";

import { useEffect, useMemo, useState } from "react";
import type { GithubAsset } from "../../lib/github";
import { formatBytes, getAssetKind } from "../../lib/github";
import type { DocLocale, SiteDictionary } from "../../lib/i18n";
import { detectPlatform, getPlatformLabel, pickBestAsset, type Platform } from "../../lib/download";

function shortenDigest(value?: string): string {
  if (!value) return "—";
  const normalized = value.replace(/^sha256:/i, "");
  return normalized.length > 16 ? `${normalized.slice(0, 16)}...` : normalized;
}

export function DownloadClient({
  assets,
  locale,
  dict
}: {
  assets: GithubAsset[];
  locale: DocLocale;
  dict: SiteDictionary;
}) {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [isDetecting, setIsDetecting] = useState(true);
  const [platformChoice, setPlatformChoice] = useState<Platform | "auto">("auto");
  const [copiedAssetId, setCopiedAssetId] = useState<number | null>(null);

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

  const effectivePlatform = platformChoice === "auto" ? platform : platformChoice;
  const selected = useMemo(() => pickBestAsset(assets, effectivePlatform), [assets, effectivePlatform]);
  const recommendationLabel =
    locale === "tr"
      ? "Sisteminiz için en uygun paket otomatik seçildi:"
      : "Compatible installer found automatically:";
  const downloadLabel =
    locale === "tr"
      ? `${getPlatformLabel(effectivePlatform)} için indir`
      : `Download for ${getPlatformLabel(effectivePlatform)}`;
  const manualDownloadLabel = locale === "tr" ? "İndir" : "Download";
  const detectedLabel = locale === "tr" ? "Algılanan sistem" : "Detected system";
  const selectionLabel = locale === "tr" ? "Paket seçimi" : "Package selection";
  const autoOptionLabel = locale === "tr" ? "Otomatik (algılama)" : "Automatic (detected)";

  return (
    <section className="download-layout section-enter" data-delay="2">
      <article className="panel">
        <div className="eyebrow">{dict.download.recommended}</div>
        <h2 style={{ marginTop: 8 }}>{getPlatformLabel(effectivePlatform)}</h2>
        <div className="platform-picker" style={{ marginTop: 12 }}>
          <label htmlFor="platform-picker-select">
            {selectionLabel}
          </label>
          <select
            id="platform-picker-select"
            onChange={(event) => setPlatformChoice(event.target.value as Platform | "auto")}
            value={platformChoice}
          >
            <option value="auto">{autoOptionLabel}</option>
            <option value="mac-arm">macOS (Apple Silicon)</option>
            <option value="mac-intel">macOS (Intel)</option>
            <option value="windows">Windows</option>
            <option value="linux">Linux</option>
          </select>
          <p className="meta">
            {detectedLabel}: {isDetecting ? dict.download.detecting : getPlatformLabel(platform)}
          </p>
        </div>
        {selected ? (
          <>
            <p className="meta" style={{ marginTop: 10 }}>
              {recommendationLabel} <strong>{selected.name}</strong>
            </p>
            <div className="asset-meta" style={{ marginTop: 10 }}>
              <span>{dict.download.size}: {formatBytes(selected.size)}</span>
              <span>{dict.download.checksum}: {shortenDigest(selected.digest)}</span>
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <a className="button" href={selected.browser_download_url}>
                {downloadLabel}
              </a>
            </div>
          </>
        ) : (
          <p className="meta" style={{ marginTop: 10 }}>
            {isDetecting && platformChoice === "auto"
              ? dict.download.detecting
              : dict.download.noMatch}
          </p>
        )}
      </article>

      <article className="panel">
        <div className="eyebrow">{dict.download.manual}</div>
        <div className="asset-list">
          {assets.map((asset) => (
            <div className="asset-item" key={asset.id}>
              <div className="asset-name">
                <strong>{asset.name}</strong>
                <div className="asset-meta">
                  <span className="badge">{getAssetKind(asset.name)}</span>
                  <span>{dict.download.size}: {formatBytes(asset.size)}</span>
                  <span>{dict.download.checksum}: {shortenDigest(asset.digest)}</span>
                </div>
              </div>
              <div className="asset-actions">
                {asset.digest ? (
                  <button
                    className="button-subtle"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(asset.digest ?? "");
                        setCopiedAssetId(asset.id);
                        setTimeout(() => setCopiedAssetId(null), 1200);
                      } catch {
                        setCopiedAssetId(null);
                      }
                    }}
                    type="button"
                  >
                    {copiedAssetId === asset.id ? (locale === "tr" ? "Kopyalandı" : "Copied") : "SHA-256"}
                  </button>
                ) : null}
                <a className="button-subtle" href={asset.browser_download_url}>
                  {manualDownloadLabel}
                </a>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
