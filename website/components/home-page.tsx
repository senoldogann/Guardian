import Link from "next/link";
import { StructuredData } from "./structured-data";
import type { DocLocale, SiteDictionary } from "../lib/i18n";
import { buildLocalizedPath } from "../lib/i18n";
import { buildSoftwareApplicationJsonLd, buildWebsiteJsonLd } from "../lib/seo";
import { formatBytes, getLatestRelease, getDistributionRepoUrl, pickInstallers, releaseTagToVersion } from "../lib/github";

type HomePageProps = {
  locale: DocLocale;
  dict: SiteDictionary;
};

type LocalizedBlock = {
  title: string;
  description: string;
};

function formatDate(value: string | null, locale: DocLocale): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function getFeatureBlocks(locale: DocLocale): LocalizedBlock[] {
  if (locale === "tr") {
    return [
      {
        title: "Canlı İzleme",
        description: "Kod değişikliklerini gerçek zamanlı tarar, kritik ihlallerde güvenli şekilde süreci durdurur."
      },
      {
        title: "Guru Yardım Katmanı",
        description: "Bulgular için açıklama, onay akışı ve düzenleme önerisi üretir; ekip hızını düşürmeden kaliteyi korur."
      },
      {
        title: "Uygulama İçi Güncelleme",
        description: "Dağıtım release'lerinden güncellemeleri algılar, güvenli kurulum akışını uygulama içinden yönetir."
      },
      {
        title: "Release Yönetişimi",
        description: "Public distribution + private source modeliyle kurumsal gizlilik ve dağıtım otomasyonunu birlikte sunar."
      }
    ];
  }

  return [
    {
      title: "Live Monitoring",
      description: "Scans repository changes in real time and safely stalls execution on critical violations."
    },
    {
      title: "Guru Assistance Layer",
      description: "Provides guided fixes, approval flow, and actionable context without slowing down delivery."
    },
    {
      title: "In-App Updates",
      description: "Consumes release metadata and executes secure update flow directly inside the desktop app."
    },
    {
      title: "Release Governance",
      description: "Supports private source + public distribution architecture for enterprise-grade delivery."
    }
  ];
}

function getVideoCards(locale: DocLocale): LocalizedBlock[] {
  if (locale === "tr") {
    return [
      {
        title: "GitHub Auth Akışı",
        description: "Device flow doğrulamasının uygulama içindeki kapanış davranışı."
      },
      {
        title: "Guru ve İzleme Deneyimi",
        description: "Stall, öneri ve çözüm akışının uçtan uca görünümü."
      }
    ];
  }

  return [
    {
      title: "GitHub Auth Flow",
      description: "Device-flow verification and automatic in-app completion behavior."
    },
    {
      title: "Guru and Monitoring",
      description: "End-to-end stall, recommendation, and fix workflow."
    }
  ];
}

function getShowcaseMeta(locale: DocLocale) {
  if (locale === "tr") {
    return {
      visualSectionTitle: "Uygulama Ekranlarından",
      visualSectionDescription: "Gerçek kullanım ekranlarıyla Guardian deneyimini hızlıca inceleyin.",
      videoSectionTitle: "Demo Videolar",
      videoSectionDescription: "Auth ve Guru akışlarının kısa video gösterimi.",
      releaseSectionTitle: "Release Pulse",
      releaseSectionDescription: "Sürüm durumu, indirme paketleri ve kaynak bağlantıları."
    };
  }

  return {
    visualSectionTitle: "Product Screens",
    visualSectionDescription: "Preview real app workflows through production screenshots.",
    videoSectionTitle: "Demo Videos",
    videoSectionDescription: "Short walkthroughs for auth and Guru workflows.",
    releaseSectionTitle: "Release Pulse",
    releaseSectionDescription: "Live release status, installer assets, and source links."
  };
}

