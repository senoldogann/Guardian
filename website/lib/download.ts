import type { GithubAsset } from "./github";

export type Platform = "windows" | "mac-arm" | "mac-intel" | "linux" | "unknown";

export function detectPlatformFromUserAgent(userAgent: string): Platform {
  const ua = userAgent.toLowerCase();
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

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") {
    return "unknown";
  }
  return detectPlatformFromUserAgent(navigator.userAgent);
}

export function pickBestAsset(assets: GithubAsset[], platform: Platform): GithubAsset | null {
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

export function humanPlatform(platform: Platform): string {
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
