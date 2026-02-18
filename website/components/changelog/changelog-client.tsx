"use client";

import { useMemo, useState } from "react";
import type { ReleaseMonthGroup, ReleaseViewModel } from "../../lib/changelog";
import type { SiteDictionary } from "../../lib/i18n";
import { formatReleaseDate } from "../../lib/changelog";
import { MarkdownBlock } from "../markdown-block";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { Locale } from "../../lib/locale";
import { withLocale } from "../../lib/locale";

type Filter = "all" | "stable" | "prerelease";

type Props = {
  dict: SiteDictionary;
  groups: ReleaseMonthGroup[];
  locale: Locale;
};

function applyFilter(release: ReleaseViewModel, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "stable") return !release.prerelease;
  return release.prerelease;
}

export function ChangelogClient({ dict, groups, locale }: Props) {
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

  const dateLocale = locale === "tr" ? "tr-TR" : "en-US";

  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <header className="pt-10 sm:pt-14">
        <p className="text-xs font-medium tracking-[0.22em] uppercase text-neutral-500">
          {dict.changelog.eyebrow}
        </p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight text-neutral-950 dark:text-white">
          {dict.changelog.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base sm:text-lg text-neutral-600 dark:text-neutral-400">
          {dict.changelog.description}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-2" role="group" aria-label="Changelog filters">
          {filterItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={[
                "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
                filter === item.key
                  ? "border border-neutral-900 dark:border-white bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 hover:bg-neutral-900 dark:hover:bg-neutral-100 shadow-md"
                  : "border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
              ].join(" ")}
              aria-pressed={filter === item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10">
        <div className="space-y-10">
          {filteredGroups.map((group) => (
            <div id={`month-${group.key}`} key={group.key} className="scroll-mt-28">
              <div className="-mx-4 px-4 py-3 lg:mx-0 lg:px-0 lg:py-0">
                <h2 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">
                  {group.label}
                </h2>
              </div>

              <div className="mt-4 space-y-6">
                {group.releases.map((release) => (
                  <article
                    key={release.id}
                    className={[
                      "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-black/40 backdrop-blur",
                      "shadow-[0_1px_0_rgba(17,19,23,0.04)] hover:shadow-[0_16px_48px_rgba(17,19,23,0.10)]",
                      "transition-shadow"
                    ].join(" ")}
                  >
                    <details className="group">
                      <summary className="list-none cursor-pointer">
                        <div className="p-6 flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                {release.tag}
                              </span>
                              {release.prerelease ? (
                                <span className="inline-flex items-center rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
                                  {dict.changelog.prerelease}
                                </span>
                              ) : null}
                            </div>
                            <h3 className="mt-3 text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                              {release.title}
                            </h3>
                            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                              {dict.changelog.published}: {formatReleaseDate(release.publishedAt, dateLocale)}
                            </p>
                          </div>

                          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/70">
                            <span>{dict.changelog.sections}</span>
                            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                          </div>
                        </div>
                      </summary>

                      <div className="px-6 pb-6">
                        {release.highlights.length > 0 ? (
                          <div className="mt-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                              {dict.changelog.highlights}
                            </p>
                            <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                              {release.highlights.map((item, index) => (
                                <li key={`${release.id}-highlight-${index}`} className="flex gap-2">
                                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="mt-6 grid gap-4">
                          {release.sections.length > 0
                            ? release.sections.map((section, sectionIndex) => (
                              <div
                                key={`${release.id}-${section.title}-${sectionIndex}`}
                                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/50 p-4"
                              >
                                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                                  {section.title || dict.changelog.sections}
                                </h4>
                                <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                                  {section.items.map((item, index) => (
                                    <li key={`${release.id}-${section.title}-${index}`} className="flex gap-2">
                                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))
                            : release.body ? (
                              <div className="prose dark:prose-invert max-w-none">
                                <MarkdownBlock value={release.body} locale={locale} />
                              </div>
                            ) : (
                              <p className="text-neutral-500 dark:text-neutral-400">{dict.changelog.noNotes}</p>
                            )}
                        </div>
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside className="lg:block">
          <div className="lg:sticky lg:top-24 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 backdrop-blur p-5 transition-all duration-200 mt-[52px]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium tracking-[0.22em] uppercase text-neutral-500 dark:text-neutral-400">
                {dict.changelog.archive}
              </p>
              <Link
                href={withLocale(locale, "/download")}
                className="text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white transition-colors"
              >
                {dict.nav.download}
              </Link>
            </div>

            <div className="mt-4 space-y-1">
              {filteredGroups.map((group) => (
                <a
                  key={group.key}
                  href={`#month-${group.key}`}
                  onClick={() => setActiveMonth(group.key)}
                  className={[
                    "block rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer",
                    activeMonth === group.key
                      ? "bg-neutral-950 dark:bg-white text-white dark:text-black font-medium"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                  ].join(" ")}
                >
                  {group.label}
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
