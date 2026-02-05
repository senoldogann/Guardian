export type GithubAsset = {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
  updated_at: string;
  download_count: number;
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

const OWNER = process.env.GITHUB_RELEASE_OWNER ?? "senoldogann";
const REPO = process.env.GITHUB_RELEASE_REPO ?? "guardian-distribution";
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;
const DEFAULT_REVALIDATE_SECONDS = 300;

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

export async function getLatestRelease(): Promise<GithubRelease> {
  return githubFetch<GithubRelease>("/releases/latest");
}

export async function getReleases(limit = 20): Promise<GithubRelease[]> {
  return githubFetch<GithubRelease[]>(`/releases?per_page=${limit}`);
}

export function getDistributionRepoUrl(): string {
  return `https://github.com/${OWNER}/${REPO}`;
}

export function pickInstallers(assets: GithubAsset[]): GithubAsset[] {
  return assets.filter((asset) => {
    const lower = asset.name.toLowerCase();
    if (lower.endsWith(".sig") || lower.endsWith("latest.json") || lower.endsWith(".json")) {
      return false;
    }
    return (
      lower.endsWith(".dmg") ||
      lower.endsWith(".msi") ||
      lower.endsWith(".exe") ||
      lower.endsWith(".appimage") ||
      lower.endsWith(".deb") ||
      lower.endsWith(".rpm") ||
      lower.endsWith(".zip")
    );
  });
}
