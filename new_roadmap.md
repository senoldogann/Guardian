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
- [x] UI'da filtreleme çalışıyor

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
- [ ] guardian-cli binary derleniyor
- [ ] JSON ve SARIF output doğru formatta
- [ ] GitHub Actions'da çalışıyor
- [ ] Baseline ile birlikte kullanılabiliyor
- [ ] Exit code'lar doğru çalışıyor

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

**Yeni Modül:** `redaction.rs`

**Hassas Dosya Pattern'leri:**
```rust
const SENSITIVE_PATTERNS: &[&str] = &[
    ".env",
    ".env.local",
    ".env.production",
    ".key",
    ".pem",
    ".p12",
    ".pfx",
    "id_rsa",
    "id_ed25519",
    ".htpasswd",
    "credentials",
    "secrets",
    "*.secret",
    ".npmrc",
    ".pypirc",
    "docker-compose.override.yml",
];

const SENSITIVE_EXTENSIONS: &[&str] = &[
    "key", "pem", "p12", "pfx", "cer", "crt", "der"
];
```

**İçerik Taraması:**
```rust
pub fn contains_secrets(content: &str) -> Vec<SecretMatch> {
    // Regex'ler:
    // - API Key: sk-[a-zA-Z0-9]{48}
    // - AWS Key: AKIA[0-9A-Z]{16}
    // - JWT: eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*
    // - Private Key: -----BEGIN (RSA | OPENSSH | EC) PRIVATE KEY-----
    // - DB URL: postgres://.*:.*@ | mysql://.*:.*@
}
```

**Redaction Mantığı:**
- Dosya adı hassas mı? -> Hiç analiz etme, "[REDACTED - sensitive file]" olarak geç
- İçerik secret içeriyor mu? -> Secret pattern'leri `[REDACTED]` ile değiştir
- Dosya büyük mü? (>100KB) -> Özet gönder, tam içerik gönderme

#### 3.2 UI: Outbound Preview

**Yeni Component:** `AIContextPreview`

**Monitor View'de:**
- "AI Context" sekmesi (yan sekme)
- Gönderilecek payload'ı göster (truncated + masked)
- "Sensitive content redacted" uyarısı
- Token sayacı (tahmini)

