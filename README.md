# Guardian
### Advanced Architectural Governance and Code Security Protocol
### Gelişmiş Mimari Yönetişim ve Kod Güvenliği Protokolü

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

## Executive Summary / Yönetici Özeti

**[EN]** In modern software engineering, technical debt and architectural drift are the primary inhibitors of velocity. Guardian addresses these challenges by implementing a zero-trust surveillance layer over the project's codebase, ensuring that every modification aligns with the predefined system design and security standards.

**[TR]** Modern yazılım mühendisliğinde, teknik borç ve mimari sapma hızın önündeki temel engellerdir. Guardian, projenin kod tabanı üzerinde sıfır güvenli bir gözetim katmanı uygulayarak bu zorlukları ele alır ve her değişikliğin önceden tanımlanmış sistem tasarımı ve güvenlik standartlarıyla uyumlu olmasını sağlar.

---

## Core Operational Components / Temel Operasyonel Bileşenler

### Sentry Engine / Sentry Motoru
**[EN]** The Sentry Engine provides continuous, passive monitoring of the file system. It identifies anti-patterns, performance regressions, and security vulnerabilities as they are introduced. On detection of critical violations, the engine enforces a developmental lockdown.

**[EN]** AI editor integration: Guardian writes structured events to `.guardian/agent_queue.jsonl` so AI coding agents can consume real-time critiques and resolution signals.

**[TR]** Sentry Motoru, dosya sisteminin sürekli ve pasif olarak izlenmesini sağlar. Anti-pattern'leri, performans düşüşlerini ve güvenlik açıklarını oluştukları anda tespit eder. Kritik ihlaller saptandığında, sistem geliştirme döngüsünü askıya alarak güvenliği sağlar.

### Architect Intelligence / Mimari Zeka
**[EN]** Utilizing deep project context and structural awareness, the Architect Intelligence component analyzes the project's design documentation to provide verified, context-sensitive patches.

**[TR]** Derin proje bağlamı ve yapısal farkındalık kullanan Mimari Zeka bileşeni, doğrulanmış ve bağlama duyarlı yamalar sağlamak için projenin tasarım dokümantasyonunu analiz eder.

---

## Technical Specifications / Teknik Özellikler

- **Runtime**: Built on Tauri for high-performance system interaction. / Yüksek performanslı sistem etkileşimi için Tauri üzerine inşa edilmiştir.
- **Frontend**: Engineered with React, TypeScript, and Tailwind CSS v4. / React, TypeScript ve Tailwind CSS v4 ile geliştirilmiştir.
- **Security**: Real-time diff analysis and automated policy enforcement. / Gerçek zamanlı diff analizi ve otomatik politika uygulama.

---

## Desktop-only Mode (Web Unsupported) / Masaüstü-odaklı Mod (Web Desteklenmez)

- **GitHub Login**: Device Flow ile giriş (env: `GITHUB_CLIENT_ID`).
- **Offline-first Telemetry**: Metadata-only (path + hash + severity) yerel kuyrukta tutulur.
- **Realtime Monitoring**: İzleme daima yerelde çalışır, bulut bağlantısı opsiyoneldir.
- **Security Headers**: Üretim reverse proxy için `nginx.conf` şablonu hazırdır.
- **Web UI**: Sadece dahili UI regresyon testleri için; ürün olarak desteklenmez.
- **Monitoring UI**: İzleme aktifken orta alanda canlı aktivite animasyonu görünür.
- **Project Map**: 300 dosyaya kadar otomatik genişler; daha büyük projelerde performans için kademeli görünür.
- **Marketing Website**: `website/` klasöründeki statik landing sayfası GitHub Releases API ile en güncel sürümü otomatik algılar.

---

## Implementation Guide / Kurulum Rehberi

### Prerequisites / Ön Koşullar
- Node.js (v18+)
- Rust Toolchain (v1.75+)
- Tauri CLI

### Installation / Kurulum
```bash
git clone https://github.com/senoldogann/Guardian.git
cd guardian
npm install
```

### Configuration / Yapılandırma
```bash
cp .env.example .env
```

Env değişkenleri:
- `GUARDIAN_API_KEY` (AI kritik çağrıları için)
- `TAVILY_API_KEYS` (web arama yedekleri)
- `GITHUB_CLIENT_ID` (GitHub login için)
- `GITHUB_CLIENT_SECRET` (opsiyonel, GitHub login için)

### Execution / Çalıştırma
```bash
npm run tauri dev
```

Not: `npm run dev` yalnızca UI/regresyon kontrolleri için uygundur; gerçek kullanım masaüstü uygulamasındadır.

---

## Testing / Testler

### Unit + Integration
```bash
npm run test
```

### Coverage
```bash
npm run test:coverage
```

### E2E (Playwright)
```bash
npx playwright install
npm run test:e2e
```

## PR Workflow / PR Akışı

Main branch korumalıdır. Değişiklikler için önerilen akış:
- `git switch -c feature/<kisa-aciklama>`
- `npm run test` ve `cargo check` çalıştır
- `git commit -m "..."`  
- `git push -u origin feature/<kisa-aciklama>`
- PR oluştur ve gerekli CI kontrollerinin (ör. `build-and-test`) geçmesini bekle

## Governance / Yönetişim

Guardian is an open-initiative project licensed under the MIT License. / Guardian, MIT Lisansı altında lisanslanmış bir açık kaynak girişimidir.

---

Copyright 2026 Guardian Protocol. All rights reserved.