export async function HomePageView({ locale, dict }: HomePageProps) {
  let latestError: string | null = null;
  let latestTag = "—";
  let latestDate = "—";
  let installers = [] as ReturnType<typeof pickInstallers>;
  let latestUrl = getDistributionRepoUrl();
  const trustReleaseMeta =
    locale === "tr"
      ? "GitHub release akışı tek doğruluk kaynağı olarak kullanılır."
      : "GitHub release stream is treated as source of truth.";
  const trustUpdateMeta =
    locale === "tr"
      ? "İmzalı update metadata ile güvenli uygulama içi geçiş sağlanır."
      : "Signed updater metadata enables safe in-app transitions.";
  const trustSecurityMeta =
    locale === "tr"
      ? "Kod deposu private kalırken dağıtım deposu public olabilir."
      : "Distribution repository can stay public while source remains private.";
  const installersTitle = locale === "tr" ? "Kurulum Paketleri" : "Installers";
  const featureBlocks = getFeatureBlocks(locale);
  const videoCards = getVideoCards(locale);
  const showcaseMeta = getShowcaseMeta(locale);

  try {
    const latest = await getLatestRelease();
    latestTag = releaseTagToVersion(latest.tag_name);
    latestDate = formatDate(latest.published_at, locale);
    installers = pickInstallers(latest.assets).slice(0, 4);
    latestUrl = latest.html_url;
  } catch (error) {
    latestError = error instanceof Error ? error.message : dict.common.releaseNotAvailable;
  }

  return (
    <>
      <StructuredData payload={buildSoftwareApplicationJsonLd(locale)} />
      <StructuredData payload={buildWebsiteJsonLd(locale)} />

      <section className="hero home-hero section-enter" data-delay="1">
        <div className="home-hero-grid">
          <div className="home-hero-copy">
            <div className="eyebrow">{dict.home.eyebrow}</div>
            <h1>{dict.home.title}</h1>
            <p>{dict.home.description}</p>
            <div className="row" style={{ marginTop: 16 }}>
              <Link className="button" href={buildLocalizedPath(locale, "/download")}>
                {dict.home.ctaPrimary}
              </Link>
              <Link className="button-subtle" href={buildLocalizedPath(locale, "/docs")}>
                {dict.home.ctaSecondaryDocs}
              </Link>
              <Link className="button-subtle" href={buildLocalizedPath(locale, "/changelog")}>
                {dict.home.ctaSecondaryChangelog}
              </Link>
            </div>
            <div className="hero-kpi-row">
              <div className="hero-kpi">
                <span>v{latestTag}</span>
                <small>{dict.common.latestVersion}</small>
              </div>
              <div className="hero-kpi">
                <span>{latestDate}</span>
                <small>{dict.common.updatedAt}</small>
              </div>
            </div>
          </div>
          <article className="hero-surface">
            <img alt="Guardian monitoring interface" src="/media/guardian-monitor.png" />
          </article>
        </div>
      </section>

      <section className="kpi-grid section-enter" data-delay="2">
        <article className="kpi">
          <div className="eyebrow">01</div>
          <strong>{dict.home.trustRelease}</strong>
          <p className="meta">{trustReleaseMeta}</p>
        </article>
        <article className="kpi">
          <div className="eyebrow">02</div>
          <strong>{dict.home.trustUpdates}</strong>
          <p className="meta">{trustUpdateMeta}</p>
        </article>
        <article className="kpi">
          <div className="eyebrow">03</div>
          <strong>{dict.home.trustSecurity}</strong>
          <p className="meta">{trustSecurityMeta}</p>
        </article>
      </section>

      <section className="feature-grid section-enter" data-delay="2">
        {featureBlocks.map((item) => (
          <article className="panel feature-card" key={item.title}>
            <h3>{item.title}</h3>
            <p className="meta">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="panel media-panel section-enter" data-delay="3">
        <div className="panel-head">
          <h2>{showcaseMeta.visualSectionTitle}</h2>
          <p className="meta">{showcaseMeta.visualSectionDescription}</p>
        </div>
        <div className="screenshot-grid">
          <figure className="media-card">
            <img alt="Guardian monitor view" loading="lazy" src="/media/guardian-monitor.png" />
          </figure>
          <figure className="media-card">
            <img alt="Guardian auth success screen" loading="lazy" src="/media/guardian-auth-success.png" />
          </figure>
          <figure className="media-card">
            <img alt="Guardian macOS safety warning sample" loading="lazy" src="/media/guardian-auth-gatekeeper.png" />
          </figure>
        </div>
      </section>

      <section className="panel media-panel section-enter" data-delay="3">
        <div className="panel-head">
          <h2>{showcaseMeta.videoSectionTitle}</h2>
          <p className="meta">{showcaseMeta.videoSectionDescription}</p>
        </div>
        <div className="video-grid">
          <article className="video-card">
            <video controls playsInline poster="/media/guardian-demo-auth-poster.jpg" preload="metadata">
              <source media="(max-width: 767px)" src="/media/guardian-demo-auth-mobile.mp4" type="video/mp4" />
              <source src="/media/guardian-demo-auth.mp4" type="video/mp4" />
            </video>
            <h3>{videoCards[0].title}</h3>
            <p className="meta">{videoCards[0].description}</p>
          </article>
          <article className="video-card">
            <video controls playsInline poster="/media/guardian-demo-guru-poster.jpg" preload="metadata">
              <source media="(max-width: 767px)" src="/media/guardian-demo-guru-mobile.mp4" type="video/mp4" />
              <source src="/media/guardian-demo-guru.mp4" type="video/mp4" />
            </video>
            <h3>{videoCards[1].title}</h3>
            <p className="meta">{videoCards[1].description}</p>
          </article>
        </div>
      </section>

      <section className="download-layout section-enter" data-delay="3">
        <article className="panel">
          <div className="eyebrow">{showcaseMeta.releaseSectionTitle}</div>
          <h2 style={{ marginTop: 8 }}>v{latestTag}</h2>
          <p className="meta" style={{ marginTop: 8 }}>
            {showcaseMeta.releaseSectionDescription}
          </p>
          <p className="meta" style={{ marginTop: 8 }}>
            {dict.common.updatedAt}: {latestDate}
          </p>
          {latestError ? <p className="meta" style={{ marginTop: 8 }}>{latestError}</p> : null}
          <div className="row" style={{ marginTop: 14 }}>
            <a className="button-subtle" href={latestUrl} target="_blank" rel="noreferrer noopener">
              {dict.common.viewOnGithub}
            </a>
            <a className="button-subtle" href={getDistributionRepoUrl()} target="_blank" rel="noreferrer noopener">
              {dict.common.openDistributionRepo}
            </a>
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">{installersTitle}</div>
          <div className="asset-list">
            {installers.length > 0 ? (
              installers.map((asset) => (
                <div className="asset-item" key={asset.id}>
                  <div className="asset-name">
                    <strong>{asset.name}</strong>
                    <div className="asset-meta">
                      <span>{formatBytes(asset.size)}</span>
                    </div>
                  </div>
                  <div className="asset-actions">
                    <a className="button-subtle" href={asset.browser_download_url}>
                      {dict.nav.download}
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="meta">{dict.common.releaseNotAvailable}</p>
            )}
          </div>
        </article>
      </section>
    </>
  );
}
