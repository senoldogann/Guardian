import Link from "next/link";
import { fetchReleaseSnapshot } from "../../lib/releases-source";
import { formatReleaseDate, toReleaseViewModel } from "../../lib/changelog";
import type { Locale } from "../../lib/locale";
import { withLocale } from "../../lib/locale";

function pickHighlights(items: ReturnType<typeof toReleaseViewModel>): string[] {
  if (items.highlights.length > 0) {
    return items.highlights.slice(0, 4);
  }
  return items.sections.flatMap((section) => section.items).slice(0, 4);
}

export async function LatestReleaseNotes({ locale }: { locale: Locale }) {
  try {
    const releases = await fetchReleaseSnapshot(1);
    if (releases.length === 0) return null;

    const latest = toReleaseViewModel(releases[0]);
    const highlights = pickHighlights(latest);
    const isTr = locale === "tr";

    return (
      <section className="mt-14 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/30 p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-neutral-500 dark:text-neutral-400">
          {isTr ? "Son sürüm notları" : "Latest release notes"}
        </p>
        <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
          {isTr ? `${latest.tag} sürümünde neler yeni?` : `What's New in ${latest.tag}`}
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {isTr ? "Yayın tarihi" : "Published"}:{" "}
          {formatReleaseDate(latest.publishedAt, isTr ? "tr-TR" : "en-US")}
        </p>

        {highlights.length > 0 ? (
          <ul className="mt-5 list-disc list-outside pl-5 space-y-2 text-neutral-700 dark:text-neutral-300">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-neutral-600 dark:text-neutral-400">
            {isTr
              ? "Bu sürümde detaylı not bulunmuyor. Tüm geçmiş için değişiklikler sayfasına bakın."
              : "No detailed notes were published for this release. See the changelog for full history."}
          </p>
        )}

        <div className="mt-6">
          <Link
            href={withLocale(locale, "/changelog")}
            className="inline-flex items-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {isTr ? "Tüm değişiklikleri görüntüle" : "View full changelog"}
          </Link>
        </div>
      </section>
    );
  } catch {
    return null;
  }
}
