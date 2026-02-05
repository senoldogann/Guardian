import { getLatestRelease, getDistributionRepoUrl, pickInstallers } from "../lib/github";

function formatDate(value: string | null): string {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

export default async function HomePage() {
  let latestError: string | null = null;
  let latest: Awaited<ReturnType<typeof getLatestRelease>> | null = null;

  try {
    latest = await getLatestRelease();
  } catch (error) {
    latestError = error instanceof Error ? error.message : "Failed to fetch latest release";
  }

  const installers = latest ? pickInstallers(latest.assets) : [];

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Desktop Governance Platform</div>
        <h1>Guardian keeps architecture and release quality under control.</h1>
        <p className="muted" style={{ maxWidth: 700 }}>
          Download links and changelog are synced directly from GitHub Releases. Every new release is reflected
          automatically on this website.
        </p>
        <div className="row" style={{ marginTop: 14 }}>
          <a className="button" href="/download">
            Download Guardian
          </a>
          <a className="button-subtle" href="/changelog">
            Read Changelog
          </a>
          <a className="button-subtle" href="/docs">
            Documentation
          </a>
        </div>
      </section>

      <section className="grid-2">
        <article className="card">
          <div className="eyebrow">Latest Release</div>
          {latest ? (
            <>
              <h2 style={{ marginTop: 8 }}>{latest.tag_name}</h2>
              <p className="meta" style={{ marginTop: 6 }}>
                Published {formatDate(latest.published_at)}
              </p>
              <p className="muted" style={{ marginTop: 12 }}>
                {latest.name || "Release package"}
              </p>
              <div className="row" style={{ marginTop: 12 }}>
                <a className="button-subtle" href={latest.html_url} target="_blank" rel="noreferrer">
                  Open GitHub Release
                </a>
                <a className="button-subtle" href={getDistributionRepoUrl()} target="_blank" rel="noreferrer">
                  Distribution Repo
                </a>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 8 }}>Distribution Repo Not Ready</h2>
              <p className="muted" style={{ marginTop: 10 }}>
                Create the public distribution repository and publish the first release.
              </p>
              {latestError ? <p className="meta">{latestError}</p> : null}
            </>
          )}
        </article>

        <article className="card">
          <div className="eyebrow">Installers</div>
          <div className="asset-list">
            {installers.slice(0, 4).map((asset) => (
              <div className="asset" key={asset.id}>
                <span>{asset.name}</span>
                <a className="button-subtle" href={asset.browser_download_url}>
                  Download
                </a>
              </div>
            ))}
            {installers.length === 0 && <p className="muted">No installer assets found yet.</p>}
          </div>
        </article>
      </section>

      <section className="grid-2">
        <div className="kpi">
          <div className="eyebrow">Auto Sync</div>
          <strong>GitHub Release Driven</strong>
          <p className="muted">Website, changelog and download button stay up-to-date automatically.</p>
        </div>
        <div className="kpi">
          <div className="eyebrow">Updater Ready</div>
          <strong>In-App Update Prompt</strong>
          <p className="muted">Guardian checks updater metadata and can install new version in app flow.</p>
        </div>
      </section>
    </>
  );
}
