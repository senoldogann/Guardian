import { fetchReleaseSnapshot } from "../../lib/releases-source";
import type { ReleaseMonthGroup } from "../../lib/changelog";
import { groupReleasesByMonth, toReleaseViewModel } from "../../lib/changelog";
import { getDictionary } from "../../lib/i18n";
import { ChangelogClient } from "./changelog-client";
import type { Locale } from "../../lib/locale";

export async function ChangelogPageView({ locale }: { locale: Locale }) {
  let fetchError: string | null = null;
  const dict = getDictionary(locale);
  let groups: ReleaseMonthGroup[] = [];

  try {
    const releases = await fetchReleaseSnapshot(40);
    const releaseViewModels = releases.map(toReleaseViewModel);
    groups = groupReleasesByMonth(releaseViewModels, locale === "tr" ? "tr-TR" : "en-US");
  } catch (error) {
    fetchError = error instanceof Error ? error.message : (locale === "tr" ? "Sürüm notları yüklenemedi." : "Failed to load releases.");
  }

  return (
    <div className="min-h-[calc(100vh-200px)] pt-24">
      {fetchError ? (
        <div className="container px-4 py-8">
          <p className="text-red-400 bg-red-500/10 border border-red-500/20 p-4 rounded-lg inline-block">
            {fetchError}
          </p>
        </div>
      ) : null}

      <ChangelogClient dict={dict} groups={groups} locale={locale} />
    </div>
  );
}
