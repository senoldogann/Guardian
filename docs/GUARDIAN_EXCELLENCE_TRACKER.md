# Guardian Excellence Tracker (Quality + Speed + Moat)

Last Updated: 2026-03-15T14:35:00Z  
Owner: Guardian Team  
Workspace: `/Users/dogan/Desktop/guardian`

## Global Working Rules
- [x] Faz bazlı sıralı ilerleme
- [x] Her faz: Goal, Tasks, Test Gate, Entry Gate, Exit Gate
- [x] Her faz sonunda Completion Log doldurma
- [x] Tamamlanan maddeler `[x]` ile işaretlenir
- [x] Unit + Integration + E2E + `python3 scripts/verify_all.py` kapıları
- [x] Gerekli olduğunda web/research doğrulaması

---

## Faz E1 — Signal Precision Hardening (IN_PROGRESS)
### Goal
Warning/Critical doğruluğunu artırmak, düşük sinyal gürültüyü düşürmek, önerileri bağlama uygun hale getirmek.

### Entry Gate
- [x] Watcher signal filtreleme noktaları belirlendi.
- [x] Kritik/uyarı ayrımı için kalibrasyon stratejisi tanımlandı.

### Tasks
- [x] Low-signal warning suppression eklendi (`GUARDIAN_ALLOW_LOW_SIGNAL_WARNINGS` override ile).
- [x] Zayıf Critical bulgularını Warning’e otomatik kalibre etme eklendi.
- [x] Bağlama göre suggestion shaping eklendi (Rust/TS/Python/Swift/config/security/timeout).
- [x] AI batch prompt’una low-noise + severity discipline + context-aware suggestion kuralları eklendi.

### Test Gate
- [x] Unit: `watcher::tests_protocol::precision_calibration_filters_low_signal_warning`
- [x] Unit: `watcher::tests_protocol::precision_calibration_downgrades_weak_critical`
- [x] Integration: `watcher::tests_protocol::governance_summary_files_are_written_with_sync`
- [ ] E2E: gerçek repo üzerinde false-positive drop oranı doğrulaması
- [x] `python3 scripts/verify_all.py`

### Exit Gate
- [ ] Pilot veri setinde false-positive oranı hedefe çekildi (hedef: en az %30 düşüş).
- [ ] Critical precision raporu yayınlandı.

### Completion Log
- Completion Date: N/A
- Evidence:
  - `src-tauri/src/watcher.rs`
  - `src-tauri/src/ai_client.rs`
  - yukarıdaki unit/integration test çıktıları
- Notes:
  - `cargo test -q` tüm suite içinde `semantic_index` testi uzun sürme eğiliminde; ayrı izleme gerektiriyor.

---

## Faz E2 — Unified Governance Outputs (IN_PROGRESS)
### Goal
IDE, CLI ve LLM ajanların aynı dili konuşacağı tekil çıktı yüzeyi oluşturmak.

### Entry Gate
- [x] `.guardian` altında runtime artifact üretim noktaları net.

### Tasks
- [x] `.guardian/governance_summary.json` üretimi eklendi.
- [x] `.guardian/governance_summary.md` üretimi eklendi.
- [x] Çıktıya consumer guide (IDE/CLI/LLM agents) alanları eklendi.

### Test Gate
- [x] Unit/Integration: summary dosyalarının yazımı doğrulandı.
- [ ] E2E: UI + CLI aynı summary dosyasını referanslıyor doğrulaması
- [x] `python3 scripts/verify_all.py`

### Exit Gate
- [ ] Tüm ekip rolleri aynı output contract ile operasyon yapabiliyor.

### Completion Log
- Completion Date: N/A
- Evidence:
  - `src-tauri/src/watcher.rs`
  - `.guardian/governance_summary.json`
  - `.guardian/governance_summary.md`

---

## Faz E3 — Moat Foundations (IN_PROGRESS)
### Goal
Rakiplerin kopyalaması zor governance katmanını operasyonel hale getirmek.

### Entry Gate
- [x] Moat backlog tanımlandı.

### Tasks
- [x] Governance Replay scripti eklendi: `scripts/governance_replay.py`
- [x] Override Debt Ledger scripti eklendi: `scripts/override_debt_ledger.py`
- [x] Haftalık rapor pipeline’ına entegre edildi: `scripts/pilot_generate_weekly_report.sh`
- [ ] Dual-AI adversarial review orchestration
- [ ] Patch-proof suggestion doğrulaması (compile/test smoke gate)
- [ ] Release decision receipt hashing/signing

### Test Gate
- [x] Replay script smoke
- [x] Override debt script smoke
- [x] Weekly report orchestration smoke
- [ ] Integration: pilot repo setinde drift/borç trend doğrulaması
- [x] `python3 scripts/verify_all.py`

### Exit Gate
- [ ] 5 moat’in en az 3’ü production pilotta aktif
- [ ] Haftalık governance review dashboard’u ekipte kullanılmaya başlandı

### Completion Log
- Completion Date: N/A
- Evidence:
  - `scripts/governance_replay.py`
  - `scripts/override_debt_ledger.py`
  - `scripts/pilot_generate_weekly_report.sh`
  - `.guardian/governance-replay/2026-03-15/replay_summary.json`
  - `.guardian/override_debt_ledger.json`
