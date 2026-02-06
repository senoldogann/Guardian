import type { GithubAsset } from "./github";

export type Platform = "windows" | "mac-arm" | "mac-intel" | "linux" | "unknown";

type NavigatorUADataLike = {
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, string>>;
};

function isMacUserAgent(userAgent: string): boolean {
  return userAgent.toLowerCase().includes("mac os");
}

function detectMacArchitectureFromWebGL(): Platform | null {
  if (typeof document === "undefined") return null;

  try {
    const canvas = document.createElement("canvas");
    const context =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!context) return null;

    const debugInfo = context.getExtension("WEBGL_debug_renderer_info") as
      | { UNMASKED_RENDERER_WEBGL: number }
      | null;
    if (!debugInfo) return null;

    const renderer = String(context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? "").toLowerCase();
    if (!renderer) return null;

    if (renderer.includes("apple m") || renderer.includes("arm") || renderer.includes("aarch64")) {
      return "mac-arm";
    }

    if (renderer.includes("intel") || renderer.includes("amd") || renderer.includes("radeon") || renderer.includes("nvidia")) {
      return "mac-intel";
    }

    return null;
  } catch {
    return null;
  }
}

export function detectPlatformFromUserAgent(userAgent: string): Platform {
  const ua = userAgent.toLowerCase();
  const isMac = isMacUserAgent(ua);
  const isWindows = ua.includes("win");
  const isLinux = ua.includes("linux");
  const isArm = ua.includes("arm64") || ua.includes("aarch64");
  const isIntel = ua.includes("intel") || ua.includes("x86_64") || ua.includes("x64");

  if (isWindows) return "windows";
  if (isMac && isArm) return "mac-arm";
  // Safari on Apple Silicon can report "Intel", so avoid false positives.
  if (isMac && isIntel) return "unknown";
  if (isMac) return "unknown";
  if (isLinux) return "linux";
  return "unknown";
}

async function detectPlatformFromUserAgentData(): Promise<Platform | null> {
  if (typeof navigator === "undefined") {
    return null;
  }

  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUADataLike }).userAgentData;
  if (!uaData) return null;

  const platform = (uaData.platform ?? "").toLowerCase();
  if (platform.includes("win")) return "windows";
  if (platform.includes("linux")) return "linux";
  if (!platform.includes("mac")) return null;

  if (typeof uaData.getHighEntropyValues === "function") {
    try {
      const entropy = await uaData.getHighEntropyValues(["architecture", "model"]);
      const architecture = (entropy.architecture ?? "").toLowerCase();
      const model = (entropy.model ?? "").toLowerCase();

      if (architecture.includes("arm") || architecture.includes("aarch64")) {
        return "mac-arm";
      }
      if (architecture.includes("x86")) {
        return "mac-intel";
      }
      if (model.includes("apple") && (model.includes("m1") || model.includes("m2") || model.includes("m3") || model.includes("m4"))) {
        return "mac-arm";
      }
    } catch {
      // Ignore and continue with other heuristics.
    }
  }

  return null;
}

export async function detectPlatform(): Promise<Platform> {
  const fromUaData = await detectPlatformFromUserAgentData();
  if (fromUaData) return fromUaData;

  if (typeof navigator === "undefined") {
    return "unknown";
  }

  const fromUa = detectPlatformFromUserAgent(navigator.userAgent);
  if (fromUa === "mac-arm" || fromUa === "mac-intel") {
    const fromRenderer = detectMacArchitectureFromWebGL();
    if (fromRenderer) return fromRenderer;
    return fromUa;
  }

  if (fromUa === "unknown" && isMacUserAgent(navigator.userAgent)) {
    const fromRenderer = detectMacArchitectureFromWebGL();
    // If we cannot reliably detect architecture, default to Apple Silicon. Intel users can switch.
    if (fromRenderer) return fromRenderer;
    return "mac-arm";
  }

  return fromUa;
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
      match([(n) => (n.includes("aarch64") || n.includes("arm64")), (n) => n.endsWith(".dmg")]) ||
      match([(n) => (n.includes("aarch64") || n.includes("arm64"))]) ||
      match([(n) => n.endsWith(".dmg"), (n) => !n.includes("x64"), (n) => !n.includes("x86_64")]) ||
      null
    );
  }

  if (platform === "mac-intel") {
    return (
      match([(n) => (n.includes("x86_64") || n.includes("x64") || n.includes("intel")), (n) => n.endsWith(".dmg")]) ||
      match([(n) => (n.includes("x86_64") || n.includes("x64") || n.includes("intel"))]) ||
      match([(n) => n.endsWith(".dmg"), (n) => !n.includes("aarch64"), (n) => !n.includes("arm64")]) ||
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

  return null;
}

export function humanPlatform(platform: Platform): string {
  return getPlatformLabel(platform);
}

export function getPlatformLabel(platform: Platform): string {
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
