import type { GithubRelease } from "./github";
import { getReleases } from "./github";

type ReleaseSnapshot = {
  generated_at?: string;
  repo?: string;
  releases?: GithubRelease[];
};

const SNAPSHOT_REVALIDATE_SECONDS = 60;
const FALLBACK_TTL_MS = 5 * 60 * 1000;
const SNAPSHOT_URL = "https://github.com/senoldogann/guardian-distribution/releases/latest/download/releases.json";
const SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
let fallbackCache: { expiresAt: number; releases: GithubRelease[] } | null = null;

function getSnapshotUrl(): string {
  return SNAPSHOT_URL;
}

function isReleaseSnapshot(value: unknown): value is ReleaseSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as ReleaseSnapshot;
  return Array.isArray(snapshot.releases);
}

function isSnapshotFresh(snapshot: ReleaseSnapshot): boolean {
  if (!snapshot.generated_at) return false;
  const parsed = Date.parse(snapshot.generated_at);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed < SNAPSHOT_MAX_AGE_MS;
}

function isSnapshotUsable(releases: GithubRelease[]): boolean {
  if (releases.length === 0) return false;
  const suspiciousBody = releases.some((release) => {
    const body = release.body?.trim() || "";
    return body.startsWith("@/") || body.includes("/Users/") || body.includes("CHANGELOG.md");
  });
  return !suspiciousBody;
}

export async function fetchReleaseSnapshot(limit = 40): Promise<GithubRelease[]> {
  if (fallbackCache && fallbackCache.expiresAt > Date.now()) {
    return fallbackCache.releases.slice(0, limit);
  }
  try {
    const response = await fetch(getSnapshotUrl(), {
      next: { revalidate: SNAPSHOT_REVALIDATE_SECONDS }
    });

    if (response.ok) {
      const json = (await response.json()) as unknown;
      if (isReleaseSnapshot(json) && json.releases) {
        if (!isSnapshotFresh(json)) {
          throw new Error("Release snapshot is stale");
        }
        const releases = json.releases
          .filter((release) => !release.draft)
          .slice(0, limit);
        if (isSnapshotUsable(releases)) {
          fallbackCache = {
            expiresAt: Date.now() + FALLBACK_TTL_MS,
            releases,
          };
          return releases;
        }
      }
    }
  } catch {
    // Ignore snapshot failures and fall back to GitHub API.
  }

  const releases = await getReleases(limit);
  if (isSnapshotUsable(releases)) {
    fallbackCache = {
      expiresAt: Date.now() + FALLBACK_TTL_MS,
      releases,
    };
  }
  return releases;
}
