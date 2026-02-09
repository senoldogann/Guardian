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

3. **Modül Yapısı**
   ```
   src/
   ├── baseline/          # Yeni
   ├── ci/               # Yeni
   ├── agent_protocol/   # Yeni (sadece schema)
   ├── redaction/        # Yeni
   └── ...existing modules
   ```

### Acceptance Criteria
- [ ] `cargo test` başarılı
- [ ] Yeni modüller mevcut watcher'ı bozmuyor
- [ ] Branch merge conflict yok

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
  "schema_version": "1",
  "created_at": "2026-02-09T10:00:00Z",
  "workspace_id": "sha256(/path/to/workspace)",
  "rules_hash": "sha256(rules.md content)",
  "finding_ids": [
    "sha256(file_path + severity + normalized_message)",
    "..."
  ]
}
```

#### 1.2 Yeni Modül: `baseline.rs`

**Fonksiyonlar:**
```rust
pub struct BaselineManager {
    workspace_root: PathBuf,
}

impl BaselineManager {
    /// Baseline oluştur (mevcut bulgulardan)
    pub fn create_baseline(&self, critiques: &[Critique]) -> Result<Baseline>;
    
    /// Yeni/regresyon bulguları filtrele
    pub fn filter_new_findings(&self, current: &[Critique], baseline: &Baseline) -> Vec<Critique>;
    
    /// Baseline geçerlilik kontrolü (rules_hash değişmiş mi?)
    pub fn is_baseline_valid(&self, baseline: &Baseline) -> bool;
    
    /// Status raporu (active, new, resolved sayıları)
    pub fn get_status(&self, baseline: &Baseline, current: &[Critique]) -> BaselineStatus;
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
- [ ] Baseline oluşturulabiliyor
- [ ] Eski bulgular "new" olarak işaretlenmiyor
- [ ] Rules değişince baseline invalid sayılıyor
- [ ] UI'da filtreleme çalışıyor

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

#### 2.2 GitHub Actions

**Dosya:** `.github/workflows/guardian.yml` (template olarak dokümante edilecek)

**Kullanım:**
```yaml
name: Guardian Security Scan

on: [pull_request]

jobs:
  guardian:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Guardian
        uses: guardian/action@v1  # Gelecekte
        with:
          provider: anthropic
          api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          baseline: '.guardian/baseline.json'
      
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

**Mapping:**
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
      "level": "error",  // critical -> error, warning -> warning
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

## Phase 3: Güvenlik ve Gizlilik Hardening (1-2 Hafta)

### Hedef
Secret'ların AI'a sızmasını önlemek, audit trail oluşturmak, kullanıcıya transparanlık sağlamak.

### Neden Şimdi?
- CI entegrasyonu öncesi güvenlik kritik
- Kullanıcı güveni için şart
- Sonrasında agent entegrasyonu güvenle yapılabilir

### Implementation

#### 3.1 Context Redaction (Kritik!)

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

**Schema:**
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

## Phase 4: Agent Protocol v1 - Gözlem Modu (2-3 Hafta)

### Hedef
AI editor'lerin (Cursor, Copilot, vb.) Guardian'ı okuyabilmesi için standart bir protokol. **Sadece gözlem, otomatik düzeltme yok.**

### Neden "Gözlem Modu"?
- AI'nin otomatik düzeltmesi riskli
- Önce "AI okusun" mantığıyla başlayıp, kullanıcı feedback'i alıp sonra auto-fix eklemek daha güvenli
- AI agent'ler zaten file system'i okuyabiliyor, Guardian çıktılarını standart formatta verelim

### Implementation

#### 4.1 Protocol Schema v1

**Dosyalar:** (hepsi `.guardian/` altında)

1. **`critiques.json`** - Tam snapshot (AI için makine okunur)
```json
{
  "protocol_version": "1",
  "timestamp": "2026-02-09T10:00:00Z",
  "workspace_id": "sha256(/path)",
  "rules_hash": "sha256(...)",
  "critiques": [
    {
      "finding_id": "sha256(...)",
      "file_path": "src/db.rs",
      "severity": "critical",
      "category": "security",
      "message": "Raw SQL detected",
      "line": null,  // v2'de eklenebilir
      "content_hash": "sha256(file content)",
      "is_new": true,  // baseline'e göre
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

#### 4.2 Watcher Entegrasyonu

**Değişiklikler:**
- Her critique event'i `agent_queue.jsonl`'e yaz
- `critiques.json`'u her sync'de yeniden yaz (atomic write)
- Finding ID hesaplama (deterministik):
  ```rust
  fn finding_id(file: &str, severity: &str, msg: &str) -> String {
      let normalized = format!("{}|{}|{}", file, severity, msg.trim());
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

**Schema:**
```json
{
  "proposal_id": "uuid",
  "timestamp": "2026-02-09T10:00:00Z",
  "finding_id": "sha256(...)",
  "file_path": "src/db.rs",
  "status": "pending",  // pending | reviewing | approved | rejected | applied
  "proposed_by": "ai-agent",  // veya "user"
  "original_content_hash": "sha256(...)",  // Patch uygulanabilir mi kontrolü için
  "suggestion": "Use parameterized queries",
  "diff": {
    "old_range": { "start": 15, "end": 20 },
    "new_content": "// New code here\nconn.execute(\"SELECT * FROM users WHERE id = ?\", [user_id])?;"
  },
  "confidence": 0.89,
  "reasoning": "Prevents SQL injection by using prepared statements"
}
```

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
    if contains_secrets(&proposal.diff.new_content) {
        return Err("Proposed fix contains potential secrets");
    }
    
    // 5. Apply
    apply_diff(&proposal.file_path, &proposal.diff)?;
    
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

### Dosya Yapısı (Son Hali)

```
guardian/
├── src-tauri/
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── watcher.rs              # Var olan
│       ├── ai_client.rs            # Var olan
│       ├── patcher.rs              # Var olan
│       ├── skills/
│       │   ├── mod.rs
│       │   ├── hasher.rs           # Var olan
│       │   └── rules.rs            # Var olan
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
