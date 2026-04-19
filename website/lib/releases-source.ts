import type { GithubRelease } from "./github";
import { getReleases } from "./github";

type ReleaseSnapshot = {
  generated_at?: string;
  repo?: string;
  releases?: GithubRelease[];
};

const FALLBACK_TTL_MS = 60 * 1000;
const SNAPSHOT_URL = "https://github.com/senoldogann/guardian-distribution/releases/latest/download/releases.json";
const CACHE_RELEASE_LIMIT = 60;
let fallbackCache: { expiresAt: number; releases: GithubRelease[] } | null = null;

function getSnapshotUrl(): string {
  return SNAPSHOT_URL;
}

function isReleaseSnapshot(value: unknown): value is ReleaseSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as ReleaseSnapshot;
  return Array.isArray(snapshot.releases);
}

function isSnapshotUsable(releases: GithubRelease[]): boolean {
  if (releases.length === 0) return false;
  const suspiciousBody = releases.some((release) => {
    const body = release.body?.trim() || "";
    return body.startsWith("@/") || body.includes("/Users/");
  });
  return !suspiciousBody;
}

export async function fetchReleaseSnapshot(limit = 40): Promise<GithubRelease[]> {
  const desiredLimit = Math.max(limit, CACHE_RELEASE_LIMIT);

  // Prefer the public snapshot file first to avoid GitHub API rate limits on client traffic.
  try {
    const response = await fetch(getSnapshotUrl(), {
      cache: "no-store"
    });

    if (response.ok) {
      const json = (await response.json()) as unknown;
      if (isReleaseSnapshot(json) && json.releases) {
        const releases = json.releases
          .filter((release) => !release.draft)
          .slice(0, desiredLimit);
        if (isSnapshotUsable(releases)) {
          fallbackCache = {
            expiresAt: Date.now() + FALLBACK_TTL_MS,
            releases,
          };
          return releases.slice(0, limit);
        }
      }
    }
  } catch {
    // Ignore snapshot failures and fall back to GitHub API.
  }

  const releases = await getReleases(desiredLimit);
  if (isSnapshotUsable(releases)) {
    fallbackCache = {
      expiresAt: Date.now() + FALLBACK_TTL_MS,
      releases,
    };
    return releases.slice(0, limit);
  }

  if (fallbackCache && fallbackCache.expiresAt > Date.now()) {
    return fallbackCache.releases.slice(0, limit);
  }

  return releases.slice(0, limit);
}
