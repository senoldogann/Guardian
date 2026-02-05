import type { Metadata } from "next";
import { getReleases } from "../../lib/github";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Track all Guardian release notes from GitHub."
};

function formatDate(value: string | null): string {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

export default async function ChangelogPage() {
  let releases: Awaited<ReturnType<typeof getReleases>> = [];
  let fetchError: string | null = null;

  try {
    releases = await getReleases(30);
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "Could not load releases";
  }

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Changelog</div>
        <h1>Release history, synced from GitHub.</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Each entry below is pulled from release notes. No manual content sync is required.
        </p>
        {fetchError ? <p className="meta">{fetchError}</p> : null}
      </section>

      <section className="release-list">
        {releases.map((release) => (
          <article className="release-card" key={release.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>{release.tag_name}</h2>
              <a className="button-subtle" href={release.html_url} target="_blank" rel="noreferrer">
                View on GitHub
              </a>
            </div>
            <p className="meta" style={{ marginTop: 8 }}>
              Published {formatDate(release.published_at)}
              {release.prerelease ? " • Pre-release" : ""}
            </p>
            {release.body ? (
              <div className="notes">{release.body}</div>
            ) : (
              <p className="muted" style={{ marginTop: 10 }}>
                No release notes.
              </p>
            )}
          </article>
        ))}

        {releases.length === 0 && !fetchError ? (
          <article className="release-card">
            <h2>No releases yet</h2>
            <p className="muted" style={{ marginTop: 10 }}>
              Publish the first public distribution release and this page will populate automatically.
            </p>
          </article>
        ) : null}
      </section>
    </>
  );
}