**Chat View'da:**
- Her AI mesajı öncesinde "Context contains N files, M redacted"

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
  "tokens_out": 250
}
```

**Rotasyon:** 30 gün veya 10MB sonra archive

#### 3.4 Güvenlik Ayarları (Settings)

**Yeni Sekme:** "Security"

- [x] Redact sensitive files (default: on)
- [x] Redact detected secrets (default: on)
- [x] Log AI interactions (default: on)
- [ ] Allow AI to suggest fixes for security issues (default: off - Phase 5'te)
- Max file size: [100KB] slider

### Test Plan
1. **Unit:** Hassas dosya tespiti
2. **Integration:** Secret içeren dosya analiz edilmiyor mu?
3. **E2E:** UI'da redaction gösteriliyor mu?
4. **Security:** History log'a secret yazılmıyor mu?

### Acceptance Criteria
- [ ] .env dosyası AI'a gitmiyor
- [ ] API key içeren kod `[REDACTED]` olarak maskeleniyor
- [ ] History log tutuluyor
- [ ] Kullanıcı outbound context'i görebiliyor

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

**Yeni Eklenecek:**
- `critiques.json` - AI için makine okunur snapshot
- `AGENT_INSTRUCTIONS.md` - AI kuralları ve protokol dokümantasyonu
- Finding ID stabilizasyonu (deterministik):
  ```rust
  fn finding_id(rule_id: &str, file: &str, location: Option<usize>, rules_hash: &str) -> String {
      // AI message'i değişken olduğu için rule_id kullan
      let loc = location.map(|l| l.to_string()).unwrap_or_default();
      let normalized = format!("{}|{}|{}|{}", rule_id, file, loc, rules_hash);
      sha256(normalized)
  }
  ```

#### 4.3 Queue Yönetimi

**Rotasyon:**
- `agent_queue.jsonl` > 1MB ise `agent_queue.2026-02-09.jsonl` olarak archive
- Max 5 archive tut, eskileri sil

**Tail desteği:**
- AI agent'ler `tail -f .guardian/agent_queue.jsonl` ile real-time izleyebilir

### Test Plan
1. **Unit:** critiques.json schema validasyonu
2. **Integration:** Event'ler doğru yazılıyor mu?
3. **Manual:** Cursor/Copilot ile test (AI critiques.json'u okuyabiliyor mu?)

### Acceptance Criteria
- [ ] critiques.json AI tarafından okunabilir
- [ ] agent_queue.jsonl real-time güncelleniyor
- [ ] Finding ID'ler deterministik
- [ ] Archive rotasyonu çalışıyor

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

**Yeni Dosya:** `.guardian/fix_proposals.jsonl`

**Önemli:** watcher.rs şu an `.guardian/` altını ignore ediyor. Bu yüzden Phase 5'te iki seçenekten biri netleşmeli:
1) `.guardian/fix_proposals.jsonl` için **istisna** (chat.md gibi) ekle
2) Fix proposals dosyasını `.guardian/` dışında, örn. `.guardian-proposals/` altında tut

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

**Önemli:** Mevcut `patcher.rs` full-file-content beklediği için, proposal da **tam dosya içeriği** sunmalı. Diff parçası yerine, önerilen yeni dosyanın tam hali. Bu sayede:
1. Patch çakışması riski azalır
2. Patcher mevcut güvenlik kontrollerini kullanır
3. Kullanıcı review'da tam dosyayı görebilir

**Akış:**
1. AI `fix_proposals.jsonl`'ye proposal yazar
2. Watcher bunu tespit eder
3. UI'da "Review Pending Fixes" bildirimi çıkar
4. Kullanıcı review eder (approve/reject/edit)
5. Onaylanırsa patch uygulanır

#### 5.2 Watcher Entegrasyonu

**Değişiklikler:**
- `.guardian/fix_proposals.jsonl`'i izle (watcher audit etmez)
- Yeni proposal gelince UI'ya event gönder (Tauri emit)
- Proposal durumunu takip et

#### 5.3 UI - Review Paneli

**Yeni View:** `ReviewView`

**Ekran:**
```
┌──────────────────────────────────────────────────────┐
│ Pending Fix Reviews (3)                              │
├──────────────────────────────────────────────────────┤
│ 🔴 Critical: SQL Injection in src/db.rs             │
│    Proposed by: AI Agent                             │
│    Confidence: 89%                                   │
│                                                      │
│    [View Diff] [Approve] [Edit] [Reject]            │
│                                                      │
│    --- Original (Line 15-20)                         │
│    +++ Proposed                                      │
│    @@                                               │
│    -  conn.execute(&format!("SELECT ...", id));     │
│    +  conn.execute("SELECT ...", [id])?;            │
└──────────────────────────────────────────────────────┘
```

**İşlemler:**
- **View Diff:** Side-by-side diff göster
- **Approve:** Patch uygula, git commit öner (mesaj hazır)
- **Edit:** Öneriyi düzenle ( Monaco editor veya textarea)
- **Reject:** Reddet, sebep sor (AI learning için)

#### 5.4 Patcher Güvenlik Kontrolleri

**Mevcut `patcher.rs` güçlendirmeleri:**
```rust
pub fn apply_proposal(proposal: &FixProposal) -> Result<()> {
    // 1. Original content hash kontrolü (dosya değişmiş mi?)
    let current_hash = sha256(fs::read(&proposal.file_path)?);
    if current_hash != proposal.original_content_hash {
        return Err("File has changed since proposal was created");
    }
    
    // 2. Path traversal kontrolü
    if proposal.file_path.contains("..") || !proposal.file_path.starts_with(workspace_root) {
        return Err("Invalid file path");
    }
    
    // 3. .guardian/ yazma kontrolü
    if proposal.file_path.contains(".guardian/") {
        return Err("Cannot modify .guardian files");
    }
    
    // 4. Secret içeriyor mu?
    if contains_secrets(&proposal.proposed_content) {
        return Err("Proposed fix contains potential secrets");
    }
    
    // 5. Derleme kontrolü (opsiyonel ama önerilir)
    // Önce temp dosyaya yaz, cargo check çalıştır, başarılıysa gerçek dosyaya uygula
    
    // 5. Apply (full-file-content)
    apply_full_file(&proposal.file_path, &proposal.proposed_content)?;
    
    Ok(())
}
```

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
- [ ] Proposal dosyası oluşturulabiliyor
- [ ] Review UI'sı çalışıyor
- [ ] Patch güvenli bir şekilde uygulanıyor
- [ ] Hiçbir fix otomatik uygulanmıyor
- [ ] Git entegrasyonu (varsa) çalışıyor

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
