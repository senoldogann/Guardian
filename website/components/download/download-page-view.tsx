import type { DocLocale, SiteDictionary } from "../../lib/i18n";
import { getLatestRelease, pickInstallers, releaseTagToVersion } from "../../lib/github";
import { DownloadClient } from "../../app/download/download-client";

type Props = {
  locale: DocLocale;
  dict: SiteDictionary;
};

export async function DownloadPageView({ locale, dict }: Props) {
  let latestTag = "—";
  let installers = [] as ReturnType<typeof pickInstallers>;
  let fetchError: string | null = null;

  try {
    const latest = await getLatestRelease();
    latestTag = releaseTagToVersion(latest.tag_name);
    installers = pickInstallers(latest.assets);
  } catch (error) {
    fetchError = error instanceof Error ? error.message : dict.common.releaseNotAvailable;
  }

  return (
    <>
      <section className="hero section-enter" data-delay="1">
        <div className="eyebrow">{dict.download.eyebrow}</div>
        <h1>{dict.download.title}</h1>
        <p>{dict.download.description}</p>
        <p className="meta" style={{ marginTop: 12 }}>
          {dict.download.latestLabel}: <strong>v{latestTag}</strong>
        </p>
        {fetchError ? <p className="meta" style={{ marginTop: 8 }}>{fetchError}</p> : null}
      </section>

      <DownloadClient assets={installers} dict={dict} locale={locale} />
    </>
  );
}
