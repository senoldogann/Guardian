"use client";

import { useMemo } from "react";
import type { GithubAsset } from "../../lib/github";
import { detectPlatform, humanPlatform, pickBestAsset } from "../../lib/download";

export function DownloadClient({ assets }: { assets: GithubAsset[] }) {
  const platform = detectPlatform();

  const selected = useMemo(() => pickBestAsset(assets, platform), [assets, platform]);

  return (
    <>
      <article className="card">
        <div className="eyebrow">Recommended Download</div>
        <h2 style={{ marginTop: 8 }}>{humanPlatform(platform)}</h2>
        {selected ? (
          <>
            <p className="muted" style={{ marginTop: 10 }}>
              Compatible installer found automatically: <strong>{selected.name}</strong>
            </p>
            <div className="row" style={{ marginTop: 14 }}>
              <a className="button" href={selected.browser_download_url}>
                Download for {humanPlatform(platform)}
              </a>
            </div>
          </>
        ) : (
          <p className="muted" style={{ marginTop: 10 }}>
            Automatic match not found. Use manual downloads below.
          </p>
        )}
      </article>

      <article className="card">
        <div className="eyebrow">Manual Downloads</div>
        <div className="asset-list">
          {assets.map((asset) => (
            <div className="asset" key={asset.id}>
              <span>{asset.name}</span>
              <a className="button-subtle" href={asset.browser_download_url}>
                Download
              </a>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}
