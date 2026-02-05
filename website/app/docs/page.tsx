import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Guardian documentation for installation, updates and release operations."
};

export default function DocsPage() {
  return (
    <>
      <section className="hero">
        <div className="eyebrow">Documentation</div>
        <h1>Operate Guardian in production safely.</h1>
        <p className="muted" style={{ maxWidth: 680 }}>
          This is the public operations surface for end users. Internal development docs can remain in private source repositories.
        </p>
      </section>

      <section className="grid-2">
        <article className="docs-card">
          <h2>Install</h2>
          <p className="muted" style={{ marginTop: 10 }}>
            Use the Download page to install an OS-matched package. If your OS is not recognized,
            choose a manual installer from the release asset list.
          </p>
        </article>

        <article className="docs-card">
          <h2>Update Flow</h2>
          <p className="muted" style={{ marginTop: 10 }}>
            Guardian checks updater metadata (`latest.json`) and shows an in-app update action when a newer
            signed version is available.
          </p>
        </article>

        <article className="docs-card">
          <h2>Security Model</h2>
          <p className="muted" style={{ marginTop: 10 }}>
            Source repository can stay private. Distribution repository is public and stores only signed build
            artifacts plus release metadata.
          </p>
        </article>

        <article className="docs-card">
          <h2>Release Ops</h2>
          <p className="muted" style={{ marginTop: 10 }}>
            Create a version tag in source repo. CI builds binaries and mirrors release assets to the public
            distribution repo. Website updates automatically from public releases.
          </p>
        </article>
      </section>
    </>
  );
}
