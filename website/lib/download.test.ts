import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  detectPlatform,
  getPlatformLabel,
  pickBestAsset,
  type Platform,
} from "./download";
import type { GithubAsset } from "./github";

/**
 * Download Helper Tests
 * 
 * Tests platform detection and asset selection:
 * - User agent parsing
 * - Platform label generation
 * - Best asset selection per platform
 * - Edge cases and fallbacks
 */

// Mock assets for testing
const mockAssets: GithubAsset[] = [
  {
    id: 1,
    name: "guardian-1.0.0.dmg",
    browser_download_url: "https://github.com/releases/guardian-1.0.0.dmg",
    size: 50000000,
    updated_at: "2024-01-01T00:00:00Z",
    download_count: 100,
  },
  {
    id: 2,
    name: "guardian-1.0.0.msi",
    browser_download_url: "https://github.com/releases/guardian-1.0.0.msi",
    size: 45000000,
    updated_at: "2024-01-01T00:00:00Z",
    download_count: 150,
  },
  {
    id: 3,
    name: "guardian-1.0.0.exe",
    browser_download_url: "https://github.com/releases/guardian-1.0.0.exe",
    size: 44000000,
    updated_at: "2024-01-01T00:00:00Z",
    download_count: 120,
  },
  {
    id: 4,
    name: "guardian-1.0.0.AppImage",
    browser_download_url: "https://github.com/releases/guardian-1.0.0.AppImage",
    size: 48000000,
    updated_at: "2024-01-01T00:00:00Z",
    download_count: 50,
  },
];

describe("download - Platform Detection", () => {
  beforeEach(() => {
    // Reset navigator mock
    vi.stubGlobal("navigator", {
      userAgent: "",
    });
  });

  it("should detect macOS (Intel default) from user agent", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });

    // Without high entropy values, it might default to arm64 or x64 based on implementation
    // In download.ts: if (os === "mac") return "mac_arm64" (default assumption if arch not detected)
    // Wait, let's check download.ts logic again inside detectPlatform:
    // It calls detectArchitecture(). If it returns 'unknown', it defaults to 'mac_arm64'.
    const platform = await detectPlatform();
    expect(platform).toBe("mac_arm64");
  });

  it("should detect Windows from user agent", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });

    const platform = await detectPlatform();
    expect(platform).toBe("windows_x64");
  });

  it("should detect Linux from user agent", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
    });

    const platform = await detectPlatform();
    expect(platform).toBe("linux_x64");
  });

  it("should return unknown for unrecognized user agent", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Some exotic device",
    });

    const platform = await detectPlatform();
    expect(platform).toBe("unknown");
  });

  it("should handle case insensitive user agent", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (MAC OS X)",
    });

    const platform = await detectPlatform();
    expect(platform).toBe("mac_arm64");
  });
});

describe("download - Platform Labels", () => {
  it("should return correct label for mac_arm64", () => {
    expect(getPlatformLabel("mac_arm64")).toBe("macOS (Apple Silicon)");
  });

  it("should return correct label for mac_x64", () => {
    expect(getPlatformLabel("mac_x64")).toBe("macOS (Intel)");
  });

  it("should return correct label for windows_x64", () => {
    expect(getPlatformLabel("windows_x64")).toBe("Windows");
  });

  it("should return correct label for linux_x64", () => {
    expect(getPlatformLabel("linux_x64")).toBe("Linux");
  });

  it("should return correct label for unknown", () => {
    expect(getPlatformLabel("unknown")).toBe("Unknown");
  });

  it("should handle all platform types", () => {
    const platforms: Platform[] = ["mac_arm64", "mac_x64", "windows_x64", "linux_x64", "unknown"];

    platforms.forEach((platform) => {
      const label = getPlatformLabel(platform);
      expect(typeof label).toBe("string");
    });
  });
});

describe("download - Asset Selection", () => {
  it("should pick DMG for macOS", () => {
    const asset = pickBestAsset(mockAssets, "mac_arm64");

    expect(asset).toBeDefined();
    expect(asset?.name).toContain(".dmg");
  });

  it("should pick MSI for Windows", () => {
    const asset = pickBestAsset(mockAssets, "windows_x64");

    expect(asset).toBeDefined();
    expect(asset?.name).toMatch(/\.(msi|exe)$/);
  });

  it("should prefer MSI over EXE for Windows", () => {
    const asset = pickBestAsset(mockAssets, "windows_x64");

    expect(asset?.name).toContain(".msi");
  });

  it("should pick AppImage for Linux", () => {
    const asset = pickBestAsset(mockAssets, "linux_x64");

    expect(asset).toBeDefined();
    expect(asset?.name).toContain(".AppImage");
  });

  it("should return undefined for unknown platform", () => {
    const asset = pickBestAsset(mockAssets, "unknown");

    expect(asset).toBeUndefined();
  });

  it("should handle empty assets array", () => {
    const asset = pickBestAsset([], "mac_arm64");

    expect(asset).toBeUndefined();
  });

  it("should return undefined if no matching asset", () => {
    const onlyDmg: GithubAsset[] = [mockAssets[0]];

    const asset = pickBestAsset(onlyDmg, "windows_x64");
    expect(asset).toBeUndefined();
  });
});

