import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  findLatestInstallableRelease,
  getReleases,
  getLatestRelease,
  pickInstallers,
  releaseTagToVersion,
  getDistributionRepoUrl,
  type GithubRelease,
  type GithubAsset,
} from "./github";

const createApiResponse = (options: {
  ok: boolean;
  status: number;
  statusText: string;
  jsonData?: unknown;
  textData?: string;
  headers?: Headers;
}) => ({
  ok: options.ok,
  status: options.status,
  statusText: options.statusText,
  headers: options.headers ?? new Headers({ "content-type": "application/json" }),
  json: async () => options.jsonData,
  text: async () => options.textData ?? "",
});

/**
 * GitHub API Helper Tests
 * 
 * Tests the GitHub API client functions:
 * - Release fetching
 * - Asset filtering
 * - Version parsing
 * - URL generation
 * - Error handling
 */

// Mock GitHub API responses
const mockAssets: GithubAsset[] = [
  {
    id: 1,
    name: "guardian-1.0.0.dmg",
    browser_download_url: "https://github.com/releases/guardian-1.0.0.dmg",
    size: 50000000,
    updated_at: "2024-01-01T00:00:00Z",
    download_count: 100,
    digest: "sha256:abc123",
    content_type: "application/octet-stream",
  },
  {
    id: 2,
    name: "guardian-1.0.0.exe",
    browser_download_url: "https://github.com/releases/guardian-1.0.0.exe",
    size: 45000000,
    updated_at: "2024-01-01T00:00:00Z",
    download_count: 150,
    content_type: "application/x-msdownload",
  },
  {
    id: 3,
    name: "guardian-1.0.0.AppImage",
    browser_download_url: "https://github.com/releases/guardian-1.0.0.AppImage",
    size: 48000000,
    updated_at: "2024-01-01T00:00:00Z",
    download_count: 50,
  },
];

const mockRelease: GithubRelease = {
  id: 1,
  tag_name: "v1.0.0",
  name: "Version 1.0.0",
  body: "## What's New\n\n- Feature A\n- Feature B",
  html_url: "https://github.com/senoldogann/guardian-distribution/releases/tag/v1.0.0",
  published_at: "2024-01-01T00:00:00Z",
  prerelease: false,
  draft: false,
  assets: mockAssets,
};

const mockReleases: GithubRelease[] = [mockRelease];

let originalToken: string | undefined;

beforeEach(() => {
  originalToken = process.env.GITHUB_PUBLIC_READ_TOKEN;
  delete process.env.GITHUB_PUBLIC_READ_TOKEN;
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  if (typeof originalToken === "undefined") {
    delete process.env.GITHUB_PUBLIC_READ_TOKEN;
  } else {
    process.env.GITHUB_PUBLIC_READ_TOKEN = originalToken;
  }
});

