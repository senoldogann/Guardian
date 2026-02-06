import type { DocLocale, SiteDictionary } from "../../lib/i18n";
import { fetchReleaseSnapshot } from "../../lib/releases-source";
import type { ReleaseMonthGroup } from "../../lib/changelog";
import { groupReleasesByMonth, toReleaseViewModel } from "../../lib/changelog";
import { ChangelogClient } from "./changelog-client";

type Props = {
  locale: DocLocale;
  dict: SiteDictionary;
};

export async function ChangelogPageView({ locale, dict }: Props) {
  let fetchError: string | null = null;
  let groups: ReleaseMonthGroup[] = [];

  try {
    const releases = await fetchReleaseSnapshot(40);
    const releaseViewModels = releases.map(toReleaseViewModel);
    groups = groupReleasesByMonth(releaseViewModels, locale === "tr" ? "tr-TR" : "en-US");
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "Failed to load releases";
  }

  return (
    <>
      <section className="hero section-enter" data-delay="1">
        <div className="eyebrow">{dict.changelog.eyebrow}</div>
        <h1>{dict.changelog.title}</h1>
        <p>{dict.changelog.description}</p>
        {fetchError ? <p className="meta" style={{ marginTop: 10 }}>{fetchError}</p> : null}
      </section>

      <ChangelogClient dict={dict} groups={groups} locale={locale} />
    </>
  );
}
