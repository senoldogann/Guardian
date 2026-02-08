import type { GithubAsset } from "./github";

export type Platform =
  | "mac_arm64"
  | "mac_x64"
  | "windows_x64"
  | "linux_x64"
  | "unknown";

export type PlatformChoice = Platform | "auto";

type UaData = {
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
  platform?: string;
};

function toLowerSafe(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function detectOs(uaLower: string): "mac" | "win" | "linux" | "unknown" {
  if (uaLower.includes("windows") || uaLower.includes("win32") || uaLower.includes("win64")) return "win";
  if (uaLower.includes("mac os x") || uaLower.includes("macintosh") || uaLower.includes("mac os")) return "mac";
  if (uaLower.includes("linux") && !uaLower.includes("android")) return "linux";
  return "unknown";
}

async function detectArchitecture(): Promise<"arm64" | "x64" | "unknown"> {
  try {
    const uaData = (navigator as unknown as { userAgentData?: UaData }).userAgentData;
    if (!uaData?.getHighEntropyValues) return "unknown";
    const hints = await uaData.getHighEntropyValues(["architecture", "bitness", "platform"]);
    const arch = toLowerSafe(hints.architecture);
    const bitness = toLowerSafe(hints.bitness);

    if (arch.includes("arm") || arch.includes("aarch64")) return "arm64";
    if (arch.includes("x86") || arch.includes("amd") || arch.includes("x64")) return "x64";
    if (bitness === "64") return "x64";
  } catch {
    // Ignore and fall back.
  }
  return "unknown";
}

export async function detectPlatform(): Promise<Platform> {
  const uaLower = navigator.userAgent.toLowerCase();
  const os = detectOs(uaLower);

  if (os === "mac") {
    const arch = await detectArchitecture();
    // Architecture is not reliably detectable in every browser on macOS.
    // Defaulting to Apple Silicon gives the best outcome for most users;
    // the UI still provides an explicit Intel option.
    if (arch === "x64") return "mac_x64";
    return "mac_arm64";
  }

  if (os === "win") return "windows_x64";
  if (os === "linux") return "linux_x64";
  return "unknown";
}

export function getPlatformLabel(platform: Platform): string {
  switch (platform) {
    case "mac_arm64":
      return "macOS (Apple Silicon)";
    case "mac_x64":
      return "macOS (Intel)";
    case "windows_x64":
      return "Windows";
    case "linux_x64":
      return "Linux";
    default:
      return "Unknown";
  }
}

function looksLikeArmAsset(nameLower: string): boolean {
  return /aarch64|arm64|apple[-_ ]?silicon|silicon|m1|m2|m3/.test(nameLower);
}

function looksLikeIntelAsset(nameLower: string): boolean {
  return /x86_64|x64|intel/.test(nameLower);
}

export function pickBestAsset(assets: GithubAsset[], platform: Platform): GithubAsset | undefined {
  const byExt = (exts: string[]) =>
    assets.filter((asset) => exts.some((ext) => asset.name.toLowerCase().endsWith(ext)));

  const dmgs = byExt([".dmg"]);
  const msis = byExt([".msi"]);
  const exes = byExt(["-setup.exe", ".exe"]);
  const appImages = byExt([".appimage"]);
  const debs = byExt([".deb"]);
  const rpms = byExt([".rpm"]);

  if (platform === "mac_arm64") {
    return (
      dmgs.find((asset) => looksLikeArmAsset(asset.name.toLowerCase())) ??
      dmgs.find((asset) => !looksLikeIntelAsset(asset.name.toLowerCase())) ??
      dmgs[0]
    );
  }

  if (platform === "mac_x64") {
    return (
      dmgs.find((asset) => looksLikeIntelAsset(asset.name.toLowerCase())) ??
      dmgs.find((asset) => !looksLikeArmAsset(asset.name.toLowerCase())) ??
      dmgs[0]
    );
  }

  if (platform === "windows_x64") {
    return msis[0] ?? exes[0];
  }

  if (platform === "linux_x64") {
    return appImages[0] ?? debs[0] ?? rpms[0];
  }

  return undefined;
}

