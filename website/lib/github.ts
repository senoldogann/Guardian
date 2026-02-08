export type GithubAsset = {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
  updated_at: string;
  download_count: number;
  digest?: string;
  content_type?: string;
};

export type GithubRelease = {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
  assets: GithubAsset[];
};

export type AssetKind = "dmg" | "msi" | "exe" | "appimage" | "deb" | "rpm" | "tar" | "zip" | "other";

const OWNER = process.env.GITHUB_RELEASE_OWNER ?? "senoldogann";
const REPO = process.env.GITHUB_RELEASE_REPO ?? "guardian-distribution";
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;
const DEFAULT_REVALIDATE_SECONDS = 3600; // 1 hour
const INSTALLER_EXTENSIONS = [".dmg", ".msi", ".exe", ".appimage", ".deb", ".rpm", ".zip", ".tar.gz"] as const;

// Import token security modules (will be available at runtime)
let tokenAudit: typeof import("./token-audit") | null = null;
let tokenValidator: typeof import("./token-validator") | null = null;

// Lazy load modules to avoid circular dependencies
async function loadTokenModules() {
  if (!tokenAudit) {
    tokenAudit = await import("./token-audit");
  }
  if (!tokenValidator) {
    tokenValidator = await import("./token-validator");
  }
}

function normalizeAsset(asset: GithubAsset): GithubAsset {
  return {
    id: asset.id,
    name: asset.name,
    browser_download_url: asset.browser_download_url,
    size: asset.size,
    updated_at: asset.updated_at,
    download_count: asset.download_count,
    digest: asset.digest,
    content_type: asset.content_type
  };
}

function normalizeRelease(release: GithubRelease): GithubRelease {
  return {
    id: release.id,
    tag_name: release.tag_name,
    name: release.name,
    body: release.body ?? "",
    html_url: release.html_url,
    published_at: release.published_at,
    prerelease: release.prerelease,
    draft: release.draft,
    assets: (release.assets ?? []).map(normalizeAsset)
  };
}

async function githubFetch<T>(path: string): Promise<T | null> {
  const token = process.env.GITHUB_PUBLIC_READ_TOKEN;
  const startTime = Date.now();
  
  // Load token security modules
  await loadTokenModules();
  
  // Validate token if present
  if (token && tokenValidator) {
    const isValidFormat = tokenValidator.quickValidateToken(token);
    if (!isValidFormat) {
      console.error("[GitHub API] Token format validation failed");
      tokenAudit?.logValidationFailure("invalid_format", path);
      return null;
    }
  }
  
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      next: { revalidate: DEFAULT_REVALIDATE_SECONDS }
    });

    const duration = Date.now() - startTime;
    
    // Get rate limit info from headers
    const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
    const rateLimitReset = response.headers.get("X-RateLimit-Reset");
    
    if (!response.ok) {
      // Rate limit handling - return null instead of throwing
      if (response.status === 403 || response.status === 429) {
        console.warn(`GitHub API rate limited (${response.status}). Using fallback.`);
        
        // Log rate limit event
        if (tokenAudit && rateLimitRemaining && rateLimitReset) {
          tokenAudit.logRateLimit(
            parseInt(response.headers.get("X-RateLimit-Limit") || "60"),
            parseInt(rateLimitRemaining),
            new Date(parseInt(rateLimitReset) * 1000).toISOString(),
            path
          );
        }
        
        return null;
      }
      
      // Log failed request
      if (tokenAudit) {
        tokenAudit.logTokenUsage(
          path,
          "GET",
          false,
          duration,
          rateLimitRemaining ? {
            remaining: parseInt(rateLimitRemaining),
            reset: new Date(parseInt(rateLimitReset || "0") * 1000).toISOString()
          } : undefined
        );
      }
      
      const text = await response.text();
      throw new Error(`GitHub API failed (${response.status}): ${text}`);
    }

    // Log successful request
    if (tokenAudit) {
      tokenAudit.logTokenUsage(
        path,
        "GET",
        true,
        duration,
        rateLimitRemaining ? {
          remaining: parseInt(rateLimitRemaining),
          reset: new Date(parseInt(rateLimitReset || "0") * 1000).toISOString()
        } : undefined
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("GitHub fetch error:", error);
    
    // Log error
    if (tokenAudit) {
      tokenAudit.logTokenUsage(
        path,
        "GET",
        false,
        Date.now() - startTime
      );
    }
    
    return null;
  }
}

export function getDistributionRepoUrl(): string {
  return `https://github.com/${OWNER}/${REPO}`;
}

export function getDistributionApiUrl(): string {
  return API_BASE;
}

export function releaseTagToVersion(tag: string): string {
  return tag.replace(/^v/i, "");
}

export function getAssetKind(name: string): AssetKind {
  const lower = name.toLowerCase();
  if (lower.endsWith(".dmg")) return "dmg";
  if (lower.endsWith(".msi")) return "msi";
  if (lower.endsWith(".exe")) return "exe";
  if (lower.endsWith(".appimage")) return "appimage";
  if (lower.endsWith(".deb")) return "deb";
  if (lower.endsWith(".rpm")) return "rpm";
  if (lower.endsWith(".tar.gz")) return "tar";
  if (lower.endsWith(".zip")) return "zip";
  return "other";
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"] as const;
  let current = value;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current.toFixed(current >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function pickInstallers(assets: GithubAsset[]): GithubAsset[] {
  return assets.filter((asset) => {
    const lower = asset.name.toLowerCase();
    if (lower.endsWith(".sig") || lower.endsWith("latest.json") || lower.endsWith(".json")) {
      return false;
    }
    if (lower.endsWith(".app.tar.gz")) {
      return false;
    }
    return INSTALLER_EXTENSIONS.some((ext) => lower.endsWith(ext));
  });
}

export async function getLatestRelease(): Promise<GithubRelease | null> {
  const latest = await githubFetch<GithubRelease>("/releases/latest");
  if (!latest) return null;
  return normalizeRelease(latest);
}

export async function getReleases(limit = 20): Promise<GithubRelease[]> {
  const releases = await githubFetch<GithubRelease[]>(`/releases?per_page=${limit}`);
  if (!releases) return [];
  return releases.filter((release) => !release.draft).map(normalizeRelease);
}

// Export token security utilities for external use
export { loadTokenModules };