describe("download - Asset Selection Edge Cases", () => {
  it("should handle asset with similar name but wrong extension", () => {
    const assetsWithSimilar: GithubAsset[] = [
      {
        id: 1,
        name: "guardian-dmg-installer.zip",
        browser_download_url: "https://github.com/releases/guardian.zip",
        size: 1000000,
        updated_at: "2024-01-01T00:00:00Z",
        download_count: 10,
      },
      ...mockAssets,
    ];

    const asset = pickBestAsset(assetsWithSimilar, "mac_arm64");

    // Should pick actual .dmg, not zip with "dmg" in name
    expect(asset?.name).toContain(".dmg");
    expect(asset?.name).not.toContain(".zip");
  });

  it("should handle multiple assets of same type", () => {
    const assetsWithMultiple: GithubAsset[] = [
      {
        id: 1,
        name: "guardian-intel.dmg",
        browser_download_url: "https://github.com/releases/guardian-intel.dmg",
        size: 50000000,
        updated_at: "2024-01-01T00:00:00Z",
        download_count: 100,
      },
      {
        id: 2,
        name: "guardian-arm.dmg",
        browser_download_url: "https://github.com/releases/guardian-arm.dmg",
        size: 48000000,
        updated_at: "2024-01-01T00:00:00Z",
        download_count: 80,
      },
    ];

    // For mac_arm64 priority is arm asset
    const asset = pickBestAsset(assetsWithMultiple, "mac_arm64");

    expect(asset).toBeDefined();
    expect(asset?.name).toContain("arm");
  });

  it("should handle case sensitive extensions", () => {
    const assetsWithUppercase: GithubAsset[] = [
      {
        id: 1,
        name: "guardian-1.0.0.DMG",
        browser_download_url: "https://github.com/releases/guardian.DMG",
        size: 50000000,
        updated_at: "2024-01-01T00:00:00Z",
        download_count: 100,
      },
    ];

    const asset = pickBestAsset(assetsWithUppercase, "mac_arm64");

    // Implementation is now case-insensitive (which is good behavior)
    expect(asset).toBeDefined();
    expect(asset?.name).toContain(".DMG");
  });
});

describe("download - Integration Scenarios", () => {
  it("should complete full download flow for macOS user", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });

    // Detect platform
    const platform = await detectPlatform();
    expect(platform).toBe("mac_arm64");

    // Get label
    const label = getPlatformLabel(platform);
    expect(label).toBe("macOS (Apple Silicon)");

    // Pick asset
    const asset = pickBestAsset(mockAssets, platform);
    expect(asset).toBeDefined();
    expect(asset?.name).toContain(".dmg");
  });

  it("should complete full download flow for Windows user", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });

    const platform = await detectPlatform();
    expect(platform).toBe("windows_x64");

    const label = getPlatformLabel(platform);
    expect(label).toBe("Windows");

    const asset = pickBestAsset(mockAssets, platform);
    expect(asset).toBeDefined();
    expect(asset?.name).toMatch(/\.(msi|exe)$/);
  });

  it("should handle unknown platform gracefully", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Unknown Device",
    });

    const platform = await detectPlatform();
    expect(platform).toBe("unknown");

    const label = getPlatformLabel(platform);
    expect(label).toBe("Unknown");

    const asset = pickBestAsset(mockAssets, platform);
    expect(asset).toBeUndefined();
  });
});

describe("download - Real-world User Agents", () => {
  it("should detect Chrome on macOS", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const platform = await detectPlatform();
    expect(platform).toBe("mac_arm64");
  });

  it("should detect Firefox on Windows", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0",
    });

    const platform = await detectPlatform();
    expect(platform).toBe("windows_x64");
  });

  it("should detect Safari on macOS", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    });

    const platform = await detectPlatform();
    expect(platform).toBe("mac_arm64");
  });

  it("should detect Edge on Windows", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    });

    const platform = await detectPlatform();
    expect(platform).toBe("windows_x64");
  });

  it("should detect Chrome on Linux", async () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const platform = await detectPlatform();
    expect(platform).toBe("linux_x64");
  });
});
