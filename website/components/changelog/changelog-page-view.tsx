import { fetchReleaseSnapshot } from "../../lib/releases-source";
import type { ReleaseMonthGroup } from "../../lib/changelog";
import { groupReleasesByMonth, toReleaseViewModel } from "../../lib/changelog";
import { getDictionary } from "../../lib/i18n";
import { ChangelogClient } from "./changelog-client";

export async function ChangelogPageView() {
  let fetchError: string | null = null;
  const dict = getDictionary();
  let groups: ReleaseMonthGroup[] = [];

  try {
    const rawReleases = await fetchReleaseSnapshot(40);
    const releaseViewModels = rawReleases.map(toReleaseViewModel);
    groups = groupReleasesByMonth(releaseViewModels, "en-US");
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "Failed to load releases";
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

      <ChangelogClient dict={dict} groups={groups} />
    </div>
  );
}
