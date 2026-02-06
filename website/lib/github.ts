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
const DEFAULT_REVALIDATE_SECONDS = 60;
const INSTALLER_EXTENSIONS = [".dmg", ".msi", ".exe", ".appimage", ".deb", ".rpm", ".zip", ".tar.gz"] as const;

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

async function githubFetch<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_PUBLIC_READ_TOKEN;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    next: { revalidate: DEFAULT_REVALIDATE_SECONDS }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
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
    return INSTALLER_EXTENSIONS.some((ext) => lower.endsWith(ext));
  });
}

export async function getLatestRelease(): Promise<GithubRelease> {
  const latest = await githubFetch<GithubRelease>("/releases/latest");
  return normalizeRelease(latest);
}

export async function getReleases(limit = 20): Promise<GithubRelease[]> {
  const releases = await githubFetch<GithubRelease[]>(`/releases?per_page=${limit}`);
  return releases.filter((release) => !release.draft).map(normalizeRelease);
}
