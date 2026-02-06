import type { GithubRelease } from "./github";

export type ReleaseViewModel = {
  id: number;
  tag: string;
  title: string;
  body: string;
  url: string;
  publishedAt: string | null;
  prerelease: boolean;
};

export type ReleaseMonthGroup = {
  key: string;
  label: string;
  releases: ReleaseViewModel[];
};

function formatMonthLabel(value: string, locale: string): string {
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(locale, {
    month: "long",
    year: "numeric"
  });
}

export function toReleaseViewModel(release: GithubRelease): ReleaseViewModel {
  return {
    id: release.id,
    tag: release.tag_name,
    title: release.name?.trim() || release.tag_name,
    body: release.body?.trim() || "",
    url: release.html_url,
    publishedAt: release.published_at,
    prerelease: release.prerelease
  };
}

export function groupReleasesByMonth(releases: ReleaseViewModel[], locale: string): ReleaseMonthGroup[] {
  const byMonth = new Map<string, ReleaseViewModel[]>();
  const unknownLabel = locale.toLowerCase().startsWith("tr") ? "Bilinmiyor" : "Unknown";

  for (const release of releases) {
    const monthKey = release.publishedAt ? release.publishedAt.slice(0, 7) : "unknown";
    const current = byMonth.get(monthKey) ?? [];
    current.push(release);
    byMonth.set(monthKey, current);
  }

  const groups = Array.from(byMonth.entries()).map(([key, values]) => ({
    key,
    label: key === "unknown" ? unknownLabel : formatMonthLabel(key, locale),
    releases: values.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
  }));

  return groups.sort((a, b) => b.key.localeCompare(a.key));
}

export function formatReleaseDate(value: string | null, locale: string): string {
  if (!value) return locale.toLowerCase().startsWith("tr") ? "Bilinmiyor" : "Unknown";
  return new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}