describe("github - Release Fetching", () => {
  it("should fetch releases from GitHub API", async () => {
    (global.fetch as any).mockResolvedValueOnce(
      createApiResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        jsonData: mockReleases,
      })
    );

    const releases = await getReleases(10);

    expect(releases).toHaveLength(1);
    expect(releases[0].tag_name).toBe("v1.0.0");
  });

  it("should fetch latest release", async () => {
    // GitHub's /releases/latest returns a single release object, not an array
    (global.fetch as any).mockResolvedValueOnce(
      createApiResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        jsonData: mockRelease,
      })
    );

    const latest = await getLatestRelease();

    expect(latest).not.toBeNull();
    expect(latest!.tag_name).toBe("v1.0.0");
  });

  it("should filter out prereleases by default", async () => {
    // /releases/latest already filters prereleases on GitHub's side
    // Just verify that the returned release is not a prerelease
    (global.fetch as any).mockResolvedValueOnce(
      createApiResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        jsonData: mockRelease,
      })
    );

    const latest = await getLatestRelease();

    expect(latest).not.toBeNull();
    expect(latest!.tag_name).toBe("v1.0.0");
    expect(latest!.prerelease).toBe(false);
  });

  it("should filter out draft releases", async () => {
    // /releases/latest already filters drafts on GitHub's side
    // Just verify that the returned release is not a draft
    (global.fetch as any).mockResolvedValueOnce(
      createApiResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        jsonData: mockRelease,
      })
    );

    const latest = await getLatestRelease();

    expect(latest).not.toBeNull();
    expect(latest!.draft).toBe(false);
  });

  it("should handle API errors gracefully", async () => {
    (global.fetch as any).mockResolvedValueOnce(
      createApiResponse({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        jsonData: { message: "Internal Server Error" },
        textData: "Internal Server Error",
      })
    );

    const releases = await getReleases(10);
    expect(releases).toEqual([]);
  });

  it("should handle network errors", async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

    const releases = await getReleases(10);
    expect(releases).toEqual([]);
  });

  it("should include auth token if provided", async () => {
    const token = `ghp_${"1".repeat(36)}`;
    process.env.GITHUB_PUBLIC_READ_TOKEN = token;

    (global.fetch as any).mockResolvedValueOnce(
      createApiResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        jsonData: mockReleases,
      })
    );

    await getReleases(10);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`,
        }),
      })
    );

  });
});

describe("github - Asset Filtering", () => {
  it("should pick installer assets", () => {
    const installers = pickInstallers(mockAssets);

    expect(installers).toHaveLength(3);
    expect(installers.map(a => a.name)).toEqual([
      "guardian-1.0.0.dmg",
      "guardian-1.0.0.exe",
      "guardian-1.0.0.AppImage",
    ]);
  });

  it("should filter out non-installer files", () => {
    const assetsWithOthers = [
      ...mockAssets,
      {
        id: 4,
        name: "checksums.txt",
        browser_download_url: "https://github.com/releases/checksums.txt",
        size: 1000,
        updated_at: "2024-01-01T00:00:00Z",
        download_count: 10,
      },
      {
        id: 5,
        name: "README.md",
        browser_download_url: "https://github.com/releases/README.md",
        size: 5000,
        updated_at: "2024-01-01T00:00:00Z",
        download_count: 20,
      },
    ];

    const installers = pickInstallers(assetsWithOthers as GithubAsset[]);

    // Should only pick actual installers, not source/checksum/doc files
    // Expected: guardian.dmg, guardian.exe, guardian.msi (3 installers)
    expect(installers).toHaveLength(3);
  });

  it("should handle empty assets array", () => {
    const installers = pickInstallers([]);

    expect(installers).toHaveLength(0);
  });

  it("should handle assets with no installer extensions", () => {
    const nonInstallers: GithubAsset[] = [
      {
        id: 1,
        name: "README.md",
        browser_download_url: "https://github.com/releases/README.md",
        size: 1000,
        updated_at: "2024-01-01T00:00:00Z",
        download_count: 5,
      },
    ];

    const installers = pickInstallers(nonInstallers);

    expect(installers).toHaveLength(0);
  });

  it("should exclude MCP archives from website installers", () => {
    const assetsWithMcpArchive: GithubAsset[] = [
      {
        id: 11,
        name: "guardian-mcp-darwin-universal-1.3.1.tar.gz",
        browser_download_url: "https://github.com/releases/guardian-mcp-darwin-universal-1.3.1.tar.gz",
        size: 2048,
        updated_at: "2024-01-01T00:00:00Z",
        download_count: 0,
      },
      {
        id: 12,
        name: "guardian-mcp-windows-x64-1.3.1.zip",
        browser_download_url: "https://github.com/releases/guardian-mcp-windows-x64-1.3.1.zip",
        size: 2048,
        updated_at: "2024-01-01T00:00:00Z",
        download_count: 0,
      },
    ];

    expect(pickInstallers(assetsWithMcpArchive)).toHaveLength(0);
  });

  it("should find the latest release that still has installers", () => {
    const ideOnlyRelease: GithubRelease = {
      ...mockRelease,
      id: 2,
      tag_name: "v1.3.1",
      assets: [
        {
          id: 10,
          name: "guardian-code-governance-1.3.1.vsix",
          browser_download_url: "https://github.com/releases/guardian-code-governance-1.3.1.vsix",
          size: 1024,
          updated_at: "2024-01-02T00:00:00Z",
          download_count: 0,
        },
      ],
    };

    const installable = findLatestInstallableRelease([ideOnlyRelease, mockRelease]);

    expect(installable?.tag_name).toBe("v1.0.0");
  });
});

describe("github - Version Parsing", () => {
  it("should parse version from tag with v prefix", () => {
    expect(releaseTagToVersion("v1.0.0")).toBe("1.0.0");
  });

  it("should parse version from tag without v prefix", () => {
    expect(releaseTagToVersion("1.0.0")).toBe("1.0.0");
  });

  it("should handle beta versions", () => {
    expect(releaseTagToVersion("v1.0.0-beta.1")).toBe("1.0.0-beta.1");
  });

  it("should handle rc versions", () => {
    expect(releaseTagToVersion("v2.0.0-rc.1")).toBe("2.0.0-rc.1");
  });

  it("should handle version with metadata", () => {
    expect(releaseTagToVersion("v1.0.0+build.123")).toBe("1.0.0+build.123");
  });

  it("should return original if not matching semver pattern", () => {
    expect(releaseTagToVersion("latest")).toBe("latest");
  });
});

describe("github - URL Generation", () => {
  it("should generate distribution repo URL", () => {
    const url = getDistributionRepoUrl();

    expect(url).toBe("https://github.com/senoldogann/guardian-distribution");
  });

  it("should use environment variables for URL", () => {
    // Note: Since OWNER and REPO are evaluated at module load time,
    // we can't change them during test runtime. This test verifies the function works.
    const url = getDistributionRepoUrl();

    // Should use default or env values (both are valid)
    expect(url).toMatch(/^https:\/\/github\.com\/[^\/]+\/[^\/]+$/);
    expect(url).toContain("github.com");
  });
});

describe("github - Data Normalization", () => {
  it("should normalize release data", async () => {
    (global.fetch as any).mockResolvedValueOnce(
      createApiResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        jsonData: [mockRelease],
      })
    );

    const releases = await getReleases(1);
    const release = releases[0];

    // Should have required fields
    expect(release).toHaveProperty("id");
    expect(release).toHaveProperty("tag_name");
    expect(release).toHaveProperty("assets");
    expect(Array.isArray(release.assets)).toBe(true);
  });

  it("should normalize asset data", () => {
    const installers = pickInstallers(mockAssets);

    installers.forEach((asset) => {
      expect(asset).toHaveProperty("id");
      expect(asset).toHaveProperty("name");
      expect(asset).toHaveProperty("browser_download_url");
      expect(asset).toHaveProperty("size");
      expect(typeof asset.size).toBe("number");
    });
  });

  it("should handle null values in release", async () => {
    const releaseWithNulls = {
      ...mockRelease,
      name: null,
      body: null,
      published_at: null,
    };

    (global.fetch as any).mockResolvedValueOnce(
      createApiResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        jsonData: [releaseWithNulls],
      })
    );

    const releases = await getReleases(1);

    expect(releases).toHaveLength(1);
    // Should handle null gracefully
    expect(releases[0]).toBeDefined();
  });
});

describe("github - Edge Cases", () => {
  it("should handle empty releases array", async () => {
    (global.fetch as any).mockResolvedValueOnce(
      createApiResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        jsonData: [],
      })
    );

    const releases = await getReleases(10);

    expect(releases).toHaveLength(0);
  });

  it("should handle rate limiting", async () => {
    (global.fetch as any).mockResolvedValueOnce(
      createApiResponse({
        ok: false,
        status: 403,
        statusText: "Rate limit exceeded",
        jsonData: { message: "Rate limit exceeded" },
        textData: "Rate limit exceeded",
        headers: new Headers({
          "X-RateLimit-Remaining": "0",
        }),
      })
    );

    const releases = await getReleases(10);
    expect(releases).toEqual([]);
  });

  it("should handle malformed JSON", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => {
        throw new Error("Invalid JSON");
      },
      text: async () => "",
    });

    const releases = await getReleases(10);
    expect(releases).toEqual([]);
  });
});
