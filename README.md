# Guardian v1.3.0 🚀
### Advanced Architectural Governance and Code Security Protocol
### Gelişmiş Mimari Yönetişim ve Kod Güvenliği Protokolü

[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](./CHANGELOG.md)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-success.svg)](./.github/workflows/ci-cd-v1.yml)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Guardian is a sophisticated development supervisor engineered to maintain system integrity through real-time architectural oversight and automated remediation. It bridges the gap between static analysis and active governance.

Guardian, gerçek zamanlı mimari denetim ve otomatik iyileştirme yoluyla sistem bütünlüğünü korumak için tasarlanmış gelişmiş bir geliştirme denetçisidir. Statik analiz ile aktif yönetişim arasındaki boşluğu doldurur.

<p align="center">
  <img src="assets/screenshot.png" width="48%" />
  <img src="assets/monitor.png" width="48%" />
</p>
<p align="center">
  <img src="assets/map.png" width="48%" />
  <img src="assets/guru.png" width="48%" />
</p>

---

## 🆕 What's New in v1.3.0

### Major Changes
- ✅ **GitHub-Hosted Quality Matrix**: Root app, Rust workspace, website, and `guardian-vscode` now gate independently
- ✅ **Production Ready**: Stable 1.3.0 release
- ✅ **Enhanced Security**: Improved CSP and authentication flow
- ✅ **Website v1.3.0**: Public website with download/changelog/docs
- ✅ **Supply-Chain Hardening**: Dependency and lockfile changes now trigger the full quality and security pipeline

---

## 🏗️ Architecture

### Core Components

#### Sentry Engine / Sentry Motoru
**[EN]** Continuous, passive monitoring of the file system. Identifies anti-patterns, performance regressions, and security vulnerabilities.

**[TR]** Dosya sisteminin sürekli izlenmesi. Anti-pattern'leri ve güvenlik açıklarını tespit eder.

#### Architect Intelligence / Mimari Zeka
Context-sensitive patches and automated remediation based on project documentation.

---

## 🚀 Quick Start

### Prerequisites
- Node.js v22+
- Rust v1.75+
- macOS 12+ (Apple Silicon or Intel)

### Installation
```bash
git clone https://github.com/senoldogann/Guardian.git
cd Guardian
npm install
```

### Development
```bash
# Desktop app
npm run tauri dev

# Website
cd website && npm run dev
```

---

## 🔧 CI/CD Setup (GitHub Actions)

Guardian now uses **GitHub-hosted runners** for the default product pipeline. No local runner setup is required to validate pull requests or release candidates.

---

## 📊 CI/CD Pipeline

The main workflow lives in `.github/workflows/ci-cd-v1.yml` and produces versioned artifacts using `v<version>-<short_sha>` naming.

| Stage | Description | Trigger |
|-------|-------------|---------|
| **Root Quality** | Format, lint, test, coverage gate, desktop frontend build | Push + PR |
| **Rust Workspace Quality** | `cargo fmt`, `clippy`, `check`, `test` across all workspace crates | Push + PR |
| **Website Quality** | Lint, copy gate, tests, coverage, Next.js build | Push + PR |
| **guardian-vscode Quality** | Lint, unit tests, compile, package `.vsix` | Push + PR |
| **Security Gate** | Critical npm audits block, moderate npm audits tracked, cargo audit blocks | Push + PR |
| **Release Gate Smoke** | Validates strict/warn/override release policy behavior | Push + PR |
| **Tauri Build** | Signed desktop bundle build on `main` after all gates pass | `main` only |
| **E2E Tests** | Playwright browser tests for desktop + website | PR only |

The PR-specific scan workflow lives in `.github/workflows/guardian-scan.yml` and emits:
- PR summary comment
- SARIF upload when token context allows it
- `guardian-pr-gate-report.json` in the scan artifact bundle

---

## 🧪 Testing

```bash
# Full local release-grade verification
npm run verify

# VS Code extension validation only
cd guardian-vscode && npm run validate
```

---

## 📦 Distribution

Guardian uses a **public source + public distribution assets** model:

- **Source Repo** (public): This repository for source code, docs, issues, and contributions
- **Distribution Repo** (public): [guardian-distribution](https://github.com/senoldogann/guardian-distribution) for signed installers and updater metadata

### Required Secrets
```
PUBLIC_DIST_REPO=senoldogann/guardian-distribution
PUBLIC_DIST_REPO_TOKEN=<PAT with write access>
GITHUB_RELEASE_OWNER=senoldogann
GITHUB_RELEASE_REPO=guardian-distribution
```

---

## 🛡️ Security

- CSP headers configured
- Device flow authentication
- Offline-first telemetry
- Automated security scanning

See [docs/TOKEN_SECURITY.md](./docs/TOKEN_SECURITY.md) for details.

---

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Run tests: `npm run test && cargo check`
4. Commit: `git commit -m 'feat: add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open Pull Request

**Note:** Main branch is protected. CI must pass before merge.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Guardian v1.3.0</strong> — Built with ❤️ using Tauri + React + TypeScript
</p>

<p align="center">
  Maintained by Senol Dogan.
</p>
