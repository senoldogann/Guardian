const REPO_OWNER = "senoldogann";
const REPO_NAME = "Guardian";
const RELEASE_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
const RELEASE_PAGE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

const downloadBtn = document.getElementById("downloadBtn");
const releaseBtn = document.getElementById("releaseBtn");
const statusLine = document.getElementById("statusLine");
const detectedTarget = document.getElementById("detectedTarget");
const releaseMeta = document.getElementById("releaseMeta");
const assetGrid = document.getElementById("assetGrid");
const allAssetsLink = document.getElementById("allAssetsLink");

function safeText(value) {
  return String(value ?? "").trim();
}

function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.userAgentData?.platform || navigator.platform || "").toLowerCase();
  const arch = (navigator.userAgentData?.architecture || "").toLowerCase();

  const isWindows = platform.includes("win") || ua.includes("windows");
  const isMac = platform.includes("mac") || ua.includes("mac os");
  const isLinux = platform.includes("linux") || ua.includes("linux");
  const arm = arch.includes("arm") || ua.includes("arm64") || ua.includes("aarch64");

  if (isWindows) return { key: "windows", label: "Windows 64-bit" };
  if (isMac && arm) return { key: "darwin-aarch64", label: "macOS (Apple Silicon)" };
  if (isMac) return { key: "darwin-x86_64", label: "macOS (Intel)" };
  if (isLinux) return { key: "linux", label: "Linux" };
  return { key: "unknown", label: "Unknown OS" };
}

function chooseAsset(assets, platformKey) {
  const byName = (pattern) => assets.find((asset) => asset.name.toLowerCase().includes(pattern));

  if (platformKey === "windows") {
    return byName("x64_en-us.msi") || byName("x64-setup.exe");
  }
  if (platformKey === "darwin-aarch64") {
    return byName("aarch64.dmg") || byName("aarch64.app.tar.gz");
  }
  if (platformKey === "darwin-x86_64") {
    return byName("_x64.dmg") || byName("x64.app.tar.gz");
  }
  if (platformKey === "linux") {
    return byName(".appimage") || byName(".deb") || byName(".rpm");
  }
  return null;
}

function groupedManualAssets(assets) {
  const picks = [
    { label: "Windows Installer (MSI)", finder: () => assets.find((a) => a.name.toLowerCase().includes("x64_en-us.msi")) },
    { label: "Windows Installer (EXE)", finder: () => assets.find((a) => a.name.toLowerCase().includes("x64-setup.exe")) },
    { label: "macOS Apple Silicon (DMG)", finder: () => assets.find((a) => a.name.toLowerCase().includes("aarch64.dmg")) },
    { label: "macOS Intel (DMG)", finder: () => assets.find((a) => a.name.toLowerCase().includes("_x64.dmg")) },
    { label: "Updater Manifest", finder: () => assets.find((a) => a.name.toLowerCase() === "latest.json") },
  ];
  return picks.map((item) => ({ label: item.label, asset: item.finder() })).filter((item) => Boolean(item.asset));
}

function renderManualAssets(items) {
  assetGrid.innerHTML = "";
  if (items.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No downloadable assets found.";
    p.className = "status error";
    assetGrid.appendChild(p);
    return;
  }

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "asset-card";

    const text = document.createElement("div");
    const title = document.createElement("div");
    title.className = "asset-label";
    title.textContent = item.label;
    const name = document.createElement("div");
    name.className = "asset-name";
    name.textContent = item.asset.name;
    text.append(title, name);

    const link = document.createElement("a");
    link.className = "asset-link";
    link.href = item.asset.browser_download_url;
    link.textContent = "Download";
    link.rel = "noreferrer";

    card.append(text, link);
    assetGrid.appendChild(card);
  }
}

async function loadLatestRelease() {
  try {
    const response = await fetch(RELEASE_API, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`GitHub API error (${response.status})`);
    }

    const release = await response.json();
    const version = safeText(release.tag_name) || "unknown";
    const publishedAt = safeText(release.published_at);
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const releaseUrl = safeText(release.html_url) || RELEASE_PAGE;
    const platform = detectPlatform();
    const preferred = chooseAsset(assets, platform.key);

    releaseBtn.href = releaseUrl;
    allAssetsLink.href = releaseUrl;

    releaseMeta.textContent = `Latest: ${version}${publishedAt ? ` | Published: ${new Date(publishedAt).toLocaleString()}` : ""}`;

    if (preferred) {
      downloadBtn.href = preferred.browser_download_url;
      downloadBtn.textContent = `Download for ${platform.label}`;
      detectedTarget.textContent = `Detected ${platform.label}. Auto-download is mapped to ${preferred.name}.`;
      statusLine.textContent = `Connected to GitHub release ${version}.`;
      statusLine.classList.remove("error");
    } else {
      downloadBtn.href = releaseUrl;
      downloadBtn.textContent = "Open Latest Release";
      detectedTarget.textContent = `Detected ${platform.label}, but no matching installer was found in this release.`;
      statusLine.textContent = "No direct installer match. Redirecting to release page.";
      statusLine.classList.add("error");
    }

    renderManualAssets(groupedManualAssets(assets));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    downloadBtn.href = RELEASE_PAGE;
    releaseBtn.href = RELEASE_PAGE;
    allAssetsLink.href = RELEASE_PAGE;
    detectedTarget.textContent = "Automatic mapping failed. Use manual release page.";
    releaseMeta.textContent = "GitHub API was not reachable.";
    statusLine.textContent = `Release lookup failed: ${message}`;
    statusLine.classList.add("error");
    renderManualAssets([]);
  }
}

void loadLatestRelease();
