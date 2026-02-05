"use client";

import { useMemo } from "react";
import type { GithubAsset } from "../../lib/github";

type Platform = "windows" | "mac-arm" | "mac-intel" | "linux" | "unknown";

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  const isMac = ua.includes("mac os");
  const isWindows = ua.includes("win");
  const isLinux = ua.includes("linux");
  const isArm = ua.includes("arm64") || ua.includes("aarch64");

  if (isWindows) return "windows";
  if (isMac && isArm) return "mac-arm";
  if (isMac) return "mac-intel";
  if (isLinux) return "linux";
  return "unknown";
}

function pickBestAsset(assets: GithubAsset[], platform: Platform): GithubAsset | null {
  const installers = assets.filter((asset) => {
    const n = asset.name.toLowerCase();
    return !n.endsWith(".sig") && !n.endsWith(".json");
  });

  const match = (predicates: Array<(name: string) => boolean>): GithubAsset | undefined => {
    return installers.find((asset) => predicates.every((check) => check(asset.name.toLowerCase())));
  };

  if (platform === "windows") {
    return (
      match([(n) => n.includes("x86_64-pc-windows-msvc"), (n) => n.endsWith(".msi")]) ||
      match([(n) => n.endsWith(".msi")]) ||
      match([(n) => n.endsWith(".exe")]) ||
      null
    );
  }

  if (platform === "mac-arm") {
    return (
      match([(n) => n.includes("aarch64-apple-darwin"), (n) => n.endsWith(".dmg")]) ||
      match([(n) => n.includes("aarch64-apple-darwin")]) ||
      match([(n) => n.endsWith(".dmg")]) ||
      null
    );
  }

  if (platform === "mac-intel") {
    return (
      match([(n) => n.includes("x86_64-apple-darwin"), (n) => n.endsWith(".dmg")]) ||
      match([(n) => n.includes("x86_64-apple-darwin")]) ||
      match([(n) => n.endsWith(".dmg")]) ||
      null
    );
  }

  if (platform === "linux") {
    return (
      match([(n) => n.endsWith(".appimage")]) ||
      match([(n) => n.endsWith(".deb")]) ||
      match([(n) => n.endsWith(".rpm")]) ||
      null
    );
  }

  return installers.find((asset) => asset.name.endsWith(".msi") || asset.name.endsWith(".dmg")) ?? null;
}

function humanPlatform(platform: Platform): string {
  switch (platform) {
    case "windows":
      return "Windows";
    case "mac-arm":
      return "macOS (Apple Silicon)";
    case "mac-intel":
      return "macOS (Intel)";
    case "linux":
      return "Linux";
    default:
      return "Unknown OS";
  }
}

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
