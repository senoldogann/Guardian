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
  const { highlights, sections, sanitizedBody } = parseReleaseNotes(body);
  const isInitialRelease = /^v?1\.0\.0$/i.test(release.tag_name.trim());
  return {
    id: release.id,
    tag: release.tag_name,
    title: release.name?.trim() || release.tag_name,
    body: isInitialRelease ? "" : sanitizedBody,
    url: release.html_url,
    publishedAt: release.published_at,
    prerelease: release.prerelease,
    highlights: isInitialRelease ? [] : highlights,
    sections: isInitialRelease ? [] : sections
  };
}

const INTERNAL_RELEASE_PATTERNS: RegExp[] = [
  /\bci\/cd\b/i,
  /\bcicd\b/i,
  /\bci\b/i,
  /\bgithub\s*actions?\b/i,
  /\bactions\s+minutes\b/i,
  /\bself[-\s]?hosted\b/i,
  /\brunner(s)?\b/i,
  /\bpipeline\b/i,
  /\bworkflow(s)?\b/i,
  /\bdevops\b/i,
  /\binfra(structure)?\b/i,
  /\bautomation\b/i,
  /\bscript(s)?\b/i,
  /scripts\/[\w.-]+/i,
  /\bsetup[-_ ]?runner\b/i,
  /\bchore(s)?\b/i,
  /\brefactor(ing)?\b/i,
  /\blint(ing)?\b/i,
  /\btest(s|ing)?\b/i,
  /\bcoverage\b/i,
  /\bdependabot\b/i,
  /\bdeps\b/i
  ];

function isInternalReleaseNote(value: string): boolean {
  return INTERNAL_RELEASE_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeInlineMarkdown(value: string): string {
  // The changelog UI renders list items as plain text, so strip common inline
  // markdown emphasis markers to avoid showing raw `**...**` in the UI.
  return value.replace(/\*\*/g, "").trim();
}

function normalizeMarkdownLines(lines: string[]): string {
  const trimmed = lines.map((line) => line.trimEnd());
  const normalized: string[] = [];
  for (const line of trimmed) {
    if (!line.trim()) {
      if (normalized.length === 0) continue;
      if (!normalized[normalized.length - 1].trim()) continue;
      normalized.push("");
      continue;
    }
    normalized.push(line);
  }
  while (normalized.length > 0 && !normalized[normalized.length - 1].trim()) {
    normalized.pop();
  }
  return normalized.join("\n").trim();
}

function parseReleaseNotes(body: string): { highlights: string[]; sections: ReleaseSection[]; sanitizedBody: string } {
  if (!body) return { highlights: [], sections: [], sanitizedBody: "" };

  const lines = body.split(/\r?\n/);
  const sections: ReleaseSection[] = [];
  const looseItems: string[] = [];
  const sanitizedLines: string[] = [];
  let current: ReleaseSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      sanitizedLines.push("");
      continue;
    }

    const headingMatch = /^###\s+(.*)$/.exec(line);
    if (headingMatch) {
      const title = normalizeInlineMarkdown(headingMatch[1].trim());
      const safeTitle = isInternalReleaseNote(title) ? "" : title;
      current = { title: safeTitle, items: [] };
      sections.push(current);
      if (!isInternalReleaseNote(title)) {
        sanitizedLines.push(rawLine);
      }
      continue;
    }

    const bulletMatch = /^[-*+]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      const item = normalizeInlineMarkdown(bulletMatch[1].trim());
      if (!item) continue;
      if (!isInternalReleaseNote(item)) {
        if (current) {
          current.items.push(item);
        } else {
          looseItems.push(item);
        }
        sanitizedLines.push(rawLine);
      }
      continue;
    }

    if (!isInternalReleaseNote(line)) {
      sanitizedLines.push(rawLine);
    }
  }

  const highlightSection = sections.find((section) => section.title.trim().toLowerCase() === "highlights") ?? null;
  const highlightItems = highlightSection?.items ?? [];
  const otherSections = highlightSection ? sections.filter((section) => section !== highlightSection) : sections;

  const sectionItems = otherSections.flatMap((section) => section.items);
  const highlightsSource = highlightItems.length > 0 ? highlightItems : [...looseItems, ...sectionItems];
  const highlights = Array.from(new Set(highlightsSource)).slice(0, 3);

  const filteredSections = otherSections.filter((section) => section.items.length > 0);
  const sanitizedBody = normalizeMarkdownLines(sanitizedLines);

  return { highlights, sections: filteredSections, sanitizedBody };
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
