# Guardian P0-P2 Hardening And Release Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Guardian MCP, VS Code extension, CI/CD, release traceability, and signed 1.3.0 release akışını ürün seviyesinde tamamlamak.

**Architecture:** Guardian MCP gerçek critique kaynağı olarak `.guardian/critiques.json` snapshot'ını okuyacak, guardian-vscode ise MCP tool çıktısını yapısal olarak parse edip kullanıcıya boş sonuç, domain uyarısı ve transport/parse hatasını ayrı durumlar olarak gösterecek. CI tarafında dependency değişiklikleri için kaçış yolları kapatılacak, monorepo doğrulama matrisi standartlaştırılacak ve release/artifact naming tek standarda taşınacak.

**Tech Stack:** TypeScript, VS Code Extension API, Rust workspace, GitHub Actions, Tauri v2, npm, cargo.

---

### Task 1: Guardian MCP critique modelini ürün seviyesine çıkar

**Files:**
- Modify: `guardian-mcp/src/main.rs`
- Reuse/Inspect: `src-tauri/src/ai_client.rs`
- Reuse/Inspect: `src-tauri/src/watcher/critique.rs`
- Test: `guardian-mcp/src/main.rs` iç test modülü veya ayrı test dosyası

**Step 1: Snapshot ve critique model eşlemesini test ile tanımla**
- `scan_file` için başarılı aday/skip/error durumları
- `list_critiques` için gerçek snapshot parse, severity filter, invalid snapshot, missing file senaryoları

**Step 2: `list_critiques` stub davranışını kaldır**
- `.guardian/critiques.json` oku
- `protocol_version` ve payload doğrula
- `src-tauri` critique alanlarını MCP cevabına map et

**Step 3: `scan_file` cevabını domain model olacak şekilde genişlet**
- `status`, `kind`, `message`, `file metadata`, `candidate state` alanlarını açıklaştır
- kullanıcı dostu hata alanları ekle

**Step 4: Rust testlerini çalıştır**
- `cargo test -p guardian-mcp`

### Task 2: guardian-vscode transport/parse/domain ayrımını netleştir

**Files:**
- Modify: `guardian-vscode/src/guardianClient.ts`
- Modify: `guardian-vscode/src/extension.ts`
- Modify: `guardian-vscode/src/diagnosticsProvider.ts`
- Test: `guardian-vscode/src/**/*.test.ts`

**Step 1: Guardian client parse katmanını gerçek modele göre yaz**
- raw MCP `content[].text` payload parse et
- `scan_file` ve `list_critiques` için ayrı decoder yaz
- boş critiques ile parse/transport hatasını ayrı result tipleri ile temsil et

**Step 2: UI davranışını netleştir**
- başarılı ama boş sonuç: bilgi mesajı
- domain warning/error: kullanıcıya açıklayıcı mesaj
- transport/parse hatası: operasyonel hata mesajı + output channel log

**Step 3: Extension smoke senaryolarını kapsayan testleri ekle**
- `scan/show critiques/start monitoring`

**Step 4: VS Code test/lint/build paketini doğrula**
- `npm --prefix guardian-vscode run lint`
- `npm --prefix guardian-vscode run test`
- `npm --prefix guardian-vscode run compile`

### Task 3: Dependency değişiklikleri için P0 gate boşluklarını kapat

**Files:**
- Modify: `.github/workflows/ci-cd-v1.yml`
- Modify: diğer PR workflow dosyaları varsa `.github/workflows/*.yml`
- Modify: ilgili CI scriptleri `scripts/**`

**Step 1: `paths-ignore` bağımlılık kaçışlarını kaldır veya daralt**
- `package-lock.json`, `Cargo.lock`, `package.json`, `Cargo.toml` değişince tam pipeline koşsun

**Step 2: Dependency değişikliklerini zorunlu security/quality gate'e bağla**
- npm audit / cargo audit / secret scan / lint / test / build adımlarını koşullu değil zorunlu kapı yap

**Step 3: Workflow testlerini ve smoke scriptlerini güncelle**

### Task 4: Monorepo kalite matrisini standartlaştır

**Files:**
- Modify: `.github/workflows/ci-cd-v1.yml`
- Modify/Create: `scripts/verify_all.py`, `scripts/ci/*`
- Modify: `guardian-vscode/package.json`, `guardian-mcp/Cargo.toml`, workspace manifestler

**Step 1: Alt proje matrisi tanımla**
- root app, website, guardian-vscode, tüm Rust crate'leri

**Step 2: Minimum standartı her alt proje için uygula**
- lint + test + build + security scan

**Step 3: Rust workspace kapsamasını `src-tauri` ile sınırlı bırakma**
- fmt/clippy/check/test tüm workspace üzerinde koşsun

### Task 5: CI/CD dokümantasyonunu gerçekle hizala

**Files:**
- Modify: `README.md`
- Modify: `docs/CI_PR_INTEGRATION.md`
- Modify: `docs/RELEASING_LOCAL.md`
- Modify: `docs/LOCAL_RELEASE_RUNBOOK.md`
- Modify/Create: `docs/reports/*` veya uygun tek referans dokümanı

**Step 1: self-hosted vs github-hosted farkını tek kaynakta topla**

**Step 2: tetikleyici, stage ve gate tablosunu güncelle**

**Step 3: workflow davranışı ile metin birebir uyumlu mu doğrula**

### Task 6: Artifact naming ve release izlenebilirliğini standardize et

**Files:**
- Modify: `.github/workflows/ci-cd-v1.yml`
- Modify: `.github/workflows/release-*.yml`
- Modify: `scripts/collect_macos_artifacts.sh`
- Modify: `scripts/publish_distribution_local.sh`
- Modify: `scripts/release_all_local.sh`

**Step 1: sabit `v1.0.0` artifact isimlerini kaldır**

**Step 2: platform + version + sha standardı uygula**

**Step 3: rollback ve release lookup kolaylığını doğrula**

### Task 7: Güvenlik ve operasyonel raporlama standardını kur

**Files:**
- Modify: workflowlar
- Modify/Create: `scripts/ci/*`, `docs/TOKEN_SECURITY.md`, `docs/RELEASE_APPROVAL_POLICY.md`

**Step 1: audit bulguları için seviye bazlı gate politikası yaz**

**Step 2: PR/release/security çıktıları için tek rapor formatı belirle**

**Step 3: kritik blokaj ve orta SLA kurallarını dokümante et ve workflow'a bağla**

### Task 8: Subagent review + full verification + signed 1.3.0 release

**Files:**
- Review all modified files
- Use: `.github/workflows/release-macos-notarized.yml`
- Use: `docs/LOCAL_RELEASE_RUNBOOK.md`

**Step 1: çoklu subagent review çalıştır**
- architecture, security, typescript, rust, release/CI odaklı

**Step 2: tam doğrulama matrisi çalıştır**
- root, website, guardian-vscode, rust workspace, CI smoke

**Step 3: sürüm 1.3.0 senkronizasyonunu doğrula**

**Step 4: signed/notarized release akışını çalıştır ve GitHub Actions takip et**
- tüm action'lar başarılı olana kadar düzelt + yeniden çalıştır