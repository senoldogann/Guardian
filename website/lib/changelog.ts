import type { GithubRelease } from "./github";

export type ReleaseViewModel = {
  id: number;
  tag: string;
  title: string;
  body: string;
  url: string;
  publishedAt: string | null;
  prerelease: boolean;
  highlights: string[];
  sections: ReleaseSection[];
};

export type ReleaseSection = {
  title: string;
  items: string[];
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
  const body = release.body?.trim() || "";
  const { highlights, sections } = parseReleaseNotes(body);
  return {
    id: release.id,
    tag: release.tag_name,
    title: release.name?.trim() || release.tag_name,
    body,
    url: release.html_url,
    publishedAt: release.published_at,
    prerelease: release.prerelease,
    highlights,
    sections
  };
}

function parseReleaseNotes(body: string): { highlights: string[]; sections: ReleaseSection[] } {
  if (!body) return { highlights: [], sections: [] };

  const lines = body.split(/\r?\n/);
  const sections: ReleaseSection[] = [];
  const looseItems: string[] = [];
  let current: ReleaseSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = /^###\s+(.*)$/.exec(line);
    if (headingMatch) {
      current = { title: headingMatch[1].trim(), items: [] };
      sections.push(current);
      continue;
    }

    const bulletMatch = /^[-*+]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      const item = bulletMatch[1].trim();
      if (!item) continue;
      if (current) {
        current.items.push(item);
      } else {
        looseItems.push(item);
      }
    }
  }

  const sectionItems = sections.flatMap((section) => section.items);
  const highlights = [...looseItems, ...sectionItems].slice(0, 3);
  const filteredSections = sections.filter((section) => section.items.length > 0);

  return { highlights, sections: filteredSections };
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
