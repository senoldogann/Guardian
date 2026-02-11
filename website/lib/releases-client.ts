"use client";

import type { GithubAsset } from "./github";

export type LatestReleaseClientPayload = {
  tag: string;
  version?: string;
  publishedAt: string | null;
  notes: string | null;
  htmlUrl: string;
  assets: GithubAsset[];
};

export function releaseTagToVersionClient(tag: string): string {
  return tag.replace(/^v/i, "");
}

const CACHE_TTL_MS = 15_000;

let cacheValue: LatestReleaseClientPayload | null = null;
let cacheAt = 0;
let inFlight: Promise<LatestReleaseClientPayload | null> | null = null;

export async function getLatestReleaseClient(): Promise<LatestReleaseClientPayload | null> {
  const now = Date.now();
  if (cacheValue && now - cacheAt < CACHE_TTL_MS) {
    return cacheValue;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = fetch("/api/releases/latest", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }
      const payload = (await response.json()) as LatestReleaseClientPayload;
      if (!payload?.tag || !Array.isArray(payload.assets)) {
        return null;
      }
      cacheValue = payload;
      cacheAt = Date.now();
      return payload;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
