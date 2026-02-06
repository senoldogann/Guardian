"use client";

import { useMemo, useState } from "react";
import type { ReleaseMonthGroup, ReleaseViewModel } from "../../lib/changelog";
import type { DocLocale, SiteDictionary } from "../../lib/i18n";
import { formatReleaseDate } from "../../lib/changelog";
import { MarkdownBlock } from "../markdown-block";

type Filter = "all" | "stable" | "prerelease";

type Props = {
  locale: DocLocale;
  dict: SiteDictionary;
  groups: ReleaseMonthGroup[];
};

function applyFilter(release: ReleaseViewModel, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "stable") return !release.prerelease;
  return release.prerelease;
}

export function ChangelogClient({ locale, dict, groups }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [activeMonth, setActiveMonth] = useState<string>(groups[0]?.key ?? "");

  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        releases: group.releases.filter((release) => applyFilter(release, filter))
      }))
      .filter((group) => group.releases.length > 0);
  }, [groups, filter]);

  const filterItems: Array<{ key: Filter; label: string }> = [
    { key: "all", label: dict.changelog.all },
    { key: "stable", label: dict.changelog.stable },
    { key: "prerelease", label: dict.changelog.prerelease }
  ];

  return (
    <section className="release-layout section-enter" data-delay="2">
      <div style={{ display: "grid", gap: 12 }}>
        <div className="filter-row">
          {filterItems.map((item) => (
            <button
              key={item.key}
              className="filter-chip"
              data-active={filter === item.key ? "true" : "false"}
              onClick={() => setFilter(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {filteredGroups.map((group) => (
          <div id={`month-${group.key}`} key={group.key} style={{ display: "grid", gap: 10 }}>
            <article className="panel" style={{ padding: "14px 18px" }}>
              <h3>{group.label}</h3>
            </article>
            {group.releases.map((release) => (
              <article className="release-card" key={release.id}>
                <div className="release-card-header">
                  <div>
                    <div className="eyebrow">{release.tag}</div>
                    <h3 style={{ marginTop: 6 }}>{release.title}</h3>
                  </div>
                  <div className="row">
                    {release.prerelease ? <span className="badge">{dict.changelog.prerelease}</span> : null}
                    <a className="button-subtle" href={release.url} rel="noreferrer noopener" target="_blank">
                      {dict.common.viewOnGithub}
                    </a>
                  </div>
                </div>

                <p className="meta">
                  {dict.changelog.published}: {formatReleaseDate(release.publishedAt, locale === "tr" ? "tr-TR" : "en-US")}
                </p>

                <div className="release-notes markdown">
                  {release.body ? (
                    <MarkdownBlock value={release.body} />
                  ) : (
                    <p className="meta">{dict.changelog.noNotes}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        ))}
      </div>

      <aside className="archive-panel">
        <div className="eyebrow">{dict.changelog.archive}</div>
        <div className="archive-list">
          {filteredGroups.map((group) => (
            <a
              className="archive-link"
              data-active={activeMonth === group.key ? "true" : "false"}
              href={`#month-${group.key}`}
              key={group.key}
              onClick={() => setActiveMonth(group.key)}
            >
              {group.label}
            </a>
          ))}
        </div>
      </aside>
    </section>
  );
}
