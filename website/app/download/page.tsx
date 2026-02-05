import type { Metadata } from "next";
import { getLatestRelease, pickInstallers } from "../../lib/github";
import { DownloadClient } from "./download-client";

export const metadata: Metadata = {
  title: "Download",
  description: "Download the latest Guardian release for your operating system."
};

export default async function DownloadPage() {
  let latestTag = "Not available yet";
  let installers: ReturnType<typeof pickInstallers> = [];
  let fetchError: string | null = null;

  try {
    const latest = await getLatestRelease();
    latestTag = latest.tag_name;
    installers = pickInstallers(latest.assets);
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "Could not load latest release";
  }

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Download</div>
        <h1>Install Guardian with one click.</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Release assets are fetched from GitHub in real time. When a new release is published,
          this page updates automatically.
        </p>
        <p className="meta" style={{ marginTop: 10 }}>
          Latest version: <strong>{latestTag}</strong>
        </p>
        {fetchError ? <p className="meta">{fetchError}</p> : null}
      </section>

      <DownloadClient assets={installers} />
    </>
  );
}
