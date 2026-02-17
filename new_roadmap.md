# Guardian Roadmap - Stabil ve Güvenilir Versiyon

## Genel Felsefe

**Öncelik:** Guardian'ı önce "güvenilir ve stabil" bir araç haline getirmek, sonra AI entegrasyonu eklemek.

**Risk Yönetimi:** AI'nin otomatik düzeltmesi (self-healing) yerine "öneri + review" modeli. Güvenlik her zaman önce gelir.

**Success Criteria:**
1. **Noise Reduction:** Eski/tekrar eden bulgular otomatik filtrelenir
2. **CI Integration:** PR'lerde Guardian kontrolü çalışır
3. **Zero Trust:** Secret'lar asla AI'a gitmez
4. **Time-to-Value:** Kurulumdan 5 dakika sonra ilk anlamlı bulgu

---

## Phase 0: Preflight ve Altyapı (1-2 Gün)

### Hedef
Geliştirme ortamını hazırlamak, mevcut kodu bozmadan yeni modülleri izole etmek.

### Görevler
1. **Branch Yönetimi**
   - `feature/roadmap-stable` branch'i oluştur
   - Mevcut değişikliklerle çakışmayı önle (website ayrı tutulacak)

2. **Test Altyapısı**
   - `cargo test` çalışır durumda
   - Mock AI provider ekle (CI'da gerçek AI kullanmadan test için)
   - Test workspace oluştur (`fixtures/test-project/`)

3. **Modül Yapısı** (src-tauri/src/ altında)
   ```
   src-tauri/src/
   ├── baseline/          # Yeni - baseline yönetimi
   ├── ci/               # Yeni - guardian-cli
   ├── agent_protocol/   # Yeni - mevcut protokolü stabilize etme
   ├── redaction/        # Yeni - Phase 0'da minimum gate
   ├── lib/
   │   └── (mevcut modüller: watcher, patcher, ai_client, vb.)
   └── main.rs
   ```

   **Net karar:**
   - Rust modülleri: `guardian/src-tauri/src/<mod>/`
   - Desktop UI: `guardian/src/`
   - Website: `guardian/website/`

4. **Minimum Redaction Gate (Phase 0'da - Kritik!)**
   ```rust
   // src-tauri/src/redaction/gate.rs
   pub fn is_sensitive_file(path: &Path) -> bool {
       const SENSITIVE_NAMES: &[&str] = &[
           ".env", ".env.local", ".env.production",
           ".key", ".pem", ".p12", ".pfx",
           "id_rsa", "id_ed25519",
           "credentials", "secrets",
       ];
       const SENSITIVE_EXTS: &[&str] = &["key", "pem", "p12", "pfx"];
       
       let name = path.file_name().unwrap_or_default().to_str().unwrap_or("");
       let ext = path.extension().unwrap_or_default().to_str().unwrap_or("");
       
       SENSITIVE_NAMES.iter().any(|s| name.contains(s))
           || SENSITIVE_EXTS.iter().any(|e| ext == *e)
   }
   
   pub fn mask_inline_secrets(content: &str) -> String {
       // API Key pattern'lerini [REDACTED] ile değiştir
       let api_key_pattern = regex::Regex::new(r"sk-[a-zA-Z0-9]{48}").unwrap();
       api_key_pattern.replace_all(content, "[REDACTED_API_KEY]").to_string()
   }
   ```
   
   **Integration:**
   - `watcher.rs`'de analiz öncesi: `if is_sensitive_file(path) { skip AI analysis }`
   - `ai_client.rs`'de prompt oluştururken: `content = mask_inline_secrets(content)`
   - **Hedef:** Phase 0'dan itibaren "Zero Trust: secret asla AI'a gitmez"

### Acceptance Criteria
- [x] `cargo test` başarılı
- [x] Yeni modüller mevcut watcher'ı bozmuyor
- [x] Branch merge conflict yok

### Phase 0 - Implemented (2026-02-09)
- Branch created: `feature/roadmap-stable`
- Added minimum redaction gate: `src-tauri/src/redaction/gate.rs`
- Integrated redaction into:
  - `src-tauri/src/watcher.rs` (sensitive file skip + inline masking)
  - `src-tauri/src/ai_client.rs` (mask before outbound prompt)
- Added mock AI provider for CI/dev: provider `mock` (enabled by `GUARDIAN_MOCK=1`)
- Added module skeletons: `src-tauri/src/baseline/`, `src-tauri/src/ci/`, `src-tauri/src/agent_protocol/`
- Added fixture workspace: `fixtures/test-project/`
- Tests:
  - `cd src-tauri && cargo test` (pass)
  - `npm test` (pass)

---

## Phase 1: Baseline + Regresyon Sistemi (1-2 Hafta)

### Hedef
Tekrarlayan bulguları filtrelemek, sadece "yeni ve regresyon" olanları göstermek. Guardian'ı "her açılışta aynı uyarıları gösteren" durumdan kurtarmak.

### Neden Öncelikli?
- Kullanıcı deneyimi için kritik
- Teknik risk düşük
- Diğer feature'ların temeli (CI, agent entegrasyonu)

### Implementation

#### 1.1 Baseline Schema (JSON)
```json
{
  "schema_version": 1,
  "created_at": "2026-02-09T10:00:00Z",
  "workspace_id": "sha256(/path/to/workspace)",
  "rules_hash": "sha256(rules.md content)",
  "finding_ids": [
    "sha256(rule_id + file_path + location_fingerprint + rules_hash)",
    "..."
  ]
}
```

**Not:** `finding_id` AI message'ine değil, **deterministik rule_id + file_path + location_fingerprint + rules_hash**'a dayanır. AI model/prompt değişse bile aynı issue aynı ID'yi alır.

#### 1.2 Yeni Modül: `baseline.rs`

**Fonksiyonlar:**
```rust
pub struct BaselineManager {
    workspace_root: PathBuf,
}

impl BaselineManager {
    /// Baseline oluştur (mevcut bulgulardan)
    pub fn create_baseline(&self, critiques: &[Critique]) -> Result<Baseline>;
    
    /// TÜM bulguları döndür, is_new/is_resolved flag'leri ile
    /// UI'da "Show All" filtresi için gerekli
    pub fn annotate_findings(&self, current: &[Critique], baseline: &Baseline) -> Vec<AnnotatedCritique>;
    
    /// Sadece yeni bulguları döndür (filtered view için)
    pub fn filter_new_only(&self, annotated: &[AnnotatedCritique]) -> Vec<AnnotatedCritique>;
    
    /// Baseline geçerlilik kontrolü (rules_hash değişmiş mi?)
    pub fn is_baseline_valid(&self, baseline: &Baseline) -> bool;
    
    /// Status raporu (active, new, resolved sayıları)
    pub fn get_status(&self, baseline: &Baseline, current: &[Critique]) -> BaselineStatus;
}

pub struct AnnotatedCritique {
    pub critique: Critique,
    pub is_new: bool,           // baseline'de yoksa true
    pub is_resolved: bool,      // baseline'de vardı ama şimdi yoksa true
    pub is_active: bool,        // baseline'de de var, şimdi de var
}

pub struct BaselineStatus {
    pub active: usize,
    pub new_since_baseline: usize,
    pub resolved_since_baseline: usize,
    pub baseline_age_days: u32,
}
```

#### 1.3 Watcher Entegrasyonu

**Değişiklikler:**
- `sync_guardian_logs()` fonksiyonuna baseline kontrolü ekle
- Her critique için `finding_id` hesapla (deterministik hash)
- `critiques.json` ve `critiques.md`'ye `finding_id` alanı ekle

**Yeni Dosya:** `.guardian/baseline.json`
- Kullanıcı "Set Baseline" dediğinde oluşturulur
- Otomatik oluşturma opsiyonu (ilk scan sonrası)

#### 1.4 UI Değişiklikleri (React)

**Monitor View:**
- "Set Baseline" butonu (üst toolbar)
- Filtre: "Show All" | "New Since Baseline" | "Resolved" (toggle)
- Badge: "+3 new since baseline" (renkli indicator)
- Baseline durum kartı: "Baseline: 3 days old | 12 active | 3 new | 1 resolved"

**Finding List:**
- Her bulgu yanında ikon: 🆕 (new) | ✅ (resolved) | ⚪ (active)
- Sıralama: New önce, sonra severity

### Test Plan
1. **Unit Test:** Baseline read/write, finding_id deterministik
2. **Integration:** Eski bulgular filtrelendi mi?
3. **E2E:** Baseline set et -> yeni bulgu ekle -> sadece yeni göster

### Acceptance Criteria
- [x] Baseline oluşturulabiliyor
- [x] Eski bulgular "new" olarak işaretlenmiyor
- [x] Rules değişince baseline invalid sayılıyor

---

## v1.2.3 Quality-First (C + A) — Phase 1: Ollama `localhost` Default + `127` Normalization (2026-02-17)

### Goal
Make Ollama work out-of-the-box on typical local setups and reduce the repeated `"Batch audit failed: Failed to send request to AI provider"` loop.

### Changes
- Default Ollama base URL switched to `http://localhost:11434` across desktop defaults and Settings UI.
- Removed `http://127.0.0.1:11434` from the UI + CSP allowlist. Any saved `127.0.0.1:11434` configs/envs are normalized to `localhost:11434` at runtime.
- Ollama calls now use a single base URL (no loopback retry list). If Ollama is unreachable, we surface the error clearly instead of masking it with fallbacks.
- Updated E2E selector to keep sidebar "Cost Metric" expectation stable after Details toggle changes.

### Files Touched
- `src-tauri/src/config.rs`
- `src-tauri/src/ai_client.rs`
- `src-tauri/src/semantic_index.rs`
- `src-tauri/src/provider.rs`
- `src-tauri/tauri.conf.json`
- `src/constants/index.ts`
- `src/hooks/useSettings.ts`
- `src/components/SettingsModal.tsx`
- `src/hooks/__tests__/useSettings.test.ts`
- `tests/e2e/app.spec.ts`

### Verification
- `cd guardian && npm run verify`
  - Vitest: `64/64` pass
  - Playwright: `17/17` pass
  - Rust (src-tauri): `81/81` pass
- `cd guardian/guardian-cli && cargo test` → `13/13` pass

---

## v1.2.3 UX — One-Click Apply + Undo + Guru Notifications + Reviews Fix History (2026-02-17)

### Goal
Remove the "double confirmation" UX for fixes and make remediation feel trustworthy:
- Apply fixes immediately from Monitor/Guru.
- Support a safe Undo (per-file last fix).
- Make Guru replies discoverable (toast + sidebar badge).
- Make Reviews useful even without proposals (Fix History panel).

### Changes
- Backend (Tauri):
  - New commands:
    - `apply_fix_now(file_path, new_content, root)` (writes the file immediately)
    - `undo_fix(file_path, root)` (restores the per-file backup)
    - `get_fix_history(root)` (lists applied fixes with Undo available)
  - New workspace storage: `.guardian/undo/`
    - Per-file last backup: `.guardian/undo/<sha256(rel_path)>.bak`
    - Index: `.guardian/undo/index.json`
  - Safety guardrails:
    - Rejects obvious chat/tool-call transcripts (e.g. ``````, `<invoke`, `tool_call`, `<minimax:`) to avoid corrupting files.
    - `patcher` path security hardened for macOS `/var` vs `/private/var` canonicalization edge case.
- Frontend (Desktop):
  - Monitor "FIX / APPLY THIS FIX" calls `apply_fix_now` and shows a success toast with an **Undo** action.
  - After apply, the Monitor fix button toggles to **UNDO** for that file (one-click revert).
  - Guru "Confirm & Apply" uses the same `apply_fix_now` path (shared Undo behavior).
  - Guru unread notifications:
    - When a Guru reply arrives and user is not on the Guru tab: toast `Guru reply ready.`
    - Sidebar shows a red badge count on the Guru tab.
    - Collapsed sidebar does not render a `0` badge (only shows when count > 0).
    - Works reliably even if you navigate away while the Guru request is still in-flight (reply callback uses a stable ref).
  - Reviews tab:
    - Added "Applied Fixes (Undo Available)" panel (Fix History) above Fix Proposals.
    - Keeps Fix Proposals as an optional, advanced workflow.

### Files Touched
- `src-tauri/src/undo.rs` (new)
- `src-tauri/src/lib.rs`
- `src-tauri/src/patcher.rs`
- `src/components/CritiqueAccordionRow.tsx`
- `src/components/ChatView.tsx`
- `src/components/layout/ControlSidebar.tsx`
- `src/components/layout/MainWorkspace.tsx`
- `src/hooks/useToast.ts`
- `src/components/Toast.tsx`
- `src/types/index.ts`
- `src/__tests__/App.test.tsx`
- `src/components/__tests__/CritiqueAccordionRow.test.tsx`

### Verification
- `cd guardian && npm run verify`
  - Vitest: `64/64` pass
  - Coverage gate: OK
  - Playwright: `17/17` pass
  - Rust (src-tauri): `81/81` pass
- `cd guardian/guardian-cli && cargo test` → `13/13` pass

---

## v1.2.3 Quality-First (C + A) — Phase 2: Fingerprint v2 (mtime/bytes) Skip-Without-Read (2026-02-17)

### Goal
Speed up repeated scans by skipping unchanged files *without reading file contents* (lower IO, lower CPU, fewer downstream AI calls).

### Changes
- `file_fingerprints` schema extended with `mtime_ms` + `bytes` and automatic, idempotent migration on startup.
- Watcher now checks `mtime_ms + bytes` first and skips unchanged files without `read_to_string` (unless `GUARDIAN_STRICT_HASH=1`).
- Fingerprints are upserted after successful audits (keeps previous behavior of `last_audit_time` meaning "audited").

### New Config (Optional)
- `GUARDIAN_STRICT_HASH=1` forces hash-based auditing (disables skip-without-read) for edge-case file systems.

### Files Touched
- `src-tauri/src/storage/mod.rs`
- `src-tauri/src/watcher.rs`

### Verification
- `cd guardian && npm run verify`
  - Vitest: `64/64` pass
  - Playwright: `17/17` pass
  - Rust (src-tauri): `75/75` pass
- `cd guardian/guardian-cli && cargo test` → `13/13` pass

---

## v1.2.3 Quality-First (C + A) — Phase 3: Initial Scan Worker Pool + Backpressure (2026-02-17)

### Goal
Remove the initial-scan "spawn storm" and the artificial `20ms` per-file sleep, while keeping CPU/RAM stable via bounded queues.

### Changes
- Initial scan now pushes file paths into a bounded queue and processes them with a fixed worker pool.
- Backpressure is enforced by the channel capacity; scan does not outrun audit workers.
- Removed `std::thread::sleep(Duration::from_millis(20))` from the initial scan loop.
- Added `GUARDIAN_FS_WORKERS` (optional) to override worker count (default derives from `available_parallelism`, clamped to `2..=8`).

### Files Touched
- `src-tauri/src/watcher.rs`

### Verification
- `cd guardian && npm run verify`
  - Vitest: `64/64` pass
  - Playwright: `17/17` pass
  - Rust (src-tauri): `75/75` pass
- `cd guardian/guardian-cli && cargo test` → `13/13` pass
- [x] UI'da filtreleme çalışıyor

---

## v1.2.3 Quality-First (C + A) — Phase 4: Project Intent Pack (Thorough Quality) (2026-02-17)

### Goal
Improve audit and Guru answer quality by injecting a bounded, redacted "Project Intent Pack" that summarizes workspace intent + architecture + dependencies + scope metadata.

### Changes
- Refactored `ProjectContext` indexing to be scan-profile-aware and closer to real watcher scope:
  - Uses `ignore::WalkBuilder` + `guardian_scan_policy::classify_path`.
  - Skips sensitive files (redaction gate) from the intent pack/index.
- Added dependency extraction:
  - `package.json` dependencies/devDependencies (names only).
  - `Cargo.toml` dependencies/dev-dependencies/build-dependencies (lightweight parsing).
- Added intent discovery + redaction:
  - Reads a prioritized, small set of docs (`AGENTS.md`, `.agent/*`, `README.md`, etc.).
  - Always runs `mask_inline_secrets`, truncates to bounded size.
- Added in-memory intent pack cache (TTL=5 minutes) to keep Guru responsive.
- Watcher now builds the intent pack on startup and injects it into batch audits:
  - `AiClient::analyze_batch_with_intent(...)` prepends the pack to the batch prompt.
- Guru now prepends the same intent pack to its RAG context (better project-aware answers).
- `get_project_context` now respects the persisted `scan_profile` config for consistency.

### Files Touched
- `src-tauri/src/context.rs`
- `src-tauri/src/watcher.rs`
- `src-tauri/src/ai_client.rs`
- `src-tauri/src/lib.rs`

### Verification
- `cd guardian && npm run verify`
  - Vitest: `64/64` pass
  - Playwright: `17/17` pass
  - Rust (src-tauri): `78/78` pass
- `cd guardian/guardian-cli && cargo test` → `13/13` pass
- Note (local): Playwright browsers were missing in cache once; `npx playwright install` was required to restore E2E execution.

---

## v1.2.3 Quality-First (C + A) — Phase 5: Mixed-Gate Triage (Smart Scope, Noise Reduction) (2026-02-17)

### Goal
Reduce low-signal AI calls in `extended/full` while keeping real security/high-risk findings visible. Source code remains "always-audit"; non-source surfaces are audited only when triage detects meaningful risk signals.

### Changes
- Added `triage.rs` (cheap heuristics + deterministic scoring):
  - Produces `risk_score (0-100)`, `signals[]`, `file_kind` (`source|infra|doc|lock|test|other`).
  - Signals include: secret/token patterns, `curl | sh`, `--no-sandbox`, privileged flags, `chmod 777`, root-user Docker patterns, etc.
- Mixed-gate policy (profile-aware):
  - `source`: unchanged behavior (policy already filters heavily).
  - `extended`: non-source is audited only if `risk_score >= 30`.
  - `full`: docs/tests audited only if `risk_score >= 50`; other non-source audited if `risk_score >= 30`.
- Watcher integration:
  - Triage runs after content read (only for changed files) and gates batch enqueue.
  - Low-signal files still upsert fingerprints (mtime/bytes + hash + risk_score) so "unchanged skip-without-read" stays effective.
  - When a file is audited, the diff-focused context is prefixed with a short triage header (kind/risk/signals) to keep the LLM focused.
- Fingerprint updates now persist the triage `risk_score` instead of always writing `0`.

### Files Touched
- `src-tauri/src/triage.rs` (new)
- `src-tauri/src/watcher.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/ai_client.rs` (warning cleanup)
- `src-tauri/src/context.rs` (warning cleanup)

### Verification
- `cd guardian && npm run verify`
  - Vitest: `64/64` pass
  - Playwright: `17/17` pass
  - Rust (src-tauri): `81/81` pass
- `cd guardian/guardian-cli && cargo test` → `13/13` pass

---

## v1.2.3 Quality-First (C + A) — Phase 6: Verification + Version Bump + Release Notes (2026-02-17)

### Goal
Prepare the repo for `1.2.3` release: version sync + short user-facing changelog + full verification.

### Changes
- Version bumped to `1.2.3` (desktop + Tauri):
  - `package.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`
- Changelog updated with a short, user-value summary for `1.2.3`:
  - `CHANGELOG.md`

### Verification
- `cd guardian && npm run verify`
  - Vitest: `64/64` pass
  - Playwright: `17/17` pass
  - Rust (src-tauri): `81/81` pass
- `cd guardian/guardian-cli && cargo test` → `13/13` pass

### Post-Phase UX Tweaks (2026-02-17)
- Provider (Ollama) base URL selector no longer exposes the `127.0.0.1:11434` loopback option; the UI stays aligned to `http://localhost:11434`.
- Provider "Test Connection" success is now a short top-right toast: `Connection OK.` (no verbose model list text), auto-hides after 3 seconds.

### Phase 1 - Implemented (2026-02-09)
- Baseline schema + manager eklendi: `src-tauri/src/baseline/manager.rs`
  - `.guardian/baseline.json` yazma/okuma
  - Rules hash değişince baseline invalid
- Deterministik `finding_id` (Phase 1 v1): `sha256(guardian-v1::<severity>|file_path||rules_hash)`
  - `Critique` payload'ına `finding_id` eklendi
- Watcher output genişletildi:
  - `.guardian/critiques.md` JSON satırlarına `finding_id` eklendi
  - `.guardian/critiques.json` snapshot eklendi (protocol_version=1)
- Tauri commands eklendi:
  - `get_baseline`, `create_baseline`, `clear_baseline`, `get_baseline_status`
- UI (Desktop) baseline panel + filtre eklendi:
  - "Set Baseline" + "Reset"
  - View: All | New | Resolved
  - Finding satırlarında NEW/ACTIVE badge
- Tests:
  - `cd src-tauri && cargo test` (pass)
  - `npm test` (pass)

---

## Phase 2: CI/CD ve GitHub Entegrasyonu (2 Hafta)

### Hedef
Guardian'ı CI/CD pipeline'ına entegre etmek. PR'lerde otomatik kontrol ve raporlama.

### Neden Öncelikli?
- "Professional tool" imajı için şart
- Takım kullanımı için kritik
- Baseline sistemiyle birlikte çok güçlü olur

### Implementation

#### 2.1 guardian-cli (Rust Binary)

**Yeni Crate:** `guardian-cli`

**Komutlar:**
```bash
# Temel scan
guardian-cli scan --root ./my-project

# Output formatları
guardian-cli scan --root ./my-project --format json --out report.json
guardian-cli scan --root ./my-project --format sarif --out report.sarif
guardian-cli scan --root ./my-project --format markdown --out report.md

# Baseline ile
guardian-cli scan --root ./my-project --baseline ./.guardian/baseline.json

# Exit codes
# 0: Success (no new critical findings)
# 1: New critical findings found
# 2: Error/invalid config
```

**Config (Environment Variables):**
```bash
GUARDIAN_PROVIDER=anthropic  # veya openai
GUARDIAN_API_KEY=sk-xxx
GUARDIAN_MODEL=claude-3-5-sonnet
GUARDIAN_BASELINE_PATH=./.guardian/baseline.json  # opsiyonel
```

**Mock Mode:**
```bash
GUARDIAN_MOCK=1 guardian-cli scan  # Test için sabit sonuç
```

**Dağıtım Stratejisi:**
1. **Pre-built Binary:** GitHub Releases'te `guardian-cli-linux-x64`, `guardian-cli-macos-x64`, `guardian-cli-macos-arm64`
2. **npm Wrapper:** `npm install -g @guardian/cli` (binary'i indirir)
3. **GitHub Action:** Composite action veya Docker image

**CI Performans:**
- Binary indirme: ~5-10 saniye
- `cargo install`: ~2-3 dakika (kaçınılmalı)
- Öneri: `guardian-cli` repo'ya dahil edilebilir veya action tarafından cached indirilir
```bash
GUARDIAN_MOCK=1 guardian-cli scan  # Test için sabit sonuç
```

#### 2.2 GitHub Actions

**Dağıtım Stratejisi:**

**Option A: Composite Action (Repo içinde)**
`.github/actions/guardian/action.yml` dosyası olarak bu repo'da tutulur.

**Option B: Binary Download (Hızlı)**
```yaml
- name: Download Guardian CLI
  run: |
    curl -sSL https://github.com/senoldogann/Guardian/releases/download/cli-v1.0.0/guardian-cli-linux-x64 -o guardian-cli
    chmod +x guardian-cli
    
- name: Run Guardian
  run: ./guardian-cli scan --root . --baseline .guardian/baseline.json
  env:
    GUARDIAN_PROVIDER: anthropic
    GUARDIAN_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**Kullanım Örneği:**
```yaml
name: Guardian Security Scan

on: [pull_request]

jobs:
  guardian:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Download Guardian CLI
        run: |
          curl -sSL https://github.com/senoldogann/Guardian/releases/download/cli-v1.0.0/guardian-cli-linux-x64 -o guardian-cli
          chmod +x guardian-cli
      
      - name: Run Guardian
        run: ./guardian-cli scan --root . --format sarif --out guardian-report.sarif
        env:
          GUARDIAN_PROVIDER: anthropic
          GUARDIAN_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: guardian-report.sarif
```

**PR Comment (Opsiyonel):**
- Sadece "new since baseline" ve "critical" bulgular
- Collapsible detaylar
- Baseline oluşturma talimatları

#### 2.3 SARIF Formatı

**Mapping (v1 netleştirildi):**
```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [{
    "tool": {
      "driver": {
        "name": "Guardian",
        "version": "1.0.0"
      }
    },
    "results": [{
      "ruleId": "security-vulnerability",
      "level": "error",  // mapping: critical->error, warning->warning, info->note
      "message": { "text": "Raw SQL detected..." },
      "locations": [{
        "physicalLocation": {
          "artifactLocation": { "uri": "src/db.rs" },
          "region": { 
            "startLine": 1  // Şimdilik her zaman 1, v2'de gerçek line
          }
        }
      }]
    }]
  }]
}
```

**RuleId Mapping:**
- `ruleId` = internal rule_id (deterministic)
- Eğer rule_id yoksa: `guardian-unknown-rule`

**Severity Mapping:**
- critical -> error
- warning -> warning
- info -> note

#### 2.4 Pre-commit Hook (Opsiyonel)

**Dosya:** `.pre-commit-config.yaml` örneği

```yaml
repos:
  - repo: local
    hooks:
      - id: guardian
        name: Guardian Security Check
        entry: guardian-cli scan
        language: system
        pass_filenames: false
        always_run: true
```

### Test Plan
1. **Unit:** CLI arg parsing
2. **Integration:** Mock provider ile scan
3. **E2E:** GitHub Actions workflow test repo'sunda
4. **Manual:** Gerçek PR'da deneme

### Acceptance Criteria
- [x] guardian-cli binary derleniyor
- [x] JSON ve SARIF output doğru formatta
- [x] GitHub Actions'da çalışıyor
- [x] Baseline ile birlikte kullanılabiliyor
- [x] Exit code'lar doğru çalışıyor

### Phase 2 - Implemented (2026-02-09)
- `guardian-cli/` eklendi (CI-friendly scan + JSON/SARIF/Markdown output + baseline + exit codes).
- CI portability fix:
  - `rules_hash` artık absolute path'e bağlı değil (desktop + CLI aynı deterministik fingerprint'i üretir).
  - Baseline schema `schema_version=2` oldu (eski `schema_version=1` baseline'lar reset edilmelidir).
  - `finding_id` artık workspace-root'a göre normalize edilmiş **relative file path** kullanır (desktop baseline ↔ CLI scan eşleşir).
- GitHub Integration:
  - Composite action: `.github/actions/guardian/action.yml`
  - Workflow (SARIF upload): `.github/workflows/guardian-scan.yml`
- Repo hygiene: yanlışlıkla commit edilen `guardian-cli/target/` artifact'leri kaldırıldı ve `target/` ignore eklendi.
- Small follow-ups:
  - SARIF `$schema` URL artık resmi OASIS endpoint'ini kullanıyor.
  - Email redaction regex'i düzeltildi ve unit test eklendi.
  - GitHub composite action input validation eklendi (format/max_files/max_file_bytes/offline/mock).
- Tests:
  - `cd src-tauri && cargo test` (pass)
  - `cd guardian-cli && cargo test` (pass)

---

## Phase 3: Advanced Redaction ve Audit (1-2 Hafta)

### Hedef
Phase 0'daki minimum redaction'ı genişletmek, UI'da transparanlık sağlamak, detaylı audit trail oluşturmak.

### Neden Şimdi?
- CI entegrasyonu öncesi tam güvenlik kritik
- Kullanıcıya "ne gittiğini gösterme" transparanlığı
- Production-ready olmak için şart

### Implementation

#### 3.1 Advanced Context Redaction (Phase 0'ın Genişletilmesi)

**Genişletilen Modül:** `src-tauri/src/redaction/gate.rs`

**Hassas Dosya Pattern'leri:**
```rust
const SENSITIVE_PATTERNS: &[&str] = &[
    ".env",
    ".env.local",
    ".env.production",
    ".npmrc",
    ".pypirc",
    ".htpasswd",
    "config.json",
    "secrets.yaml",
    "secrets.yml",
    ".credentials",
    "credentials.json",
    ".key",
    ".pem",
    ".p12",
    ".pfx",
    "id_rsa",
    "id_ed25519",
    "credentials",
    "secrets",
    ".secret",
    "docker-compose.override.yml",
    "docker-compose.override.yaml",
];

const SENSITIVE_EXTENSIONS: &[&str] = &[
    "key", "pem", "p12", "pfx", "pkcs12", "jks", "keystore", "cer", "crt", "der"
];
```

**İçerik Taraması:**
```rust
pub fn contains_secrets(content: &str) -> Vec<SecretMatch> {
    // Regex'ler:
    // - API Key: sk-[a-zA-Z0-9]{48}
    // - OpenAI Project Key: sk-proj-...
    // - Anthropic Key: sk-ant-...
    // - GitHub Tokens: ghp_... / github_pat_...
    // - AWS Key: AKIA[0-9A-Z]{16}
    // - JWT: eyJ...eyJ...<sig>  (3 parca)
    // - Private Key: -----BEGIN (RSA | OPENSSH | EC) PRIVATE KEY-----
    // - DB URL: postgres://.*:.*@ | mysql://.*:.*@
    // - KV secrets: api_key|token|secret|password = "..."
    // - PII: email / phone
}
```

**Redaction Mantığı:**
- Dosya adı hassas mı? -> Hiç analiz etme, "[REDACTED - sensitive file]" olarak geç
- İçerik secret içeriyor mu? -> Secret pattern'leri `[REDACTED]` ile değiştir
- Dosya büyük mü? (config `max_file_bytes`) -> Analiz etme (skip)
- Prompt'a girecek içerik: satır/karakter limitleri ile truncate edilir (config `max_content_lines`, `max_content_chars`)

#### 3.2 UI: Outbound Preview

**Yeni Component:** `AIContextPreview`

**Desktop UI'da:**
- Sidebar'da "AI Context" sekmesi
- Gönderilecek payload'ı göster (truncated + masked)
- "Sensitive content redacted" uyarısı
- Token sayacı (tahmini)

**Not (Planlanan):**
- Chat View'da her AI mesajı öncesi "Context contains N files, M redacted" bilgisi (henüz eklenmedi)

#### 3.3 Audit Log

**Dosya:** `.guardian/history.jsonl` (append-only)

**Migration Notu:** Mevcut history formatı farklı. Phase 3'te mevcut loglar `history.v0.jsonl` olarak archive edilecek, yeni schema `history.jsonl` olarak başlayacak. Watcher yeni formatı kullanacak.

**Yeni Schema (v1):**
```json
{
  "timestamp": "2026-02-09T10:00:00Z",
  "event": "scan" | "ai_request" | "fix_applied" | "baseline_created",
  "finding_id": "sha256...",  // varsa
  "file_path": "src/main.rs", // redacted değilse
  "model": "claude-3-5-sonnet",
  "provider": "anthropic",
  "redacted": true,  // secret içeriyorsa
  "tokens_in": 1500,
  "tokens_out": 250,
  "details": { "severity": "critical" }
}
```

**Rotasyon:** 10MB sonra archive (`history.<timestamp>.jsonl`)

#### 3.4 Güvenlik Ayarları (Settings)

**Not:** Phase 3'te redaction/masking davranisi varsayilan olarak aktif. UI ayarlari (toggle/slider) bir sonraki iterasyonda eklenecek.

Bu ayarlar `v1.2.0` backlog'una taşınmıştır (bkz. `v1.2.0 Yapilacaklar Listesi`).

### Test Plan
1. **Unit:** Hassas dosya tespiti
2. **Integration:** Secret içeren dosya analiz edilmiyor mu?
3. **E2E:** UI'da redaction gösteriliyor mu?
4. **Security:** History log'a secret yazılmıyor mu?

### Acceptance Criteria
- [x] .env (ve diger hassas dosyalar) AI'a gitmiyor
- [x] API key/JWT/GitHub token iceren icerik `[REDACTED_*]` olarak maskeleniyor
- [x] History log tutuluyor (v1 schema + migration + rotation)
- [x] Kullanıcı outbound context'i (masked+truncated) UI'da gorebiliyor

### Phase 3 - Implemented (2026-02-09)
- Advanced redaction gate genisletildi: `src-tauri/src/redaction/gate.rs`
  - Hassas dosyalar skip: `.npmrc`, `.pypirc`, `.htpasswd`, `docker-compose.override.*`, `.secret`, `*.crt/*.cer/*.der` vb.
  - Inline masking: OpenAI/Anthropic/GitHub token, AWS key, DB URL, private key block, JWT, KV secrets, email/phone
- Outbound AI context snapshot eklendi (UI preview):
  - Backend snapshot + event: `src-tauri/src/watcher.rs` (`guardian:ai-context`)
  - Backend query: `src-tauri/src/lib.rs` (`get_last_ai_context`)
  - UI: `src/components/AIContextPreview.tsx`, `src/App.tsx`, `src/types/index.ts`
- Audit log (append-only) yeni schema + migration/rotation: `src-tauri/src/history_logger.rs`
  - v0 tespiti: `"critique"` gorulurse `history.v0*.jsonl` olarak archive
  - Rotation: 10MB uzeri `history.<timestamp>.jsonl`
  - Secret/diff icerigi loglanmaz; sadece metadata (counts/severity vb.)
- Tests:
  - `cd src-tauri && cargo test` (pass)
  - `npm test` (pass)

### Phase 3 - Follow-up (2026-02-09)
- PII redaction iyilestirmeleri: `src-tauri/src/redaction/gate.rs`
  - Telefon masking: E.164 (+...), TR mobil (05xx ...), NANP ((415) 555-2671 gibi) kapsami eklendi
  - Unicode email redaction: Turkce karakterler ve IDN/punycode senaryolari icin test eklendi
- Not: Unchanged file'lar zaten hash kontrolu ile audit edilmeden atlanir (tekrar redaction maliyeti dusuk).

---

## Phase 4: Agent Protocol Stabilizasyonu (2-3 Hafta)

### Hedef
Mevcut `.guardian/` protokolünü stabilize etmek ve AI için makine okunur `critiques.json` eklemek. **Mevcut sistemi iyileştirme, sıfırdan yazma değil.**

### Mevcut Durum (Zaten Çalışıyor)
- `agent_queue.jsonl` - watcher.rs zaten üretiyor
- `history.jsonl` - audit log zaten var
- `STALL` - kritik durumda zaten yazılıyor
- `critiques.md` - insan okunur format zaten var

### Eklenecek
- `critiques.json` - AI için makine okunur snapshot
- `AGENT_INSTRUCTIONS.md` - AI kuralları ve protokol dokümantasyonu
- Finding ID stabilizasyonu (AI model değişse bile aynı issue aynı ID)

### Implementation

#### 4.1 Protocol Schema v1

**Dosyalar:** (hepsi `.guardian/` altında)

1. **`critiques.json`** - Tam snapshot (AI için makine okunur)
```json
{
  "protocol_version": 1,
  "timestamp": "2026-02-09T10:00:00Z",
  "workspace_id": "sha256(/path)",
  "rules_hash": "sha256(...)",
  "critiques": [
    {
      "finding_id": "sha256(rule_id|file_path|location|rules_hash)",
      "file_path": "src/db.rs",
      "severity": "critical",
      "category": "security",
      "rule_id": "sql-injection-raw",
      "message": "Raw SQL detected",
      "line": null,
      "content_hash": "sha256(file content)",
      "is_new": true,
      "suggestion": "Use parameterized queries",
      "confidence": 0.92
    }
  ]
}
```

2. **`agent_queue.jsonl`** - Append-only event log
```json
{"timestamp":"...","event":"critique","finding_id":"...","file_path":"..."}
{"timestamp":"...","event":"clear","finding_id":"..."}
```

3. **`AGENT_INSTRUCTIONS.md`** - AI için talimatlar
```markdown
# Guardian Agent Integration

## Okunacak Dosyalar
- critiques.json: Mevcut bulgular
- agent_queue.jsonl: Yeni event'ler (tail -f ile izle)

## Kurallar
1. critiques.json'daki bulguları oku
2. Severity'ye göre önceliklendir (critical > warning > info)
3. is_new=true olanları önce ele al
4. File content'i doğrudan okumaya çalışma, Guardian'ın summary'sini kullan
5. Fix önerisi sunacaksan, mevcut kodu koruyarak minimal değişiklik yap

## Yasaklar
- .guardian/* dosyalarını değiştirme
- Secret/env dosyalarını okuma
- Otomatik commit/push yapma
- Derleme hatası oluşturacak değişiklikler önerme
```

#### 4.2 Mevcut Sistemi Stabilize Etme

**Zaten Var Olan:**
- `agent_queue.jsonl` - watcher zaten üretiyor
- `history.jsonl` - audit log zaten var
- `STALL` - kritik durumda zaten yazılıyor
- `critiques.md` - insan okunur format zaten var

**Eklendi / Stabilize Edildi:**
- `critiques.json` - AI icin makine okunur snapshot (relative file_path)
- `AGENT_INSTRUCTIONS.md` - `.guardian/` icine bootstrap'ta otomatik yazilir (yoksa)
- Finding ID'ler deterministik (AI message/model degisse bile sabit, rules_hash + rel_path bazli)

#### 4.3 Queue Yönetimi

**Rotasyon:**
- `agent_queue.jsonl` > 1MB ise `agent_queue.<timestamp>.jsonl` olarak archive
- Max 5 archive tut, eskileri sil

**Tail desteği:**
- AI agent'ler `tail -f .guardian/agent_queue.jsonl` ile real-time izleyebilir

### Test Plan
1. **Unit:** critiques.json schema validasyonu
2. **Integration:** Event'ler doğru yazılıyor mu?
3. **Manual:** Cursor/Copilot ile test (AI critiques.json'u okuyabiliyor mu?)

### Acceptance Criteria
- [x] critiques.json AI tarafından okunabilir
- [x] agent_queue.jsonl real-time güncelleniyor
- [x] Finding ID'ler deterministik
- [x] Archive rotasyonu çalışıyor

### Phase 4 - Implemented (2026-02-09)
- `.guardian/` protocol stabilize edildi: `src-tauri/src/watcher.rs`
  - `critiques.json` ve `critiques.md` icindeki `file_path` artik relative (portable)
  - `agent_queue.jsonl` event payload minimalize edildi (message/diff yok), `finding_id` uygun oldugunda eklenir
  - Queue rotation: >1MB `agent_queue.<timestamp>.jsonl`, max 5 archive
  - Bootstrap: `.guardian/AGENT_INSTRUCTIONS.md` (yoksa) olusturulur
- Tests:
  - `cd src-tauri && cargo test` (pass)
  - `npm test` (pass)

---

## Phase 5: Fix Proposal & Review Queue (3-4 Hafta)

### Hedef
AI veya kullanıcının fix önerilerini güvenli bir şekilde review edip uygulamak. **Hiçbir fix otomatik uygulanmayacak**, her zaman review gerekecek.

### Neden "Review Required"?
- Güvenlik: AI'nin önerdiği kod zararlı olabilir
- Kalite: Yanlış fix daha kötü olabilir
- Kontrol: Kullanıcı her zaman son kararı verir

### Implementation

#### 5.1 Fix Proposal Sistemi

**Yeni Dosya (Karar):** `.guardian-proposals/fix_proposals.jsonl`

**Not:** `watcher.rs` `.guardian/` altini ignore ettigi icin fix proposal queue `.guardian/` disina alindi.
Legacy destek: Eger `.guardian/fix_proposals.jsonl` varsa, Guardian bunu `.guardian-proposals/fix_proposals.jsonl` altina migrate eder.

**Schema:**
```json
{
  "proposal_id": "uuid",
  "timestamp": "2026-02-09T10:00:00Z",
  "finding_id": "sha256(...)",
  "file_path": "src/db.rs",
  "status": "pending",
  "proposed_by": "ai-agent",
  "original_content_hash": "sha256(...)",
  "suggestion": "Use parameterized queries",
  "proposed_content": "// TAM DOSYA ICERIGI\n// Mevcut patcher.rs full-file-content bekliyor\n// Bu format diff yerine güvenli ve deterministic\nuse std::...;\n// ... tüm dosya ...",
  "confidence": 0.89,
  "reasoning": "Prevents SQL injection by using prepared statements"
}
```

**Status Update (Append-only):**
```json
{"type":"status","timestamp":"...","proposal_id":"uuid","status":"review_requested|rejected|applied","note":null,"actor":"user"}
```

**Önemli:** Mevcut `patcher.rs` full-file-content beklediği için, proposal da **tam dosya içeriği** sunmalı. Diff parçası yerine, önerilen yeni dosyanın tam hali. Bu sayede:
1. Patch çakışması riski azalır
2. Patcher mevcut güvenlik kontrollerini kullanır
3. Kullanıcı review'da tam dosyayı görebilir

**Akış:**
1. AI `fix_proposals.jsonl`'ye proposal yazar
2. Watcher bunu tespit eder ve UI'ya `guardian:fix-proposals` event'i gonderir
3. UI'da `Reviews` ekraninda pending proposal listesi gorunur
4. Kullanici "Request Review" der -> `apply_fix` ile Guardian review pipeline baslar
5. Guru Chat'te "Verified Safe" / "Guardian Auto-Corrected" sonucu gelir
6. Kullanici **Confirm & Apply** ile `confirm_fix` calistirir (auto-apply yok)
7. (Opsiyonel) Proposal status `applied`/`rejected` olarak isaretlenir

#### 5.2 Watcher Entegrasyonu

**Değişiklikler:**
- `.guardian-proposals/fix_proposals.jsonl`'i izle (watcher audit etmez)
- Snapshot cache + event: `guardian:fix-proposals`
- Tauri commands:
  - `get_fix_proposals` (refresh/read)
  - `set_fix_proposal_status` (append-only status update)

#### 5.3 UI - Review Paneli

**Yeni View:** `Reviews` (Sidebar)

**İşlemler:**
- **Request Review:** Guardian AI review'u baslatir (son karar yine kullanicida)
- **Reject / Mark Applied:** JSONL status guncellemesi (append-only)
- **Final Apply:** Guru Chat'te `Confirm & Apply`

#### 5.4 Patcher Güvenlik Kontrolleri

**Mevcut `patcher.rs` kontrolleri (aktif):**
- Path traversal reject
- Symlink component reject
- Workspace root disina cikma reject
- Diff payload reject (full-file-content zorunlu)

**Not (Planlanan):**
- Proposed content icinde secret pattern block (opsiyonel, false-positive riski var)
- `.guardian/*` dosyalarina patch uygulanmasini engelle

#### 5.5 Git Entegrasyonu (Opsiyonel)

**Eğer git repo ise:**
- Patch uygulanmadan önce `git stash` öner
- Uygulandıktan sonra `git diff` göster
- Commit mesajı öner: "fix(guardian): SQL injection in src/db.rs"

### Test Plan
1. **Unit:** Proposal validation (hash mismatch, path traversal)
2. **Integration:** Proposal -> Review -> Apply akışı
3. **Security:** Zararlı proposal'ların engellenmesi
4. **E2E:** UI'dan review ve apply

### Acceptance Criteria
- [x] Proposal dosyası oluşturulabiliyor
- [x] Review UI'sı çalışıyor
- [x] Patch güvenli bir şekilde uygulanıyor
- [x] Hiçbir fix otomatik uygulanmıyor
- Git entegrasyonu (opsiyonel) `v1.2.0` backlog'una taşındı (bkz. `v1.2.0 Yapilacaklar Listesi`).

### Phase 5 - Implemented (2026-02-09)
- Fix proposal queue eklendi (append-only JSONL):
  - `.guardian-proposals/fix_proposals.jsonl` (migrate: legacy `.guardian/fix_proposals.jsonl`)
  - Status updates: `review_requested|rejected|applied`
- Backend:
  - Watcher snapshot cache + event: `src-tauri/src/watcher.rs` (`guardian:fix-proposals`)
  - Commands: `get_fix_proposals`, `set_fix_proposal_status`: `src-tauri/src/lib.rs`
- UI:
  - Yeni sidebar view: `Reviews`: `src/App.tsx`
  - Component: `src/components/FixProposalsView.tsx`
- Tests:
  - `cd src-tauri && cargo test` (pass)
  - `npm test` (pass)

---

## Phase 6: İleri Seviye Özellikler (Gelecek - Düşük Öncelik)

### 6.1 Local Vector DB
- Workspace büyüdüğünde semantic search
- sqlite-vec veya benzeri
- "Buna benzer kod var mı?" sorguları

### 6.2 AI Context Optimizasyonu
- "Full file content" yerine "diff" odaklı
- Token tasarrufu
- Summary compression

### 6.3 guardian.lock
- Rules versiyonlama
- Takım için zorunlu kurallar
- "Bu proje Guardian v1.2 ile taranıyor"

### 6.4 Gerçek Zamanlı İşbirliği
- Çoklu kullanıcı senkronizasyonu
- WebSocket/SSE üzerinden bulgu paylaşımı
- Takım dashboard'u

### 6.5 Otomatik Self-Healing (Phase 5'ten Sonra Düşünülebilir)
- SADECE yüksek confidence + düşük risk durumlarında
- Her zaman review queue'ya düşer
- Kullanıcı "Auto-apply safe fixes" ayarı açarsa
- **Kritik güvenlik kontrolleri:**
  - Dosya hash'i değişmemiş mi?
  - Test'ler geçiyor mu? (cargo test öncesi)
  - Derleme hatası yok mu?

### Phase 6 - Started (2026-02-09)

#### 6.1 Local Vector DB (v1 semantic bootstrap)
- Local semantic vector storage eklendi (`.guardian/memory.db`):
  - `semantic_vectors` tablosu: `workspace`, `file_path`, `content_hash`, `critique_id`, `severity`, `embedding_json`, `embedding_dim`, `source_mode`, `preview`
  - Index: `idx_semantic_workspace_severity (workspace, severity, created_at DESC)`
- 6.2 diff cache + baseline finding kimlikleriyle entegrasyon:
  - Watcher pipeline içinde critique + context metni embedding'e çevrilip indexleniyor
  - `finding_id` / `content_hash` ile tekrar eden bulgulara karşı deterministik bağ kuruluyor
- Semantic recall use-case'i aktive edildi:
  - Yeni kritik bulguda geçmiş kritikler için benzerlik araması yapılıyor
  - Eşik üstü eşleşmeler için `guardian:info` event'i yayınlanıyor
- Guru chat semantic araması eklendi:
  - `"benzer" / "similar" / "semantic" / "critical pattern"` gibi sorgular similarity search tetikliyor
  - Sonuçlar Guru context'ine `Semantic Similarity Matches` bloğu olarak ekleniyor
- Embedding provider stratejisi (Phase 6.1 v1):
  - Varsayılan: OpenAI `text-embedding-3-small`
  - Opsiyonel local model: Ollama `nomic-embed-text`
  - Offline/hatada fallback: deterministik local hash embedding
- sqlite-vec native vector KNN index entegrasyonu (6.1.1)
  - `sqlite-vec` Rust binding eklendi (`src-tauri/Cargo.toml`)
  - `semantic_vectors_ann` virtual table: `vec0(embedding float[256])`
  - Primary path: ANN KNN search (`MATCH + k`) + distance tabanli similarity mapping
  - Fallback path: ANN hata/uyumsuzlukta mevcut Rust cosine scan otomatik devreye girer
- HNSW/IVF seviye ANN stratejisi (6.1.2 - opsiyonel) `v1.2.0` backlog'una taşındı.

#### 6.2 AI Context Optimizasyonu (v1 diff-focused)
- Watcher AI context üretimi diff-odaklı hale getirildi:
  - Son başarılı audit snapshot'ı ile karşılaştırma
  - Değişen hunks + `+/-` satır özeti
  - İlk audit için `snapshot-compressed` fallback
- Prompt tarafı güncellendi:
  - Batch girdisi artık `Diff-Focused Context` olarak gönderiliyor
  - Model talimatı diff/snapshot sıkıştırmasını dikkate alacak şekilde genişletildi
- Token optimizasyonu:
  - Hunk limitleme (`DIFF_MAX_HUNKS`)
  - Satır/karakter bazlı truncation + summary compression
- Unit testler eklendi:
  - `diff_context_is_used_when_previous_snapshot_exists`
  - `snapshot_context_is_used_without_previous_snapshot`

#### 6.3 guardian.lock (v1 bootstrap)
- `guardian.lock` schema v1 eklendi (desktop + CLI)
- Watcher pipeline her sync'te `guardian.lock` dosyasini senkronize eder
- Tauri command'leri eklendi:
  - `get_guardian_lock_status`
  - `ensure_guardian_lock`
- `guardian-cli` lock parametreleri eklendi:
  - `--lock <path>`
  - `--lock-mode off|warn|strict` (default: `warn`)
- `guardian-cli` strict mode: `rules_hash/workspace/schema` uyumsuzlugunda scan fail
- CLI report schema'sina `guardian_lock` metadata eklendi (json + markdown)
- Rust unit testleri eklendi (desktop + CLI lock akisi)

#### 6.1 Ek Testler (semantic)
- `semantic_vector_search_returns_similar_matches` (storage)
- `semantic_vector_ann_path_handles_256d_embeddings` (sqlite-vec ANN path)
- `local_embedding_is_deterministic` (semantic index)
- `semantic_query_returns_indexed_match` (semantic retrieval)

#### Release Hazırlığı (2026-02-10)
- Migration guide hazırlandı:
  - `docs/MIGRATION_GUIDE_PHASE6.md`
  - Kapsam: `guardian.lock` v1 + baseline `schema_version=2` geçişi
- Changelog güncellendi:
  - `CHANGELOG.md` içinde Phase 4, Phase 5, Phase 6.1, 6.2, 6.3 özetleri eklendi (`[Unreleased]`)
- 6.2 token performans raporu eklendi:
  - `docs/reports/PHASE6_TOKEN_PERFORMANCE.md`
  - Ölçüm: `snapshot_tokens=1504` → `diff_tokens=127` (`-91.56%`)

#### 6.1 UX Tamamlama (Desktop Sidebar + Embedding Setup) (2026-02-10)
- Sol sidebar yeniden düzenlendi:
  - İçerik alanı kaydırılabilir hale getirildi (`overflow-y-auto`) ve launch alanı alta sabitlendi
  - Scope, istatistik, baseline, filtre ve engine bilgileri daha kompakt kart düzenine taşındı
- `REVIEWS` ve `AI CONTEXT` boş durumları görsel olarak iyileştirildi:
  - Veri yokken ilgili tab ekranında ortalanmış ikon + açıklama gösteriliyor
  - Workspace seçili değilken de her iki tab için ikonlu boş durum eklendi
- Embedding ayarlarının kullanıcı erişimi netleştirildi:
  - `Settings -> Embedding` sekmesi ile mode/model/base URL alanları aktif
  - OpenAI embedding key opsiyonel; Ollama/local kullanım senaryoları destekleniyor
  - Sidebar `Engine Status` kartına embedding mode görünürlüğü + `Setup` hızlı erişim eklendi

#### 6.1 UX Tamamlama - Tests (2026-02-10)
- `cd guardian && npm test` (pass, 11 file / 61 test)
- `cd src-tauri && cargo test` (pass, 54 test)
- `cd guardian-cli && cargo test` (pass, 7 test)
- `cd website && npm run test:run` (pass, 8 file / 107 test)
- `python3 .agent/scripts/verify_all.py` (pass)

#### 6.1 UX Iteration 2 (Filter Relocation + Setup Popups) (2026-02-10)
- Sol menudeki `Filter` alanı kaldirildi.
- `Filter` monitor ekranina tasindi:
  - Launch sonrasi merkezde floating arama kutusu olarak gorunur
  - UI cakismasini onlemek icin monitor liste alani dinamik ust bosluk alir
- Kurulum alanlarina yonlendirici bilgi popup'lari eklendi:
  - Provider Setup, API Key, Safety
  - Embedding Mode, Optional Embedding Key
  - Web Search (Tavily)

#### 6.1 UX Iteration 2 - Tests (2026-02-10)
- `cd guardian && npm test` (pass, 11 file / 61 test)
- `cd src-tauri && cargo test` (pass, 54 test)
- `cd guardian-cli && cargo test` (pass, 7 test)
- `cd website && npm run test:run` (pass, 8 file / 107 test)
- `python3 .agent/scripts/verify_all.py` (pass)

### Phase 6 - Tests (2026-02-09)
- `cd guardian && npm test` (pass)
- `cd src-tauri && cargo test` (pass)
- `cd guardian-cli && cargo test` (pass)
- `cd website && npm run test:run` (pass)

### Phase 6.1 - Tests (2026-02-10)
- `cd guardian && npm test` (pass, 11 file / 61 test)
- `cd src-tauri && cargo test` (pass, 54 test)
- `cd guardian-cli && cargo test` (pass, 7 test)
- `cd website && npm run test:run` (pass, 8 file / 107 test)
- `cd src-tauri && cargo test diff_context_reduces_token_estimate_for_localized_change -- --nocapture` (pass, benchmark)
- `python3 .agent/scripts/verify_all.py` (pass)

## v1.2.0 Yapilacaklar Listesi

### Guvenlik ve Ayarlar (Phase 3 follow-up)
- [ ] `Redact sensitive files` toggle (default: on)
- [ ] `Redact detected secrets` toggle (default: on)
- [ ] `Log AI interactions` toggle (default: on)
- [ ] `Allow AI to suggest fixes for security issues` toggle (default: off)
- [ ] `Max file size` slider (default: 100KB)

### Fix Workflow ve Git Entegrasyonu (Phase 5 follow-up)
- [ ] Git repo algilandiginda `stash -> apply -> diff` yardimci akisini ekle
- [ ] Review/apply sonrasi commit message onerisi akisini Settings ile kontrol edilebilir yap

### Semantic Search Scale-Up (Phase 6.1.2 - opsiyonel)
- [ ] sqlite-vec icin HNSW/IVF benzeri ANN stratejisini benchmark ederek kararlandir
- [ ] Büyük workspace senaryolari icin ANN recall/performance raporu ekle

### Roadmap Hygiene + Review (2026-02-10)
- Phase 6 tamamlanan checklist maddeleri implemented-summary formatina alindi.
- Daginik acik maddeler tek backlog altında `v1.2.0 Yapilacaklar Listesi`ne taşındı.
- Full test refresh:
  - `cd guardian && npm test` (pass, 11 file / 61 test)
  - `cd src-tauri && cargo test` (pass, 54 test)
  - `cd guardian-cli && cargo test` (pass, 7 test)
  - `cd website && npm run test:run` (pass, 8 file / 107 test)
  - `python3 .agent/scripts/verify_all.py` (pass)

### v1.2.0 Stabilization - Phase 1 (2026-02-10)
- Root cause kaydi:
  - Monitor acilisinda eski bulgular hydrate edilmiyordu (yalnizca live `guardian:critique` event akisi vardi).
  - Baseline gecerliyse UI otomatik `New` gorunumune cekiliyordu.
- Uygulanan degisiklikler:
  - Backend snapshot hydrate eklendi:
    - `src-tauri/src/watcher.rs`: `critiques_from_snapshot_for_root` (`.guardian/critiques.json`, `protocol_version=1`, bozuk payload -> bos liste)
    - `src-tauri/src/lib.rs`: yeni Tauri command `get_monitor_critiques`
  - Frontend monitor hydrate + merge:
    - `src/App.tsx`: `refreshMonitorCritiques` eklendi (path degisimi + app acilisi + launch sonrasi)
    - Event merge key stratejisi: `finding_id` oncelikli, fallback `file_path`
    - `guardian:clear` temizligi key+file_path bazinda genisletildi
  - Baseline varsayilan gorunumu sabitlendi:
    - `src/App.tsx`: `refreshBaseline` ve `setBaselineNow` icindeki otomatik `New` gecisi kaldirildi
- Phase 1 testleri:
  - `cd guardian && npm test` (pass, 11 file / 63 test)
  - `cd guardian/src-tauri && cargo test` (pass, 56 test)
  - `cd guardian/guardian-cli && cargo test` (pass, 7 test)
  - `cd guardian/website && npm run test:run` (pass, 8 file / 107 test)
  - `python3 .agent/scripts/verify_all.py` (pass)

### v1.2.0 Stabilization - Phase 2 (2026-02-10)
- Root cause kaydi:
  - `Embedding mode=auto` akisi her durumda once OpenAI denedigi icin OpenAI key yoksa log spam olusuyordu.
  - Ollama/local fallback calissa bile her cagri oncesi gereksiz OpenAI hata uyari satiri uretiliyordu.
- Uygulanan degisiklikler:
  - `src-tauri/src/semantic_index.rs`:
    - `embedding_execution_plan` helper'i eklendi (`LocalOnly`, `OllamaOnly`, `OpenAiOnly`, `AutoOpenAiFirst`, `AutoOllamaFirst`)
    - `has_openai_embedding_key` ile auto policy key-var/yok kararina baglandi
    - Auto modda OpenAI key yoksa OpenAI denemesi atlanip direkt Ollama -> Local fallback calismasi aktif edildi
    - Key-yok bilgisinde `warn` yerine tek-seferlik `debug` loga gecildi (spam azaltimi)
  - `src/components/SettingsModal.tsx`:
    - Embedding mode bilgi notu auto policy davranisini net ifade edecek sekilde guncellendi
- Phase 2 testleri:
  - `cd guardian && npm test` (pass, 11 file / 63 test)
  - `cd guardian/src-tauri && cargo test` (pass, 59 test)
  - `cd guardian/guardian-cli && cargo test` (pass, 7 test)
  - `cd guardian/website && npm run test:run` (pass, 8 file / 107 test)
  - `python3 .agent/scripts/verify_all.py` (pass)

### v1.2.0 Stabilization - Phase 3 (2026-02-10)
- Root cause kaydi:
  - `src-tauri/src/watcher.rs` icindeki `last_fix_proposals_for_root` fonksiyonu kullanilmadigi icin her `cargo test`/build adiminda `dead_code` warning uretiyordu.
- Uygulanan degisiklikler:
  - `src-tauri/src/watcher.rs`:
    - Kullanilmayan `last_fix_proposals_for_root` helper'i kaldirildi.
    - Fix proposal akisinda davranis degisikligi yapilmadan internal cleanup tamamlandi.
- Phase 3 testleri:
  - `cd guardian && npm test` (pass, 11 file / 63 test)
  - `cd guardian/src-tauri && cargo test` (pass, 59 test, `last_fix_proposals_for_root` dead_code warning temiz)
  - `cd guardian/guardian-cli && cargo test` (pass, 7 test)
  - `cd guardian/website && npm run test:run` (pass, 8 file / 107 test)
  - `python3 .agent/scripts/verify_all.py` (pass)

### v1.2.0 Stabilization - Phase 4 (Integrated Verification) (2026-02-10)
- Final acceptance checklist:
  - [x] Monitor eski + yeni bulgulari hydrate + live merge ile gosteriyor.
  - [x] Varsayilan filtre `All`; `New/Resolved` yalnizca manuel secimle aktif oluyor.
  - [x] Auto embedding mode, OpenAI key yoksa OpenAI denemesini atlayip Ollama/Local fallback ile ilerliyor.
  - [x] `last_fix_proposals_for_root` dead_code warning'i temizlendi.
  - [x] Tum phase test paketleri tam komut setiyle tekrar calistirildi.

### v1.2.0 Stabilization - Phase 5 (E2E Gate Fixes) (2026-02-10)
- Root cause kaydi:
  - Playwright strict-mode selector `name: /Guru/i` birden fazla butonu match ediyordu (sidebar `Guru` + `Ask Guru to resolve` vb.).
  - Filter input placeholder degismisti ve input web preview modunda DOM'a render edilmedigi icin E2E time-out aliyordu.
- Uygulanan degisiklikler:
  - `tests/e2e/app.spec.ts`:
    - Guru selector'u `name: /^Guru$/i` olacak sekilde daraltildi.
    - Filter selector'u yeni placeholder davranisina uygun hale getirildi (`/Search issues/i`).
  - `src/App.tsx`:
    - Web preview (non‑Tauri) modunda floating filter her zaman gorunur yapildi (E2E ve docs preview akisi icin).
    - Desktop (Tauri) modunda mevcut davranis korunur (active / resolved view / filter dolu).
- Phase 5 testleri:
  - `cd guardian && npm run verify` (pass, 17/17 e2e)

### v1.2.0 Stabilization - Phase 6 (Ollama API Key Optional) (2026-02-10)
- Root cause kaydi:
  - Provider `ollama` seciliyken bile API key eksikligi launch akisini blokluyordu; offline/local hikayesini zedeliyordu.
  - Ollama request'lerinde key yokken bile `Authorization` header gonderiliyor ve bazi ortamlarda gereksiz hata riski olusuyordu.
- Uygulanan degisiklikler:
  - Desktop UI:
    - `src/hooks/useSettings.ts`: `requiresApiKey` Ollama icin `false` (cloud provider'lar icin `true`) olacak sekilde guncellendi.
    - `src/hooks/__tests__/useSettings.test.ts`: Ollama vs OpenAI API key requirement unit testi eklendi.
  - Tauri backend:
    - `src-tauri/src/config.rs`: `api_key_for_provider_or_empty` helper'i eklendi (Ollama key yoksa bos key ile devam).
    - `src-tauri/src/lib.rs`: `start_monitoring` + Guru akisi Ollama icin key zorunlulugunu kaldiracak sekilde guncellendi.
    - `src-tauri/src/skills/orchestrator.rs`: Ollama icin key zorunlulugu kaldirildi.
    - `src-tauri/src/ai_client.rs`:
      - `ensure_valid_api_key` Ollama icin bypass edildi.
      - Ollama `send_chat` branch'i key yoksa `Authorization` header gondermeyecek sekilde degistirildi.
- Phase 6 testleri:
  - `cd guardian && npm test` (pass, 11 file / 64 test)
  - `cd guardian/src-tauri && cargo test` (pass)

### v1.2.0 Stabilization - Phase 7 (Distribution Scripts Version Robustness) (2026-02-10)
- Root cause kaydi:
  - `guardian-distribution` repo'sunda `latest.json.version` bazi surumlerde `v1.1.x` formatinda; local publish/merge scriptleri ise `1.1.x` bekliyordu.
  - Bu mismatch bir sonraki local publish akisini kirma riski tasiyordu.
- Uygulanan degisiklikler:
  - `scripts/merge_latest_json.sh`: `version` alaninda hem `1.1.1` hem `v1.1.1` formatlarini kabul edecek sekilde guncellendi.
  - `scripts/publish_distribution_local.sh` + `scripts/publish_distribution.sh`: latest.json version check hem `1.1.1` hem `v1.1.1` kabul edecek sekilde guncellendi.
- Phase 7 testleri:
  - Smoke test: `merge_latest_json.sh` `v1.1.1` tag'i ile `latest.json.version=v1.1.1` payload'ini basariyla merge ediyor.

### v1.2.0 Stabilization - Phase 8 (Batch Critique file_path Normalization) (2026-02-10)
- Root cause kaydi:
  - Batch AI response `file_path` alani bazi provider/modellerde relative/yanlis gelebilir.
  - Watcher state (`ACTIVE_CRITIQUES`) bu alani key olarak kullandigi icin ghost finding / clear/hydrate tutarsizligi riski vardi.
- Uygulanan degisiklikler:
  - `src-tauri/src/watcher.rs`:
    - Batch AI critique `file_path` degeri analyzed `BatchItem.path` whitelist'ine gore normalize edildi (abs/rel/basename + canonicalize heuristics).
    - Normalize edilemeyen path'ler multi-file batch'te drop edilir (ghost state yerine fail-safe).
    - Semantic indexing pipeline normalize edilmis path'leri kullanacak sekilde duzeltildi.
    - Unit testler eklendi:
      - `batch_critique_file_paths_are_normalized_to_analyzed_paths`
      - `batch_critique_file_paths_drop_unmapped_paths_when_ambiguous`
- Phase 8 testleri:
  - `cd guardian/src-tauri && cargo test` (pass, 61 test)

### v1.2.0 Stabilization - Phase 9 (Version Bump + Release Notes) (2026-02-10)
- Uygulanan degisiklikler:
  - Version bump:
    - `guardian/package.json` -> `1.2.0`
    - `guardian/src-tauri/Cargo.toml` -> `1.2.0`
    - `guardian/src-tauri/tauri.conf.json` -> `1.2.0` (window title dahil)
  - `CHANGELOG.md`:
    - `1.2.0` stabilizasyon notlari eklendi.
  - `docs/LOCAL_RELEASE_RUNBOOK.md`:
    - `latest.json.version` check notu `v` prefix uyumluluguna gore guncellendi.
- Phase 9 testleri:
  - (final) full test paketi + verify gate (asagidaki checklist)

### v1.2.0 Stabilization - Phase 10 (sqlite-vec vec0 Init Order Fix) (2026-02-10)
- Root cause kaydi:
  - `sqlite3_auto_extension` kaydi mevcut SQLite connection acildiktan sonra yapiliyordu; bu nedenle ayni connection icinde `vec0` sanal tablo modulu gorunmeyip `no such module: vec0` warn uretebiliyordu.
- Uygulanan degisiklikler:
  - `src-tauri/src/storage/mod.rs`:
    - sqlite-vec auto-extension register islemi connection acilmadan onceye alindi.
    - Amaç: destekli build’lerde `semantic_vectors_ann` (vec0) tablosunun dogru init olmasi; destek yoksa mevcut cosine fallback aynen devam.
- Phase 10 testleri:
  - `cd guardian/src-tauri && cargo test` (pass, 64 test)

---

## Teknik Detaylar

### Pipeline Kaynağı (Source of Truth)

**Net karar:**
- **Watcher pipeline** (watcher.rs) = **source of truth** (GUI / realtime)
- **Orchestrator pipeline** (orchestrator.rs) = **ek analiz / event-bus**, baseline ve CI için tek kaynak değil
- **CLI** (guardian-cli) = watcher ile aynı rule/finding_id mantığını kullanır, fakat headless

Bu ayrım planın her fazında korunur; baseline, finding_id, critiques.json her zaman watcher pipeline'dan üretilir.

### Veri Akış Diyagramı

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│   Source    │───▶│   Watcher    │───▶│   Baseline   │
│   Files     │    │   (Rust)     │    │   Filter     │
└─────────────┘    └──────────────┘    └──────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │   AI Analysis (Provider) │
              │   - Redacted content     │
              │   - Rules hash           │
              └──────────────────────────┘
                            │
                            ▼
       ┌──────────────────────────────────────────┐
       │   Output Files (.guardian/)              │
       │   - critiques.json (AI + Human)          │
       │   - agent_queue.jsonl (AI)               │
       │   - fix_proposals.jsonl (Phase 5)        │
       │   - history.jsonl (Audit)                │
       └──────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
      ┌──────────┐   ┌──────────┐   ┌──────────┐
      │   UI     │   │   CLI    │   │  Agent   │
      │(Tauri)   │   │(CI/CD)   │   │(Cursor)  │
      └──────────┘   └──────────┘   └──────────┘
```

### State Management

**Rust (Tauri Commands):**
```rust
pub struct GuardianState {
    pub workspace_root: PathBuf,
    pub baseline_manager: BaselineManager,
    pub watcher_handle: Option<JoinHandle<()>>,
    pub current_critiques: Vec<Critique>,
    pub pending_proposals: Vec<FixProposal>,
}

impl GuardianState {
    pub fn new(root: PathBuf) -> Self { ... }
    pub fn set_baseline(&mut self) -> Result<()> { ... }
    pub fn get_filtered_critiques(&self, filter: Filter) -> Vec<Critique> { ... }
}
```

**React State:**
```typescript
interface GuardianContextType {
  critiques: Critique[];
  baselineStatus: BaselineStatus | null;
  pendingProposals: Proposal[];
  filter: 'all' | 'new' | 'resolved' | 'critical';
  setFilter: (f: Filter) => void;
  setBaseline: () => Promise<void>;
  applyProposal: (id: string) => Promise<void>;
}
```

### Dosya Yapısı (Son Hali) - Repo ile Uyumlu

```
guardian/
├── src-tauri/
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── watcher.rs              # Var olan
│       ├── ai_client.rs            # Var olan
│       ├── patcher.rs              # Var olan
│               ├── skills/
│       │   ├── mod.rs
│       │   └── hasher.rs           # Var olan
│       ├── baseline/               # Phase 1
│       │   ├── mod.rs
│       │   └── manager.rs
│       ├── ci/                     # Phase 2
│       │   ├── mod.rs
│       │   └── cli.rs
│       ├── redaction/              # Phase 3
│       │   ├── mod.rs
│       │   └── secrets.rs
│       ├── agent_protocol/         # Phase 4
│       │   ├── mod.rs
│       │   └── schema.rs
│       └── fix_proposal/           # Phase 5
│           ├── mod.rs
│           └── review.rs
├── src/                            # React frontend
│   ├── components/
│   │   ├── monitor/
│   │   │   ├── CritiqueList.tsx
│   │   │   ├── BaselinePanel.tsx   # Phase 1
│   │   │   └── AIContextPreview.tsx # Phase 3
│   │   ├── review/                 # Phase 5
│   │   │   ├── ReviewQueue.tsx
│   │   │   └── DiffView.tsx
│   │   └── settings/
│   │       └── SecurityTab.tsx     # Phase 3
│   └── lib/
│       └── api.ts
└── guardian-cli/                   # Phase 2 (ayrı crate)
    ├── Cargo.toml
    └── src/
        └── main.rs
```

---

## Zaman Çizelgesi

| Phase | Süre | Başlama | Bitiş | Risk |
|-------|------|---------|-------|------|
| 0 - Preflight | 1-2 gün | Hemen | Hemen | 🟢 Düşük |
| 1 - Baseline | 1-2 hafta | Phase 0 sonrası | 2. hafta | 🟢 Düşük |
| 2 - CI/CD | 2 hafta | Phase 1 ile paralel | 4. hafta | 🟡 Orta |
| 3 - Security | 1-2 hafta | Phase 2 ile paralel | 5. hafta | 🟢 Düşük |
| 4 - Agent Protocol | 2-3 hafta | Phase 3 sonrası | 8. hafta | 🟡 Orta |
| 5 - Fix Review | 3-4 hafta | Phase 4 sonrası | 12. hafta | 🔴 Yüksek |
| 6 - Advanced | - | Gelecek | - | 🟡 Orta |

**Toplam Süre:** 10-12 hafta (2.5-3 ay)

---

## Riskler ve Mitigasyonlar

| Risk | Olasılık | Etki | Mitigasyon |
|------|----------|------|------------|
| AI API maliyetleri patlar | Orta | Yüksek | Token limit, caching, mock mode |
| False positive çok fazla | Yüksek | Orta | Baseline + confidence threshold |
| Secret leak (AI'a) | Düşük | Kritik | Redaction + audit log + UI preview |
| CI/CD yavaşlatır | Orta | Orta | Baseline ile sadece yeni bulgular |
| Kullanıcı overwhelm | Yüksek | Orta | Noise reduction + smart grouping |

---

## Başarı Metrikleri (KPIs)

1. **Noise Reduction:** Baseline sonrası "yeni" bulgular < toplam bulguların %20'si
2. **CI Adoption:** Kurulumdan 1 hafta içinde CI entegrasyonu yapan kullanıcı oranı > %50
3. **Fix Rate:** Critical bulguların 24 saat içinde fix/reject oranı > %30
4. **False Positive:** Kullanıcı tarafından "buna gerek yok" olarak işaretlenen bulgular < %10
5. **Secret Safety:** AI'a sızan secret sayısı: 0

---

## Sonuç

Bu roadmap Guardian'ı **önce stabil ve güvenilir**, sonra **AI entegre** bir araç haline getirmeyi hedefliyor.

**Ana prensipler:**
1. **Güvenlik > Kolaylık** - Secret'lar asla risk altında olmamalı
2. **İnsan kontrolü** - AI önerir, insan karar verir
3. **Az gürültü** - Sadece anlamlı bulgular göster
4. **Entegrasyon** - CI/CD olmadan tam bir araç değil

**Başlangıç için önerim:**
Phase 0 + Phase 1 (Baseline) ile başla. Bu bile Guardian'ı çok daha kullanılabilir hale getirecektir.

---

## v1.2.2 - Stabilite: Batch Audit Backoff + Daha Doğru Cost Metrics (2026-02-17)

### Problem
- Provider erişilemediğinde (örn. Ollama kapalı / base URL yanlış / network down) initial scan sırasında her batch flush’ında `Batch audit failed` hatası üretiliyordu.
- Bu durum hem UI’da spam warning’e, hem de `Cost metrics` tarafında “call” sayısının gereksiz artmasına yol açıyordu.

### Çözüm
- Batch audit’lerde “provider unhealthy” durumunda progresif backoff eklendi ve batch içerikleri bellekte tutulup otomatik retry için re-queue edildi.
- UI uyarıları debounce edildi (hata aynı ise belirli bir süre içinde tekrar basmıyor) ve provider + base_url ile daha aksiyon alınabilir mesaj veriliyor.
- HTTP request “gönderilemeden” patlayan hatalarda cost metrics artık `calls=0, tokens=0` sayılıyor.
- Auto verification tarafında `npm/cargo/python/go` gibi tool’lar PATH’te yoksa “failed” yerine “skipped” dönülüyor (GUI app’lerde NVM kaynaklı PATH sorunları yüzünden yanlış negatif alarmı azaltmak için).

### Değişen Dosyalar
- `guardian/src-tauri/src/watcher.rs`
- `guardian/src-tauri/src/ai_client.rs`
- `guardian/src-tauri/src/executor.rs`

### UX İyileştirmeleri
- Settings → Provider tab’ına **Test Connection** eklendi (provider/base_url/model + API key doğrulaması, daha aksiyon alınabilir sonuç mesajı).
- Test Connection başarı mesajı 3 saniye sonra otomatik kaybolur (sekme kirlenmesini önlemek için).
- Save Provider / Save Key / Save Scan Scope / Save Embedding Settings gibi aksiyonlarda kısa süreli “success toast” gösterimi eklendi (light/dark uyumlu).
- Export PDF tamamlandığında Settings tab içinde uzun mesaj basmak yerine sadece kısa “success toast” gösterilir.
- Reviews (Fix Proposals) sekmesi boşken artık “ne işe yarar / nasıl doldurulur?” açıklayan net bir empty-state gösteriyor.

### Ek Değişen Dosyalar
- `guardian/src-tauri/src/lib.rs`
- `guardian/src/hooks/useSettings.ts`
- `guardian/src/components/SettingsModal.tsx`
- `guardian/src/App.tsx`
- `guardian/src/components/FixProposalsView.tsx`
- `guardian/src/components/__tests__/FixProposalsView.test.tsx`

### Testler
- `cd guardian && npm run verify` (PASS)
- `cd guardian/src-tauri && cargo test` (70/70 PASS)
- `cd guardian/guardian-cli && cargo test` (13/13 PASS)

---

## v1.2.0 Web Hotfix - Release API Rate Limit + Hero CTA (2026-02-11)

### Root Cause
- Website tarafında istemci komponentleri (`HeroSection`, `DirectDownloadButton`) GitHub `releases/latest` endpoint'ine doğrudan istek atıyordu.
- Anonim rate limit dolunca (`403 Forbidden`) release bilgisi çekilemediği için UI tarafında CTA davranışı bozuluyordu.
- Hero birincil CTA, release fetch durumuna bağlı kaldığı için bazı senaryolarda tıklanabilirlik kaybı oluşturuyordu.

### Uygulanan Değişiklikler
- `website/lib/releases-client.ts` eklendi:
  - Internal API (`/api/releases/latest`) üzerinden release çekimi
  - Kısa ömürlü in-memory cache
  - Tag → version normalize helper
- `website/app/api/releases/latest/route.ts` güncellendi:
  - Response'a `version` alanı eklendi.
- `website/components/ui/direct-download-button.tsx` güncellendi:
  - Direct GitHub fetch kaldırıldı, internal API client kullanıldı.
- `website/components/home/HeroSection.tsx` güncellendi:
  - Hero primary CTA doğrudan `/download` linki olacak şekilde sabitlendi.
  - Direct-download fetch bağımlılığı kaldırıldı.

### Doğrulama (Test Sonuçları)
- `cd guardian && npm test` ✅ (64/64)
- `cd guardian/src-tauri && cargo test` ✅ (64/64)
- `cd guardian/guardian-cli && cargo test` ✅ (7/7)
- `cd guardian/website && npm run test:run` ✅ (107/107)
- `cd /Users/dogan/Desktop/new-idee && python3 .agent/scripts/verify_all.py` ✅
- `cd guardian && npm run verify` ✅ (unit 64/64, e2e 17/17, build PASS, rust 64/64)

### Not
- Browser console'daki `Could not establish connection. Receiving end does not exist.` mesajı tipik olarak browser extension kaynaklıdır; website uygulama kodundan gelmeyebilir.

---

## v1.2.0 Release Automation - Auto Version Sync (2026-02-11)

### Kapsam
- Guardian uygulaması ve website için sürüm yönetimi tek komutla otomatik hale getirildi.
- Local release akışı, tag vermeden patch bump yapacak şekilde güncellendi.
- Tauri pencere başlığında statik `Guardian vX.Y.Z` bağımlılığı kaldırıldı (runtime version set devam ediyor).

### Değişen Dosyalar
- `guardian/scripts/bump_version.sh` (yeni)
  - `package.json`, `website/package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` sürümlerini senkronlar
  - `patch|minor|major|<semver>` destekler
- `guardian/scripts/release_all_local.sh`
  - `[tag]` opsiyonel hale getirildi
  - `--bump patch|minor|major|<semver>` eklendi
  - Versiyon mismatch durumunda otomatik sync eder
- `guardian/package.json`
  - `version:bump`, `version:minor`, `version:major` scriptleri eklendi
- `guardian/src-tauri/tauri.conf.json`
  - window title `Guardian` olarak normalize edildi
- `guardian/docs/RELEASING_LOCAL.md`
  - tek komutla auto bump release akışı dokümante edildi
- `guardian/docs/LOCAL_RELEASE_RUNBOOK.md`
  - bump/sync komutları ve yeni release kullanım örnekleri güncellendi
- `guardian/website/package.json`
  - website sürümü ana uygulama sürümüyle senkronlandı (`1.2.0`)

### Test ve Doğrulama
- `cd guardian && npm test` ✅ (64/64)
- `cd guardian/src-tauri && cargo test` ✅ (64/64)
- `cd guardian/guardian-cli && cargo test` ✅ (7/7)
- `cd guardian/website && npm run test:run` ✅ (107/107)
- `cd guardian && npm run verify` ✅ (unit 64/64, e2e 17/17, build PASS, rust PASS)
- `cd /Users/dogan/Desktop/new-idee && python3 .agent/scripts/verify_all.py` ✅

### Kullanım Özeti
- Patch release: `scripts/release_all_local.sh`
- Minor release: `scripts/release_all_local.sh --bump minor`
- Explicit version: `scripts/release_all_local.sh v1.2.2`

---

## v1.2.0 Website Stabilization - Changelog + Download Mobile + Top Bar Theme (2026-02-11)

### Kapsam
- Changelog sayfasında en güncel tag'in kaçırılması riski giderildi.
- Download sayfasında mobilde yatay taşma (horizontal scroll), dar alanda buton sıkışması ve eski sürüm görünümü düzeltildi.
- Mobil tarayıcı üst bar/beyaz alan problemi için layout/theme-color ve ilk render tema başlangıcı iyileştirildi.

### Değişen Dosyalar
- `guardian/website/lib/releases-source.ts`
  - Release kaynağı API-first olacak şekilde düzenlendi, snapshot fallback korundu.
- `guardian/website/lib/github.ts`
  - Release filtreleme akışı gereksiz dışlamalara karşı sadeleştirildi.
- `guardian/website/components/changelog/changelog-page-view.tsx`
  - `getLatestRelease` sonucu snapshot listesinde yoksa listeye ekleniyor.
- `guardian/website/components/download/download-page-view.tsx`
  - Latest release için API önceliği ve snapshot fallback davranışı eklendi.
- `guardian/website/app/download/download-client.tsx`
  - Mobil uyumlu düzen: kart ve aksiyon satırları küçük ekranda dikey akışa geçti, CTA sarımı iyileştirildi.
- `guardian/website/components/ui/command-header.tsx`
  - Header görseli koyu/açık mod ile tutarlı hale getirildi, mobil aksiyonlar yeniden dengelendi.
- `guardian/website/components/ui/direct-download-button.tsx`
  - Header içi buton stili, üst bar ile kontrast uyumlu hale getirildi.
- `guardian/website/app/layout.tsx`
  - `viewport.themeColor` ve erken tema init script'i ile mobil üst bar beyaz flash azaltıldı.
- `guardian/website/app/globals.css`
  - `html.light/html.dark` arka planları net tanımlandı.
- `guardian/website/e2e/download.spec.ts`
  - Yeni UI/algılama davranışına göre assertion'lar güncellendi.

### Test ve Doğrulama
- `cd guardian && npm test` ✅ (64/64)
- `cd guardian/src-tauri && cargo test` ✅ (64/64)
- `cd guardian/guardian-cli && cargo test` ✅ (7/7)
- `cd guardian/website && npm run test:run` ✅ (107/107)
- `cd guardian && npm run verify` ✅ (unit 64/64, e2e 17/17, build PASS, rust PASS)
- `cd guardian/website && npx playwright test e2e/download.spec.ts` ✅ (72/72)
- `cd /Users/dogan/Desktop/new-idee && python3 .agent/scripts/verify_all.py` ✅

---

## v1.2.0 UI Stabilization - Update Banner + Runtime Version Title (2026-02-11)

### Kapsam
- Update available popup light/dark modda aşırı beyaz kontrast üretmeyecek şekilde tema token'larıyla yeniden düzenlendi.
- Uygulama pencere başlığı runtime sürümden dinamik olarak set edilerek `Guardian vX.Y.Z` formatında sabitlendi.

### Değişen Dosyalar
- `guardian/src/App.tsx`
  - `normalizeVersionLabel` helper eklendi (`v` prefix normalize için)
  - Tauri runtime'da `get_app_version` ile sürüm çekilip pencere başlığı `getCurrentWindow().setTitle(...)` ile senkronlandı
  - Update popup sınıfları `bg-surface / border-border-main / text-text-main` token setine geçirildi
  - Update versiyon etiketleri normalize edilerek `v1.1.1 -> v1.2.0` gibi tutarlı render edildi

### Test ve Doğrulama
- `cd guardian && npm test` ✅ (64/64)
- `cd guardian/src-tauri && cargo test` ✅ (64/64)
- `cd guardian/guardian-cli && cargo test` ✅ (7/7)
- `cd guardian/website && npm run test:run` ✅ (107/107)
- `cd guardian && npm run verify` ✅ (unit 64/64, e2e 17/17, build PASS, rust PASS)
- `python3 .agent/scripts/verify_all.py` ✅

---

## v1.2.0 UX - AI Context + Reviews Inspector Split (2026-02-11)

**Hedef:** AI Context ve Reviews ekranlarını tek-uzun-scroll yerine "Inspector Split" (solda liste/filtre, sağda preview) düzenine taşıyarak okunabilirliği ve triage hızını artırmak. Tema/token renklerine dokunulmadı (özellikle `guardian/src/App.css` değişmedi).

### Değişen Dosyalar
- `guardian/src/components/AIContextPreview.tsx`: File list + search + redacted/truncated filtreleri + selected preview + copy aksiyonları
- `guardian/src/components/FixProposalsView.tsx`: Proposal list + search + status filtreleri + selected preview + copy aksiyonları + action butonları aynı davranışla
- `guardian/src/components/SettingsModal.tsx`: Updates tab'ına About/Support bölümü (website + contact linkleri)
- `guardian/src/components/__tests__/AIContextPreview.test.tsx`: Split-view davranışına göre güncellendi
- `guardian/src/components/__tests__/FixProposalsView.test.tsx`: Split-view davranışına göre güncellendi

### Notlar
- `String.prototype.replaceAll` TS target uyumsuzluğu nedeniyle `replace(/\\\\/g, "/")` ile normalize edildi.
- AI Context redaction/truncation banner'ı light/dark uyumlu, token renklerine dokunmadan nötr yüzey stiliyle güncellendi.
- Dev UX: Vite React Fast Refresh uyarısını azaltmak için `SettingsModal.tsx` içindeki `PROVIDER_OPTIONS` / `getProviderDefaults` export'ları kaldırıldı (dosya artık component-odaklı export yapıyor).

### Release (Local) İyileştirmesi
- `guardian/scripts/release_all_local.sh`: Tek komutla `verify → build → artifact collect → distribution publish → release notes` akışı eklendi.

### v1.2.0 Release Execution (2026-02-11)
- Distribution release yayını tamamlandı: `https://github.com/senoldogann/guardian-distribution/releases/tag/v1.2.0`
- Yayınlanan asset'ler:
  - `Guardian_1.2.0_aarch64.dmg`
  - `Guardian.app.tar.gz`
  - `Guardian.app.tar.gz.sig`
  - `latest.json`
  - `releases.json`
- Build/publish sırasında `latest.json` Tauri output'unda yoksa updater `.tar.gz + .sig` üzerinden otomatik üretim eklendi.
- `src-tauri/tauri.conf.json` içinde `bundle.createUpdaterArtifacts = true` yapıldı.
- Notarization bu run'da env eksikliği nedeniyle atlandı (signed build + updater artifacts üretildi).

### Release Sonrası Doğrulama
- `cd guardian && npm run verify` ✅
- `cd guardian/guardian-cli && cargo test` ✅ (7/7)
- `cd guardian/website && npm run test:run` ✅ (107/107)
- `python3 .agent/scripts/verify_all.py` ✅

### Doğrulama (Test Sonuçları)
- `cd guardian && npm run verify` ✅ (unit: 64/64, e2e: 17/17, build: PASS, rust tests: 64/64)
- `cd guardian/src-tauri && cargo test` ✅ (64/64)
- `cd guardian/guardian-cli && cargo test` ✅ (7/7)
- `cd guardian/website && npm run test:run` ✅ (107/107)
- `python3 .agent/scripts/verify_all.py` ✅

### v1.2.0 Stabilization - Phase 11 (Source-Focused Scan Policy) (2026-02-11)
- Root cause:
  - Guardian varsayılan tarama kapsamı script/docs/test/lock dosyalarını da kapsadığı için gereksiz token tüketimi ve düşük değerli bulgu gürültüsü oluşuyordu.
  - Desktop watcher ve CLI arasında dosya filtreleme davranışı tam hizalı değildi.
- Uygulanan değişiklikler:
  - `src-tauri/src/watcher.rs`:
    - `LOGIC_EXTENSIONS` allowlist tabanlı tarama eklendi (yalnızca kod odaklı uzantılar).
    - `IGNORED_PATH_SEGMENTS` ile `docs`, `tests`, `scripts`, `fixtures`, `.opencode`, `.loki` vb. dizinler default skip edildi.
    - `IGNORED_FILE_NAMES` ile `Dockerfile`, lockfile ve benzeri yüksek gürültülü dosyalar skip edildi.
    - Test dosyası patternleri (`*.test.*`, `*.spec.*`, `*_test.rs`) skip edildi.
  - `guardian-cli/src/scan.rs`:
    - Desktop ile aynı source-focused politika uygulanarak extension/path/file-name filtreleri güçlendirildi.
    - Yeni test eklendi: `collect_files_prioritizes_source_code_and_skips_noise`.
  - `src-tauri/src/tests_watcher.rs`:
    - Filter simülasyon testi docs/scripts/test dosyalarını kapsayacak şekilde genişletildi.
- Etki:
  - Varsayılan tarama davranışı “ana sistem kodu”na odaklandı.
  - Lockfile/markdown/shell/test/rules benzeri dosyaların analiz edilmesi engellenerek token maliyeti ve false-positive gürültüsü düşürüldü.
- Phase 11 testleri:
  - `cd guardian && npm test` ✅ (64/64)
  - `cd guardian/src-tauri && cargo test` ✅ (64/64)
  - `cd guardian/guardian-cli && cargo test` ✅ (8/8)
  - `cd guardian/website && npm run test:run` ✅ (107/107)
  - `cd guardian && npm run verify` ✅ (unit 64/64, e2e 17/17, build PASS, rust 64/64)
  - `python3 .agent/scripts/verify_all.py` ✅

### v1.2.1 Release Prep - Phase 12 (Batch Flush 3 + Version Bump) (2026-02-12)
- Root cause:
  - Batch processor varsayılan flush eşiği `2` olduğu için yüksek değişim anlarında çok sık AI batch çağrısı oluşuyordu.
  - Phase 11 source-focused scan iyileştirmesini uygulamaya alabilmek için yeni patch release gereksinimi oluştu.
- Uygulanan değişiklikler:
  - `src-tauri/src/config.rs`:
    - `DEFAULT_MAX_BATCH_SIZE` değeri `2 -> 3` yükseltildi.
  - Sürüm senkronizasyonu:
    - `package.json` → `1.2.1`
    - `website/package.json` → `1.2.1`
    - `src-tauri/Cargo.toml` → `1.2.1`
    - `src-tauri/tauri.conf.json` → `1.2.1`
    - lock dosyaları `scripts/bump_version.sh patch` ile senkron güncellendi.
  - Release notları:
    - `CHANGELOG.md` içine `1.2.1` maddesi eklendi (source-focused scanning + batch flush threshold update).
- Phase 12 testleri:
  - `cd guardian && npm test` ✅ (64/64)
  - `cd guardian/src-tauri && cargo test` ✅ (64/64)
  - `cd guardian/guardian-cli && cargo test` ✅ (8/8)
  - `cd guardian/website && npm run test:run` ✅ (107/107)
  - `cd guardian && npm run verify` ✅ (unit 64/64, e2e 17/17, build PASS, rust 64/64)
  - `python3 .agent/scripts/verify_all.py` ✅

### v1.2.1 Website Stabilization - Phase 13 (Release Freshness / Cache Revalidate Tuning) (2026-02-12)
- Root cause:
  - `guardian-distribution` tarafında yeni release (`v1.2.1`) yayınlandıktan sonra website katmanında çok katmanlı cache nedeniyle sürüm bilgisi gecikmeli görünüyordu.
  - GitHub fetch revalidate, API route `Cache-Control` ve client-side memory cache TTL değerleri birlikte gecikmeyi artırıyordu.
- Uygulanan değişiklikler:
  - `website/lib/github.ts`
    - `DEFAULT_REVALIDATE_SECONDS`: `900 -> 120`
  - `website/lib/releases-source.ts`
    - `SNAPSHOT_REVALIDATE_SECONDS`: `60 -> 30`
    - `FALLBACK_TTL_MS`: `300000 -> 60000`
  - `website/app/api/releases/latest/route.ts`
    - `Cache-Control`: `s-maxage=30, stale-while-revalidate=120`
  - `website/app/api/releases/route.ts`
    - `Cache-Control`: `s-maxage=30, stale-while-revalidate=120`
  - `website/lib/releases-client.ts`
    - client cache TTL: `60000 -> 15000`
- Etki:
  - Release sonrası website güncelleme görünürlüğü belirgin şekilde hızlandı.
  - Rate-limit güvenliği korunurken stale pencere daraltıldı.
- Phase 13 testleri:
  - `cd guardian && npm test` ✅ (64/64)
  - `cd guardian/src-tauri && cargo test` ✅ (64/64)
  - `cd guardian/guardian-cli && cargo test` ✅ (8/8)
  - `cd guardian/website && npm run test:run` ✅ (107/107)
  - `cd new-idee && python3 .agent/scripts/verify_all.py` ✅

### v1.2.2 Security + Stability - Phase 0 (Incident Containment / Secret Hygiene) (2026-02-17)
- Root cause:
  - Token sızıntısı riski taşıyan örnek değerler rapor dokümanında düz metin olarak yer alıyordu.
  - Root doğrulama akışında tracked dosyalar için otomatik secret pattern taraması yoktu.
- Uygulanan değişiklikler:
  - `REVIEW-RAPOR.md` içindeki gerçek görünen PAT değerleri `ghp_<REDACTED_TOKEN>` formatına redakte edildi.
  - `scripts/secret_scan.sh` eklendi:
    - tracked dosyalar üzerinde GitHub/OpenAI/AWS/Google API key pattern taraması
    - allowlist ile placeholder/test metinleri hariç tutuldu
    - bulguda `exit 1` ile pipeline fail
  - `scripts/verify.sh` güncellendi:
    - testlerden önce zorunlu `secret_scan.sh` adımı eklendi
  - `.github/workflows/ci-cd-v1.yml` güncellendi:
    - `test-and-build` job başına `Secret Pattern Scan` adımı eklendi
- Etki:
  - Secret leak tespiti yerel verify ve CI pipeline seviyesinde otomatikleşti.
  - Güvenlik hijyen adımı release gate'in parçası haline geldi.
- Phase 0 testleri:
  - `cd guardian && bash scripts/secret_scan.sh` ✅
  - `cd guardian && npm test` ✅ (64/64)

### v1.2.2 Security + Stability - Phase 1 (Runtime Security Hardening) (2026-02-17)
- Root cause:
  - Launch akışında provider bağımsız API key bloklaması Ollama local kullanımını engelliyordu.
  - CSP `localhost:*` ve `ws://localhost:*` wildcard'ları gereksiz geniş attack surface oluşturuyordu.
  - sqlite-vec auto extension kaydı implicit transmute içeriyordu; safety contract görünür değildi.
  - Kullanılmayan custom update komutları (`check_for_updates`, feed override, raw download) Tauri command surface'ini gereksiz büyütüyordu.
- Uygulanan değişiklikler:
  - `src/App.tsx`
    - `provider_id === "ollama"` için API key zorunluluğu start bloklayıcı olmaktan çıkarıldı.
  - `src-tauri/tauri.conf.json`
    - `connect-src` wildcard host/portlar kaldırıldı.
    - Üretim için yalnız gerekli endpoint/port allowlist tutuldu (Ollama 11434 + provider domainleri).
    - `devCsp` yalnız Vite dev host/port + gerekli endpointlerle sınırlandı.
  - `src-tauri/src/storage/mod.rs`
    - sqlite-vec extension register için explicit function pointer alias eklendi.
    - `transmute` bloğuna kapsamlı `SAFETY` sözleşmesi eklendi.
  - `src-tauri/src/updates.rs`, `src-tauri/src/lib.rs`
    - Aktif update akışı `check_app_update` + `install_app_update` ile sınırlandı.
    - Kullanılmayan custom feed/download komutları kaldırıldı.
- Etki:
  - Ollama offline/local akışı API key olmadan çalışır hale geldi.
  - Desktop CSP attack surface daraltıldı.
  - Update command surface sadeleşti ve bakım riski azaldı.
- Phase 1 testleri:
  - `cd guardian && npm test` ✅ (64/64)
  - `cd guardian/src-tauri && cargo test` ✅ (64/64)

### v1.2.2 Security + Stability - Phase 2 (Quality Gates / Progressive Ramp) (2026-02-17)
- Root cause:
  - Root projede lint/format gate yoktu.
  - Coverage eşikleri düşük olduğu için kalite regresyonları yakalanamıyordu.
  - Repo içinde tracked kalan `.bak` dosyası temiz değildi.
- Uygulanan değişiklikler:
  - `vitest.config.ts`
    - coverage thresholds `35/35/25/35` olarak yükseltildi.
    - `json-summary` reporter eklendi.
    - coverage kapsamı `src/**/*.{ts,tsx}` ile sınırlandı.
  - `scripts/coverage_gate.mjs` eklendi:
    - threshold kontrolü + opsiyonel baseline karşılaştırması
  - Root quality toolchain eklendi:
    - `eslint.config.mjs`
    - `.prettierrc.json`
    - `.prettierignore`
    - `package.json` scriptleri: `lint`, `lint:fix`, `format`, `format:check`, `coverage:gate`
    - `package.json` devDependencies: eslint/prettier/typescript-eslint/react-hooks plugin seti
  - Pipeline entegrasyonu:
    - `scripts/verify.sh` içine format/lint/coverage-gate adımları eklendi
    - `.github/workflows/ci-cd-v1.yml` içine format/lint/coverage-gate adımları eklendi
  - Repo hygiene:
    - `src/hooks/__tests__/useAuth.test.ts.bak` silindi
    - `.gitignore` içine `*.bak` eklendi
- Etki:
  - Yerel verify ve CI daha sıkı kalite kapılarıyla çalışır hale geldi.
  - Coverage tabanı kademeli olarak yükseltildi ve regresyon için otomatik gate eklendi.
- Phase 2 testleri:
  - `cd guardian && npm run format:check` ✅
  - `cd guardian && npm run lint` ✅
  - `cd guardian && npm run test:coverage && npm run coverage:gate` ✅

### v1.2.2 Security + Stability - Phase 3 (App.tsx Senior Refactor) (2026-02-17)
- Root cause:
  - `App.tsx` içinde launch gate, event yönetimi, baseline state ve ana layout aynı dosyada birleşmişti.
  - `SettingsModal` tekil prop sayısı yüksek olduğu için bakım maliyeti artıyordu.
- Uygulanan değişiklikler:
  - Yeni hooklar:
    - `src/hooks/useMonitoringController.ts`
    - `src/hooks/useGuardianEvents.ts`
    - `src/hooks/useBaselineController.ts`
  - Yeni layout componentleri:
    - `src/components/layout/ControlSidebar.tsx`
    - `src/components/layout/MainWorkspace.tsx`
  - `src/App.tsx`
    - launch/baseline/event akışları hooklara taşındı
    - ana workspace render yapısı layout componentlerine ayrıldı
    - artık kullanılmayan legacy yardımcı component/import kalıntıları temizlendi
  - `src/components/SettingsModal.tsx`
    - props arayüzü domain-group modeline taşındı:
      - `providerProps`
      - `webProps`
      - `embeddingProps`
      - `updateProps`
  - `src/App.tsx`
    - `SettingsModal` çağrısı grouped props modeliyle güncellendi.
- Etki:
  - App orchestration katmanı daha net ayrıldı; monitor/baseline/events sorumlulukları izole oldu.
  - Settings modal arayüzü okunabilirliği ve bakım kolaylığı arttı.
- Phase 3 testleri:
  - `cd guardian && npm run lint` ✅
  - `cd guardian && npm run build` ✅
  - `cd guardian && npm test` ✅ (64/64)

### v1.2.2 Security + Stability - Phase 4 (Integrated Verification + Release Gate) (2026-02-17)
- Uygulanan değişiklikler:
  - Version sync:
    - `package.json` → `1.2.2`
    - `website/package.json` → `1.2.2`
    - `src-tauri/Cargo.toml` → `1.2.2`
    - `src-tauri/tauri.conf.json` → `1.2.2`
  - `scripts/secret_scan.sh`
    - silinmiş dosya referanslarında gereksiz stderr gürültüsünü önlemek için `rg --no-messages` eklendi.
  - `src/hooks/useSettings.ts`
    - artık gereksiz olan `eslint-disable` satırları temizlendi (lint temiz çıktı).
  - `AGENTS.md`
    - `.agent/scripts/verify_all.py` checklist gereksinimini karşılamak için workspace root giriş dosyası eklendi.
- Full doğrulama çıktıları:
  - `cd guardian && npm run verify` ✅ (`Guardian@1.2.2`)
    - secret scan ✅
    - format/lint ✅
    - unit + coverage gate ✅
    - e2e ✅ (17/17)
    - build ✅
    - rust check/test ✅
  - `cd guardian/src-tauri && cargo test` ✅ (64/64, `Guardian v1.2.2`)
  - `cd guardian/guardian-cli && cargo test` ✅ (8/8)
  - `cd guardian/website && npm run test:run` ✅ (107/107, `guardian-website@1.2.2`)
  - `cd guardian && python3 .agent/scripts/verify_all.py` ✅
- Not:
  - `website` test çıktısındaki `Error: Test error` logları `ErrorBoundary` senaryolarında beklenen davranıştır; test suite pass durumundadır.

---

### v1.2.2 Security + Stability - Phase 5 (Post-Review Stabilization) (2026-02-17)
- Root cause:
  - `check_app_update` sonucu UI'ya `download_url` taşımıyordu; updater CTA akışında eksik metadata oluşuyordu.
  - `App.tsx` içinde localStorage odaklı ilk state okuma SSR/hydration açısından kırılgan kalmıştı.
  - Onboarding visibility, hydration öncesi render yüzünden E2E navigasyon click'lerini bloklayabiliyordu.
- Uygulanan değişiklikler:
  - `src-tauri/src/updates.rs`
    - `status=available` durumunda `download_url` artık `Some(update.download_url.to_string())` olarak döndürülüyor.
  - `src/hooks/useLocalStorage.ts`
    - Hook hydration-safe modele taşındı (`storedValue` default ile başlar, `useEffect` ile hydrate edilir).
    - React uyumlu setter eklendi (`Dispatch<SetStateAction<T>>`).
    - Opsiyonel `serialize` / `deserialize` fonksiyonlarıyla key bazlı parse kontrolü eklendi.
    - Hook dönüşü `[value, setValue, hydrated]` formatına genişletildi.
  - `src/App.tsx`
    - `onboarding/path/theme` state'leri localStorage-initializer `useState` yerine `useLocalStorage` ile yönetiliyor.
    - `showOnboarding` hesaplaması `onboardingHydrated && !onboardingCompleted` olarak güncellendi.
    - `parseBooleanStorage`, `parseStringStorage`, `parseThemeStorage` helper'ları eklendi.
- Etki:
  - Update metadata akışı düzeldi, UI download linki kaybetmiyor.
  - localStorage kaynaklı SSR/hydration riski düşürüldü.
  - Onboarding overlay kaynaklı E2E click interception regresyonu kapatıldı.
- Phase 5 testleri:
  - `cd guardian && npm run verify` ✅
  - `cd guardian/src-tauri && cargo test` ✅ (64/64)
  - `cd guardian/guardian-cli && cargo test` ✅ (8/8)
  - `cd guardian/website && npm run test:run` ✅ (107/107)
  - `cd /Users/dogan/Desktop/new-idee && python3 .agent/scripts/verify_all.py` ❌ (`No such file or directory`)

### v1.2.2 Security + Stability - Phase 6 (Guru Queue + UX Responsiveness + Export Flow) (2026-02-17)
- Root cause:
  - Monitor audit ve Guru soru-cevap akışları aynı anda AI provider'a gittiğinde istek çakışması/rate-limit kaynaklı hata olasılığı vardı.
  - Guru bekleme durumunda sabit `Thinking...` metni kullanıcıya süreç hissi vermiyordu.
  - Export sekmesi browser `alert` ile kalıyordu; desktop akışında dosya konumu görünürlüğü zayıftı.
- Uygulanan değişiklikler:
  - `src-tauri/src/ai_client.rs`
    - Global AI istek kuyruğu eklendi (`tokio::Semaphore`, default eşzamanlılık `1`).
    - `GUARDIAN_AI_REQUEST_CONCURRENCY` env ile kuyruk genişliği ayarlanabilir hale getirildi.
    - `send_chat` çağrıları queue permit alarak yürütülüyor; istekler çakışmak yerine sıraya giriyor.
  - `src/components/ChatView.tsx`
    - Loading sırasında döngüsel, animasyonlu durum metinleri eklendi (context analyze / architecture check / response build).
  - `src/lib/exportAuditPdf.ts`
    - Desktop (Tauri) için PDF artık `Downloads` klasörüne yazılıyor.
    - Export sonrası `revealItemInDir` (fallback: `openPath`) ile dosya konumu otomatik açılıyor.
    - Web fallback davranışı korunuyor (`doc.save`).
  - `src/hooks/useSettings.ts`
    - Export için in-progress/success/error state eklendi.
    - Export sonucu (kaydedilen path ve klasör açılma durumu) UI mesajına taşındı.
  - `src/components/SettingsModal.tsx`
    - Export tabında işlem animasyonu + dönen durum mesajı + sonuç/hata geri bildirimi eklendi.
  - `src-tauri/capabilities/default.json`
    - PDF export write izni `Downloads` için genişletildi (`$DOWNLOAD/**`).
  - Test uyum güncellemeleri:
    - `src/test/setup.ts`
    - `src/lib/__tests__/exportAuditPdf.test.ts`
    - `src/hooks/__tests__/useSettings.test.ts`
- Etki:
  - Guru/Monitor eşzamanlı AI kullanımında stabilite arttı, ani provider hata oranı düşürüldü.
  - Guru bekleme UX'i daha anlaşılır hale geldi.
  - Export PDF akışı desktop kullanıcıları için "kaydet + konumu aç" davranışıyla tamamlandı.
- Phase 6 testleri:
  - `cd guardian && npm test` ✅ (64/64)
  - `cd guardian/src-tauri && cargo test` ✅ (64/64)
  - `cd guardian/guardian-cli && cargo test` ✅ (8/8)
  - `cd guardian/website && npm run test:run` ✅ (107/107)
  - `cd guardian && npm run verify` ✅

### v1.2.2 Security + Stability - Phase 7 (Cost Metric Accuracy + Monitor Path Visibility + Export Permission Hardening) (2026-02-17)
- Root cause:
  - Cost metric tarafında `guardian:usage.calls` dosya sayısı gibi hesaplandığı için gerçek API request adedi olduğundan yüksek görünüyordu.
  - Monitor listesinde uzun path'ler satırda truncate olduğu için expanded görünümde tam path net gösterilmiyordu.
  - PDF export bazı ortamlarda `fs.write_file not allowed` hatasına düşebiliyordu (path/scope kombinasyonu).
- Uygulanan değişiklikler:
  - `src-tauri/src/watcher.rs`
    - `handle_critiques` çağrı sözleşmesi genişletildi (`api_calls`, `files_analyzed`).
    - Usage event payload'ı ayrıştırıldı:
      - `calls` = API request sayısı
      - `files` = analiz edilen dosya sayısı
    - Batch fail/single fail event'lerinde de bu model korunacak şekilde emit güncellendi.
  - `src/hooks/useGuardianEvents.ts`
    - `guardian:usage` payload'ından opsiyonel `files` toplanacak şekilde state merge güncellendi.
  - `src/App.tsx`
    - usage state yapısı `{ tokens, calls, files }` formatına taşındı.
  - `src/components/Header.tsx`
    - Header label `AI Calls` → `AI Requests` olarak güncellendi.
  - `src/components/layout/ControlSidebar.tsx`
    - Cost metric metni `Tokens • API calls • Files` olacak şekilde genişletildi.
  - `src/components/CritiqueAccordionRow.tsx`
    - Expanded kritik detay paneline tam `File Path` bloğu eklendi.
  - `src/lib/exportAuditPdf.ts`
    - PDF write akışı önce `BaseDirectory.Download` ile deneniyor.
    - Geriye dönük uyumluluk için absolute path fallback korundu.
  - `src-tauri/capabilities/default.json`
    - Download write/read için gerekli fs izinleri eklendi (`fs:allow-write-file`, `fs:allow-download-*`).
  - `tests/e2e/app.spec.ts`
    - Header metin beklentisi `AI Requests` ile hizalandı.
- Etki:
  - Cost kartı artık "gerçek request yükü" ve "analiz edilen dosya yükü"nü ayrı gösteriyor.
  - Monitor’da kritik satıra tıklanınca tam dosya yolu görünür hale geldi.
  - PDF export akışı Download scope ile daha stabil.
- Phase 7 testleri:

### v1.2.2 Performance + Quality - Phase 8 (Scan Profiles + Shared Policy Core) (2026-02-17)
- Root cause:
  - Varsayılan source-focused davranış doğru, ancak kullanıcıların infra/lock/script gibi dosyaları da (isteğe bağlı) taratabileceği kontrollü bir kapsam profili yoktu.
  - Desktop watcher ve CLI arasında politika drift riski vardı (aynı repo, iki farklı filtre implementasyonu).
- Uygulanan değişiklikler:
  - Yeni ortak Rust crate: `guardian/guardian-scan-policy`
    - `ScanProfile`: `source | extended | full`
    - Tek karar noktası: `classify_path(path, is_chat, profile)` + limitler (`initial_scan_limit`, `max_batch_size`)
  - Desktop (Tauri) entegrasyonu:
    - `src-tauri/src/lib.rs`
      - Yeni komutlar: `get_scan_profile_config`, `set_scan_profile_config`
      - Persist: app_data altında `scan_profile.json`
      - `start_monitoring` watcher config’e `scan_profile` geçiriyor
    - `src-tauri/src/watcher.rs`
      - Initial scan limiti profile’a bağlandı (`source=200, extended=300, full=500`)
      - Batch flush eşiği profile’a bağlandı (`source/extended=3, full=2`)
      - Critique surfacing profile-aware hale getirildi (source’da gürültü düşük, extended/full’da infra dosyalarında güvenlik keyword’leri korunuyor)
  - Desktop UI entegrasyonu:
    - `src/hooks/useSettings.ts`: scan profile load/save (Tauri invoke)
    - `src/components/SettingsModal.tsx`: Provider -> Safety altında “Scan Scope” seçimi + açıklama
    - `src/components/layout/ControlSidebar.tsx`: Cost Metric altında `Scope` + `Queue wait` satırı (queue metric Phase 9 ile dolacak)
  - CLI entegrasyonu:
    - `guardian-cli`: `--scan-profile` argümanı + `GUARDIAN_SCAN_PROFILE` env fallback
    - Rapor çıktısına `scan_profile` alanı eklendi (JSON + Markdown)
- Phase 8 testleri:
  - `cd guardian && npm test` ✅ (64/64)
  - `cd guardian/src-tauri && cargo test` ✅ (64/64)
  - `cd guardian/guardian-cli && cargo test` ✅ (8/8)
  - `cd guardian && npm run verify` ✅ (unit 64/64, coverage gate OK, e2e 17/17, build PASS, rust 64/64)

### v1.2.2 Performance + Quality - Phase 9 (Adaptive AI Queue + Queue Wait + Scan Skip Summary) (2026-02-17)
- Root cause:
  - Monitor (audit) ile Guru (chat) istekleri aynı anda geldiğinde request çakışmaları, timeouts ve "Batch audit failed" hataları görülebiliyordu.
  - UI'da gecikmenin "model yavaşlığı" mı yoksa "kuyruk beklemesi" mi olduğu anlaşılmıyordu.
  - Initial scan sırasında hangi dosyaların hangi nedenle skip edildiğine dair görünür bir özet yoktu (kullanıcılar "boşa tarıyor mu?" sorusunu cevaplamak zordu).
- Uygulanan değişiklikler:
  - `src-tauri/src/ai_client.rs`
    - Lane tabanlı kuyruklama: `Audit` ve `Guru` request class'ları.
    - Provider-aware concurrency default:
      - Local (Ollama/Mock): 2
      - Cloud: 1
      - Env override: `GUARDIAN_AI_REQUEST_CONCURRENCY`
    - Audit lane her zaman 1 (audit burst'ünün Guru'yu starve etmesini engeller).
    - `AiCall<T>` wrapper ile `queue_wait_ms` ölçümü eklendi.
    - Fairness testleri eklendi.
  - `src-tauri/src/lib.rs`
    - Guru çağrıları için usage event emit genişletildi (`queue_wait_ms`).
  - `src-tauri/src/watcher.rs`
    - Batch audit sonrası `guardian:usage` event payload'ına `queue_wait_ms` eklendi.
    - Initial scan sonunda tek seferlik skip özeti loglandı:
      - `profile`, `included`, `skipped`, `limit_reached`, `skipped_by_reason`.
  - Desktop UI:
    - `src/hooks/useGuardianEvents.ts`: `queue_wait_ms` opsiyonel alanı state'e alındı.
    - `src/components/layout/ControlSidebar.tsx`: Cost Metric altında `Queue wait` satırı aktif hale geldi.
- Etki:
  - Cloud provider'larda efektif concurrency=1 ile çakışma/limit riski azaldı.
  - Local provider'larda Guru, audit çalışırken de paralel slot bulabiliyor (audit lane 1 + global 2).
  - UI artık gecikmeyi `queue_wait_ms` ile görünür kılıyor; initial scan skip görünürlüğü log ile iyileşti.
- Phase 9 testleri:
  - `cd guardian/src-tauri && cargo test` ✅ (66/66)
  - `cd guardian/guardian-cli && cargo test` ✅ (8/8)
  - `cd guardian && npm test` ✅ (64/64)
  - `cd guardian && npm run verify` ✅ (unit 64/64, coverage gate OK, e2e 17/17, build PASS, rust 66/66)

### v1.2.2 Quality - Phase 10 (Tavily Web Search Best Practices Alignment) (2026-02-17)
- Root cause:
  - Tavily request auth ve rate-limit akışı dokümantasyondaki güncel önerilerle tam hizalı değildi.
  - Rate limiter implementasyonu zaman hesaplaması nedeniyle efektif çalışmıyordu (eşzamanlı isteklerde 429 riski).
  - Uzun/dağınık sorgular Tavily tarafında ilgililik ve maliyeti düşürebiliyordu.
- Uygulanan değişiklikler:
  - `src-tauri/src/skills/web_search.rs`
    - Rate limiter düzeltildi: gerçek zaman ölçümü + concurrency-safe `Mutex` (tek instance içinde seri limit).
    - Auth güncellendi: API key request body yerine `Authorization: Bearer ...` header ile gönderiliyor.
    - Query normalize + 400 char truncation eklendi (whitespace compact, newline temizleme).
    - URL / `site:` geçen sorgularda otomatik `include_domains` uygulanıyor (relevance artırır).
    - Answer varsa bile top sources listesi ekleniyor (LLM context için doğrulanabilirlik).
    - Score-based filtering ile düşük relevans sonuçlar (score < 0.35) fallback listede eleniyor.
  - `src-tauri/src/config.rs`
    - Env fallback eklendi: `TAVILY_API_KEYS|TAVILY_API_KEY` (+ `GUARDIAN_*` variantları) ile dev/CI benzeri kullanım.
- Etki:
  - Web search daha stabil (429 ve concurrency burst riski azalır) ve daha odaklı (domain filter + query normalization).
  - LLM’e daha doğrulanabilir web context gider (sources listesi).
- Phase 10 testleri:
  - `cd guardian/src-tauri && cargo test` ✅ (66/66)
  - `cd guardian && npm run verify` ✅ (unit 64/64, coverage gate OK, e2e 17/17, build PASS, rust 66/66)

### v1.2.2 Quality - Phase 11 (Tavily URL Extract + Search Depth Control) (2026-02-17)
- Root cause:
  - Guru web context akışında URL içeren sorularda search yerine extract kullanmak daha doğru/odaklı sonuç veriyor (tek sayfa doğrulaması).
  - Search depth sabitti (`basic`); power-user için cost/latency/relevance tradeoff seçimi yoktu.
- Uygulanan değişiklikler:
  - Desktop UI:
    - `src/constants/index.ts`: `WEB_SEARCH_DEPTH` storage key eklendi.
    - `src/hooks/useSettings.ts`: `webSearchDepth` persist + `onWebSearchDepthChange`.
    - `src/components/SettingsModal.tsx`: Web Search tab’ına “Search depth” dropdown eklendi.
    - `src/components/layout/MainWorkspace.tsx`: `webSearchDepth` ChatView’a taşındı.
    - `src/components/ChatView.tsx`: `ask_guru` invoke payload’ına `webSearchDepth` eklendi.
    - `src/App.tsx`: settings → SettingsModal/MainWorkspace wiring güncellendi.
  - Backend:
    - `src-tauri/src/lib.rs`: `ask_guru` komutu `web_search_depth` opsiyonel argümanını kabul ediyor; Tavily çağrısına depth geçiriyor.
    - `src-tauri/src/skills/web_search.rs`:
      - `search_with_options` eklendi (`SearchDepth` + `WebSearchOptions`).
      - Global Tavily rate limiter eklendi (overlapping Guru çağrılarında 429 burst riskini azaltır).
      - URL tespit edilirse otomatik `/extract` akışı (query + chunks_per_source=3).
      - `/search` akışında `search_depth` seçimi (basic/fast/ultra-fast/advanced/auto) + advanced için `chunks_per_source=3`.
      - Saf helper unit testleri eklendi (query normalize, URL detect/strip, depth parse).
- Etki:
  - URL içeren sorularda daha doğru ve daha az gürültülü web context (extract).
  - Kullanıcı “Basic vs Advanced vs Fast” seçimiyle maliyet/latency kontrolü yapabilir.
- Phase 11 testleri:
  - `cd guardian/src-tauri && cargo test` ✅ (70/70)
  - `cd guardian && npm run verify` ✅ (unit 64/64, coverage gate OK, e2e 17/17, build PASS, rust 70/70)

### v1.2.2 Quality - Phase 12 (Scan Profile Surfacing: Full != Extended) (2026-02-17)
- Root cause:
  - `should_surface_critique` içinde `profile != Source` koşulu nedeniyle `extended` ve `full` aynı warning filtre yolunu izliyordu.
  - `Info` severity hiçbir profilde surfaced edilmiyordu (Full modda bile).
- Uygulanan değişiklikler:
  - `src-tauri/src/watcher.rs`
    - `should_surface_critique` profile-aware hale getirildi:
      - `source`: yalnızca `critical` + significant `warning`
      - `extended`: `critical` + significant `warning` + infra dosyalarında security-keyword `warning`
      - `full`: tüm `warning` + significant `info` (critical her zaman)
- Etki:
  - Full mod artık Extended’dan belirgin şekilde farklı: generic infra warning’ler ve yüksek-sinyal info’lar görünür.
  - Source/Extended gürültü kontrolü korunur.
- Phase 12 testleri:
  - `cd guardian/src-tauri && cargo test` ✅ (70/70)
  - `cd guardian/guardian-cli && cargo test` ✅ (8/8)
  - `cd guardian && npm run verify` ✅

### v1.2.2 Quality - Phase 13 (Review Output Remediation: Modals + UX + Backend Cleanup) (2026-02-17)
- Root cause:
  - Review raporunda UX ve stabilite açısından birkaç somut risk vardı:
    - UI: native `alert()` kullanımı, modal focus trap eksikliği, modal erişilebilir isimlendirme eksikliği.
    - UI: `DiagramView` içinde cleanup’siz `setTimeout` (unmount sonrası callback riski).
    - Backend: auto-verify yolunda `std::thread::spawn` (Tokio ekosistemiyle uyumsuz).
    - CLI: SARIF çıktısında `startLine: 1` hardcoded (yanlış highlight).
    - Website: CSP header’ları iki farklı yerde yönetiliyordu (drift riski).
- Uygulanan değişiklikler:
  - Desktop UI:
    - `src/components/CritiqueAccordionRow.tsx`
      - `alert()` kaldırıldı; Toast sistemi ile bilgilendirme (`info/success/error`) yapılıyor.
    - `src/hooks/useFocusTrap.ts`
      - Basit focus trap + Escape handling eklendi (Tab wrap, focus restore).
    - `src/components/SettingsModal.tsx`
      - `role="dialog"` + `aria-modal` + `aria-labelledby` eklendi.
      - Backdrop click ile close (yalnız backdrop click) eklendi.
      - Focus trap aktif edildi (initial focus: Close).
    - `src/components/ChatView.tsx`
      - Clear confirmation modal’ına `role="dialog"` + `aria-*` + focus trap + backdrop click ile close eklendi.
    - `src/components/StallOverlay.tsx`
      - Modal’a `aria-labelledby` eklendi (E2E/AT için stabil accessible name).
    - `src/components/DiagramView.tsx`
      - Toggle sonrası kullanılan `setTimeout` için cleanup + de-bounce (pending timer clear) eklendi.
    - Küçük refactor:
      - `src/lib/critiqueStateKey.ts`: `finding_id` öncelikli state key helper tekilleştirildi.
      - `src/lib/uiFormat.ts`: `basenameOf`, `formatTimestamp`, `copyToClipboard` helper’ları tekilleştirildi.
  - Backend:
    - `src-tauri/src/watcher.rs`
      - Auto-verify path’i `tokio::task::spawn_blocking` ile çalışacak şekilde güncellendi.
  - CLI:
    - `guardian-cli/src/output.rs`
      - SARIF çıktısından yanlış `region.startLine=1` kaldırıldı (unknown line yerine region omit).
  - Website:
    - `website/middleware.ts` kaldırıldı; CSP + security header kaynağı tekleştirildi (Next headers).
- Phase 13 testleri:
  - `cd guardian && npm run verify` ✅ (unit 64/64, coverage gate OK, e2e 17/17, build PASS, rust 70/70)
  - `cd guardian/guardian-cli && cargo test` ✅ (8/8)
  - `cd guardian/website && npm run test:run` ✅ (107/107)
  - `cd guardian/website && npm run build` ✅

### v1.2.2 Trust - Phase 14 (Reproducible Run Manifest + CI Gate Hooks) (2026-02-17)
- Amaç:
  - CLI taramalarını tekrar üretilebilir hale getirmek ve CI/PR entegrasyonu için gerekli metadata'yı üretmek.
- Uygulanan değişiklikler:
  - `guardian-cli/src/run_manifest.rs`
    - `RunManifest` + `file_inventory` şeması eklendi.
    - `stable_hash_hex()` ile deterministik manifest hash (yalnız `generated_at` hariç).
  - `guardian-cli/src/main.rs`
    - Yeni flag'ler eklendi:
      - `--emit-manifest <path>` (run manifest JSON)
      - `--pr-gate <critical-only|new-only|off>` (default: `critical-only`)
      - `--emit-evidence <path>` flag'i Phase 15 için hazırlandı (evidence üretimi sonraki faz).
  - `guardian-cli/src/scan.rs`
    - Scan sırasında bounded `file_inventory` toplanıyor (cap: `max_files*5`, max `2000`).
    - Sensitive file skip artık manifestte görünür (`reason=sensitive`).
    - Scan profile skip reason'ları `guardian-scan-policy` `SkipReason` ile yazılıyor.
    - `AI scan` batch size artık profile ile uyumlu (`ScanProfile::max_batch_size()`).
  - `guardian-cli/src/output.rs`
    - SARIF run-level `properties` eklendi:
      - `guardian_manifest_hash`, `scan_profile`, `rules_hash`
    - Markdown rapora manifest hash/path satırları eklendi (varsa).
- Phase 14 testleri:
  - `cd guardian && npm run verify` ✅ (unit 64/64, coverage gate OK, e2e 17/17, build PASS, rust 70/70)
  - `cd guardian/guardian-cli && cargo test` ✅ (11/11)

### v1.2.2 Trust - Phase 15 (Finding Evidence / Provenance Export) (2026-02-17)
- Amaç:
  - CI/PR entegrasyonu ve "neden çıktı?" debug akışları için her finding'e kanıt/provenance export etmek.
- Uygulanan değişiklikler:
  - `guardian-cli/src/evidence.rs`
    - `EvidenceReport` + `EvidenceFinding` şeması eklendi.
  - `guardian-cli/src/scan.rs`
    - `--emit-evidence <path>` ile evidence JSON üretimi eklendi:
      - `evidence_preview`: masked + `2KB` ile truncate
      - `file_path_rel`: her zaman relative path (absolute path yok)
      - `rule_id`: `guardian::<finding_id>` (fallback)
    - JSON raporda `evidence_path` alanı dolduruluyor (markdown header'da da görünür).
- Phase 15 testleri:
  - `cd guardian && npm run verify` ✅ (unit 64/64, coverage gate OK, e2e 17/17, build PASS, rust 70/70)
  - `cd guardian/guardian-cli && cargo test` ✅ (12/12)

### v1.2.2 Integrations - Phase 16 (GitHub PR Summary Template: guardian-cli) (2026-02-17)
- Amaç:
  - CI/PR akışında Guardian bulgularını PR üzerinde okunur bir özet olarak göstermek ve yeni critical varsa gate etmek.
- Uygulanan değişiklikler:
  - `.github/workflows/guardian-scan.yml`
    - `guardian-cli` build + offline scan + PR comment şablonu eklendi:
      - JSON rapor: `guardian-report.json`
      - Sticky PR comment: `guardian-pr-comment.md`
      - Gate: `--pr-gate critical-only` (new critical -> job fail)
      - Artifacts upload (debug için)
  - `scripts/ci/render_guardian_pr_comment.mjs`
    - CLI JSON rapordan kısa PR summary markdown üretir (Top 10 new findings + counts).
- Phase 16 testleri:
  - `cd guardian && npm run verify` ✅ (format check + lint + unit + e2e + build + rust)
  - `cd guardian/guardian-cli && cargo test` ✅ (12/12)

### v1.2.2 Integrations - Phase 17 (SARIF Upload Template + Run Properties) (2026-02-17)
- Amaç:
  - Guardian bulgularını GitHub Security/Code Scanning altında görünür kılmak (SARIF upload).
- Uygulanan değişiklikler:
  - `.github/workflows/guardian-scan.yml`
    - SARIF üretimi + upload adımı eklendi:
      - `guardian-cli scan --format sarif --out $RUNNER_TEMP/guardian.sarif`
      - `github/codeql-action/upload-sarif@v3`
    - Debug için manifest + evidence + rapor dosyaları `.guardian/ci/` altında artifact olarak upload ediliyor.
  - `guardian-cli/src/output.rs`
    - SARIF run-level `properties` doğrulayan unit test eklendi (`guardian_manifest_hash`, `scan_profile`, `rules_hash`).
- Phase 17 testleri:
  - `cd guardian && npm run verify` ✅
  - `cd guardian/guardian-cli && cargo test` ✅ (13/13)

### v1.2.2 Docs - Phase 18 (CI/PR Integration Doc: Desktop vs CLI) (2026-02-17)
- Amaç:
  - Desktop kullanıcılarının CLI kullanmak zorunda olmadığını netleştirmek; CI/PR entegrasyonu isteyen ekipler için kısa bir runbook sağlamak.
- Uygulanan değişiklikler:
  - `docs/CI_PR_INTEGRATION.md`
    - PR summary + gate + SARIF upload akışı (GitHub Actions) anlatıldı.
    - Desktop vs CLI rol ayrımı netleştirildi.
  - `docs/PROJECT_DOCUMENTATION.md`
    - “CI / PR Integration (Optional)” bölümü eklendi ve dokümana link verildi.
- Phase 18 testleri:
  - `cd guardian && npm run verify` ✅
  - `cd guardian/guardian-cli && cargo test` ✅ (13/13)

### v1.2.2 UX - Phase 19 (Collapsible Sidebar + Details Fold) (2026-02-17)
- Amaç:
  - Sol menüde (sidebar) “navigation” ile “detay/telemetri” içeriklerini ayırarak kalabalığı azaltmak.
  - Menüyü açılır/kapanır (icon rail) hale getirerek dar ekranlarda ve yoğun projelerde kullanılabilirliği artırmak.
- Uygulanan değişiklikler:
  - `guardian/src/components/layout/ControlSidebar.tsx`
    - Sidebar collapse/expand eklendi (persist: `localStorage`).
    - “Details” fold eklendi: Cost Metric + Baseline + Engine Status + auth/api-key banner’ları artık isteğe bağlı görünür.
    - Navigation butonları icon-only modda da erişilebilir olacak şekilde `aria-label` ile stabilize edildi.
  - `guardian/tests/e2e/app.spec.ts`
    - Sidebar stats testi “Details” açıldıktan sonra Cost Metric görünürlüğünü kontrol edecek şekilde güncellendi.
- Phase 19 testleri:
  - `cd guardian && npm run verify` ✅ (unit + coverage gate + e2e + build + rust test)
  - `cd guardian/guardian-cli && cargo test` ✅ (13/13)

### v1.2.2 UX - Phase 20 (Sidebar Dock Polish: Collapsed Rail + Unified Details Panel) (2026-02-17)
- Amaç:
  - Collapse modda “kırık/kırpılmış” görünümü engellemek ve icon-rail tasarımını daha dengeli hale getirmek.
  - Expanded modda “dağınık kartlar” yerine tek bir Workspace kartı içinde birleşik bir Details paneli kullanmak.
- Uygulanan değişiklikler:
  - `guardian/src/components/layout/ControlSidebar.tsx`
    - Collapsed mod artık sadece dock/rail: nav ikonları + scope + details aksiyonları.
    - Details panel collapsed modda asla render edilmez (clipping yok); “Details” tıklanınca sidebar expand olur ve panel açılır.
    - Launch/Kill butonu collapsed modda icon-only hale getirildi (text wrap / taşma yok).
    - Details içeriği ayrı kartlar yerine tek panelde bölümlere ayrıldı (Cost Metric / Baseline / Engine).
- Phase 20 testleri:
  - `cd guardian && npm run verify` ✅
  - `cd guardian/guardian-cli && cargo test` ✅ (13/13)

### v1.2.2 Stability - Phase 21 (Ollama Reliability: Better Errors + Longer Timeout + Initial Scan Pruning) (2026-02-17)
- Amaç:
  - “Failed to send request to AI provider” gibi genel hataları gerçek sebebiyle (timeout/connection refused) görünür kılmak.
  - Ollama için daha gerçekçi timeout default’u sağlamak ve kullanıcı override’ını kısıtlamamak.
  - İlk taramada gereksiz klasörlere (node_modules/target vb.) girip binlerce dosyayı “skip” ederek zaman kaybetmeyi azaltmak.
- Uygulanan değişiklikler:
  - `guardian/src-tauri/src/config.rs`
    - Maksimum timeout üst sınırı artırıldı (`MAX_TIMEOUT_SECS=600`).
    - Ollama için default timeout daha yüksek (`>=180s`), env ile override destekleniyor (`GUARDIAN_TIMEOUT_OLLAMA`).
  - `guardian/src-tauri/src/watcher.rs`
    - Provider hataları artık tam error-chain ile toplanıyor (`format!("{e:#}")`).
    - Initial scan: `filter_entry` ile ignored segment’ler erken prune ediliyor (devasa klasörlere descent yok).
    - Ollama send-failure timeout ise daha net hint veriliyor.
  - `guardian/src-tauri/src/ai_client.rs`
    - Ollama send error context artık URL içeriyor (debug daha kolay).
- Phase 21 testleri:
  - `cd guardian && npm run verify` ✅
  - `cd guardian/guardian-cli && cargo test` ✅ (13/13)

## Kararlar ve Varsayımlar (Kilitleme)

### 1. CI'da Cloud AI Kullanımı
**Karar:** ✅ **Evet, cloud AI kullanılabilir**

- Guardian CLI cloud AI provider (Anthropic, OpenAI) kullanabilir
- **Ancak:** "Mock/Deterministik" mod da şart
  - `GUARDIAN_MOCK=1` ile offline test
  - `GUARDIAN_OFFLINE=1` ile AI'sız kural bazlı tarama (basit regex/pattern)
- CI'da maliyet kontrolü için token limit ve caching mekanizması

### 2. Baseline Amacı ve UI Davranışı
**Karar:** 📊 **"Default'ta yeni/regresyon göster, istenirse hepsini gör"**

- **Default View:** Sadece `is_new=true` olanlar gösterilir
- **Filtre Seçenekleri:**
  - "Show All" - Tüm bulgular (is_new/is_active/is_resolved flag'leriyle)
  - "New Since Baseline" - Sadece yeni (default)
  - "Resolved" - Düzeltilenler
  - "Critical" - Seviyeye göre filtre
- **Gösterim:** Her bulgu yanında badge: 🆕 New | ✅ Resolved | ⚪ Active
- **Hedef:** "Borç" gizlenmiyor, sadece gürültü azaltılıyor

### 3. finding_id Stabilizasyonu
**Karar:** 🔐 **rule_id + file_path + location (line/column)**

- AI message'i değişken olduğu için hash'e **dahil edilmeyecek**
- rule_id: Örnek: "sql-injection-raw", "unsafe-unwrap", "deprecated-api"
- AI model/prompt versiyonu değişse bile aynı issue aynı ID'yi alır
- Baseline karşılaştırması bu ID üzerinden yapılır

### 4. Fix Proposal Formatı
**Karar:** 📄 **Tam dosya içeriği (Full-file-content)**

- Mevcut `patcher.rs` ile uyumlu
- Diff parçası yerine önerilen dosyanın tam hali
- `original_content_hash` ile çakışma kontrolü
- Güvenlik: Path traversal, .guardian/ yazma, secret içerme kontrolleri

### 5. Redaction Zamanlaması
**Karar:** 🛡️ **Phase 0'da Minimum Gate, Phase 3'te Advanced**

**Phase 0 (Minimum):**
- Sensitive file skip (.env, .key, vb.)
- Inline secret masking (API key pattern'leri)

**Phase 3 (Advanced):**
- UI preview (ne gittiğini göster)
- Audit log
- Detaylı regex'ler
- Token sayacı

### 6. Agent Protocol Stratejisi
**Karar:** 🔄 **Mevcut sistemi stabilize etme, sıfırdan yazma değil**

**Zaten var:** agent_queue.jsonl, history.jsonl, STALL, critiques.md
**Eklenecek:** critiques.json (AI için), AGENT_INSTRUCTIONS.md
**Değişecek:** Finding ID'ler stabil hale getirilecek

### 7. CLI Dağıtımı
**Karar:** 🚀 **Pre-built Binary + GitHub Action Composite**

- GitHub Releases'te binary'ler (Linux x64, macOS x64/ARM)
- `.github/actions/guardian/` bu repo'da composite action
- `cargo install` yerine binary download (hız için)

---

## Sonuç

Bu roadmap Guardian'ı **önce stabil ve güvenilir**, sonra **AI entegre** bir araç haline getirmeyi hedefliyor.

**Ana prensipler:**
1. **Güvenlik > Kolaylık** - Secret'lar asla risk altında olmamalı
2. **İnsan kontrolü** - AI önerir, insan karar verir
3. **Az gürültü** - Sadece anlamlı bulgular göster
4. **Entegrasyon** - CI/CD olmadan tam bir araç değil

**Başlangıç için önerim:**
Phase 0 + Phase 1 (Baseline) ile başla. Bu bile Guardian'ı çok daha kullanılabilir hale getirecektir.
