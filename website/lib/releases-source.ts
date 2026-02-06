import type { GithubRelease } from "./github";
import { getDistributionRepoUrl, getReleases } from "./github";

type ReleaseSnapshot = {
  generated_at?: string;
  repo?: string;
  releases?: GithubRelease[];
};

const SNAPSHOT_REVALIDATE_SECONDS = 60;

function getSnapshotUrl(): string {
  return `${getDistributionRepoUrl()}/releases/latest/download/releases.json`;
}

function isReleaseSnapshot(value: unknown): value is ReleaseSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as ReleaseSnapshot;
  return Array.isArray(snapshot.releases);
}

export async function fetchReleaseSnapshot(limit = 40): Promise<GithubRelease[]> {
  try {
    const response = await fetch(getSnapshotUrl(), {
      next: { revalidate: SNAPSHOT_REVALIDATE_SECONDS }
    });

    if (response.ok) {
      const json = (await response.json()) as unknown;
      if (isReleaseSnapshot(json) && json.releases) {
        return json.releases
          .filter((release) => !release.draft)
          .slice(0, limit);
      }
    }
  } catch {
    // Ignore snapshot failures and fall back to GitHub API.
  }

  return await getReleases(limit);
}

