import type { SiteDictionary } from "../../lib/i18n";
import { getLatestRelease, pickInstallers, releaseTagToVersion } from "../../lib/github";
import { fetchReleaseSnapshot } from "../../lib/releases-source";
import { DownloadClient } from "../../app/download/download-client";
import type { Locale } from "../../lib/locale";

type Props = {
  dict: SiteDictionary;
  locale: Locale;
};

export async function DownloadPageView({ dict, locale }: Props) {
  let latestTag = "—";
  let installers = [] as ReturnType<typeof pickInstallers>;
  let fetchError: string | null = null;

  try {
    const releases = await fetchReleaseSnapshot(1);
    let latest = releases.at(0) ?? null;

    // Fallback only if the snapshot is unavailable for any reason.
    if (!latest) {
      latest = await getLatestRelease();
    }

    if (latest) {
      latestTag = releaseTagToVersion(latest.tag_name);
      installers = pickInstallers(latest.assets);
    } else {
      fetchError = dict.common.releaseNotAvailable;
    }
  } catch (error) {
    fetchError = error instanceof Error ? error.message : dict.common.releaseNotAvailable;
  }

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-28 sm:pt-32">
        <p className="text-xs font-medium tracking-[0.22em] uppercase text-neutral-500">
          {dict.download.eyebrow}
        </p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight text-neutral-950 dark:text-white">
          {dict.download.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base sm:text-lg text-neutral-600 dark:text-neutral-400">
          {dict.download.description}
        </p>
        <p className="mt-5 text-sm text-neutral-600 dark:text-neutral-400">
          {dict.download.latestLabel}: <span className="font-medium text-neutral-950 dark:text-white">v{latestTag}</span>
        </p>
        {fetchError ? <p className="mt-2 text-sm text-red-600">{fetchError}</p> : null}
      </section>

      <DownloadClient assets={installers} dict={dict} locale={locale} />
    </>
  );
}
