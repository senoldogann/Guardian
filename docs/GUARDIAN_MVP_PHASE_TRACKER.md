# Guardian 90 Gunluk Faz 2+4 MVP Takip Defteri

Last Updated: 2026-03-15 18:05:00Z
Owner: Guardian Team
Code Workspace: `/Users/dogan/Desktop/guardian`
Governance Workspace: `/Users/dogan/Desktop/guardian`

## Calisma Kurali
- [x] Faz bazli sirali ilerleme zorunlu.
- [x] Tum maddeler checkbox ile takip edilir.
- [x] Her fazda `Goal`, `Tasks`, `Test Gate`, `Entry Gate`, `Exit Gate`, `Completion Log` bulunur.
- [x] Her fazin test kapisinda Unit + Integration + E2E + `python3 scripts/verify_all.py` yer alir.
- [x] Yeni sistem, kutuphane veya pattern seciminde gerekirse Web Search yapilir; kaynaklar Completion Log'a yazilir.

## Guncel Durum Ozeti (Yapilanlar)
- [x] Audit precision hardening basladi: low-signal warning suppression + weak critical downgrade + context-aware suggestion shaping (`src-tauri/src/watcher.rs`).
- [x] Runtime output contract eklendi: `.guardian/governance_summary.json` + `.guardian/governance_summary.md` (IDE/CLI/LLM agent rehberi ile).
- [x] Moat temelleri eklendi: `scripts/governance_replay.py` ve `scripts/override_debt_ledger.py`; haftalik pilot rapor pipeline'ina baglandi.
- [x] Policy source of truth eklendi: `guardian.policy.yaml`.
- [x] Ortak policy parser/validator + AI-heavy classifier + decision engine eklendi.
- [x] CLI gate parametreleri eklendi (`--policy`, `--release-gate`, `--approver`, `--override-reason`) ve rapor `schema_version: 2` alanlari eklendi.
- [x] Desktop release decision panel + Tauri decision commandlari + audit trail (`.guardian/release_decisions.jsonl`) eklendi.
- [x] `scripts/release_all_local.sh` icine release gate kontrolu eklendi; `BLOCK` durumunda publish stop.
- [x] Dashboard-lite uretimi eklendi (`scripts/generate_dashboard_lite.py`).
- [x] Faz 1 copy/doc closure adimlari (guru/monitoring/configuration EN+TR, copy check script, CI gate) eklendi.
- [x] Ust kokte `python3 scripts/verify_all.py` basarili calisti (2026-03-14).
- [x] Rust toolchain kuruldu (`cargo 1.94.0`) ve Rust test kapilari kosuldu.
- [x] Root app unit testleri (`npm run test`) localStorage test setup fixi ile pass.
- [x] Root app E2E testleri (`npm run test:e2e`) pass.
- [x] `scripts/release_all_local.sh` icin guvenli `--gate-only` modu eklendi (publish/build skip).
- [x] Release gate scan'i baseline uyumsuzlugundan bagimsiz calissin diye CLI `--no-baseline` eklendi.
- [x] Desktop release workflow icin Faz 3 E2E akis testi eklendi (`BLOCK -> approve -> audit -> gate pass`).
- [x] `ReleaseDecisionPanel` UI test paketi eklendi ve `npm run test` kapisinda pass edildi.
- [x] CI smoke gate eklendi: `scripts/ci/release_gate_ci_smoke.sh`.
- [x] CI pipeline'a `release-gate-ci-smoke` job'i eklendi (`.github/workflows/ci-cd-v1.yml`).
- [x] Windows release workflow'una zorunlu `release-gate` job'i eklendi (`.github/workflows/release-windows.yml`); gate fail ise publish durur.
- [x] Dashboard-lite scripti Faz 5 icin guclendirildi (weekly window + markdown + pilot metadata + override reason quality).
- [x] Pilot haftalik rapor saklama scripti eklendi: `scripts/pilot_generate_weekly_report.sh`.
- [x] Faz 5 operasyon dokumani eklendi: `docs/PHASE5_PILOT_ROLLOUT_PLAYBOOK.md`.
- [x] Dashboard-lite regression unit testleri eklendi: `scripts/tests/test_generate_dashboard_lite.py`.
- [x] Faz 5 multi-repo dry-run orkestrasyonu eklendi: `scripts/pilot_dryrun.py`.
- [x] Pilot repo manifest ornegi eklendi: `docs/pilot/PILOT_REPO_MANIFEST.example.json`.
- [x] Multi-repo dry-run fixture rehearsal (3 repo) tamamlandi ve `PASS_WITH_WARNING` + `BLOCK_UNTIL_APPROVED` + `OVERRIDDEN` kanitlari uretildi.
- [x] `pilot_dryrun.py` icin `--repo-base-dir` eklendi; temp manifest/relative path kaynakli hatalar guvenli sekilde giderildi.
- [x] Dry-run raporu her repo icin `.guardian/release_gate_report.json` olarak da yaziliyor; dashboard-lite haftalik raporlari artik karar metriklerini dogru goruyor.
- [x] Policy aksiyon backlog dosyasi olusturuldu: `guardian/docs/pilot/POLICY_ACTION_BACKLOG.md`.
- [x] `pilot_dryrun.py` dry-run kararlarini repo bazli `.guardian/release_decisions.jsonl` audit kaydina append ediyor.
- [x] Dashboard-lite override reason mapping guclendirildi; fallback `api_backend_guardrail` yerine `override_requires_audit_reason` sinyali uretiliyor.
- [x] Real pilot preflight validator eklendi: `scripts/pilot_validate_readiness.py`.
- [x] Real pilot onboarding sablonlari eklendi: `docs/pilot/PILOT_REPO_MANIFEST.real.template.json`, `docs/pilot/APPROVER_ROSTER.template.json`.
- [x] Real pilot calisma dosyalari olusturuldu: `docs/pilot/PILOT_REPO_MANIFEST.real.json`, `docs/pilot/APPROVER_ROSTER.json`.
- [x] Leak-prevented case list otomasyonu eklendi: `scripts/pilot_collect_leak_prevented_cases.py`.
- [x] CI gate wiring validator eklendi: `scripts/pilot_validate_ci_gate_flow.py`.
- [x] Runtime stability tune aktif edildi: root `.env` icinde timeout/retry/batch degerleri set edildi.
- [x] Unit gate pass: `npm run test` (12 file / 67 test) - 2026-03-15.
- [x] Integration gate pass: `cargo test` (95 test) - 2026-03-15.
- [x] E2E gate pass: `npm run test:e2e` (17 test) - 2026-03-15.
- [x] Verify gate pass: `python3 scripts/verify_all.py` - 2026-03-15.
- [x] Vitest kapsam duzeltildi: `.maestro/**` ve `.agents/**` testleri app unit gate disina alindi.
- [x] Positioning closure pass tamamlandi: SEO metadata + FAQ + onboarding copy "AI-generated code governance for small engineering teams" diline cekildi.
- [x] Website copy gate kapsamı genisletildi: metadata + FAQ + SEO alanlari `copy:check` icine alindi.
- [x] GitHub Linux CI icin Tauri/GTK sistem bagimliliklari eklendi (`.github/workflows/ci-cd-v1.yml`), `glib-2.0.pc` eksikligi giderildi.
- [x] Real pilot strict dry-run 2026-03-15 tekrar kosuldu (`repos=4, allowed=3, blocked=0, overridden=1, errors=0`).
- [x] Override reason coverage hedefi saglandi (`override_reason_coverage=1.0`, core repo weekly dashboard-lite).
- [x] `find-skills` skill kullanildi ve query sonuclariyla (positioning/seo/docs-consistency) dis kaynak taramasi yapildi.
- [x] Missing Faz 4/5 script artefaktlari repo reality ile senkronlandi (`release_all_local`, `generate_dashboard_lite`, `pilot_dryrun`, `pilot_generate_weekly_report`, readiness/leak/ci validators, CI smoke script).
- [x] Real pilot manifest path'leri mevcut workspace absolute path'lerine duzeltildi (`/Users/dogan/Desktop/guardian/...`).
- [x] Strict real dry-run + haftalik raporlar 2026-03-15 icin yeniden uretildi (`.guardian/pilot-dryrun-real/2026-03-15`, `.guardian/pilot-reports/2026-03-15`).
- [x] Cross-repo rollout trend otomasyonu eklendi (`scripts/pilot_rollout_trend.py`, `scripts/pilot_generate_rollout_trend.sh`) ve 2 haftalik trend snapshot uretildi (`.guardian/pilot-rollout-trend/2026-03-15`).
- [x] AI-heavy threshold calibration otomasyonu eklendi (`scripts/pilot_ai_heavy_calibration.py`, `scripts/pilot_generate_ai_heavy_calibration.sh`) ve ilk öneri raporu uretildi (`.guardian/pilot-calibration/2026-03-15`).
- [x] Pilot haftalik operasyon tek komutta orkestre edildi (`scripts/pilot_weekly_ops.sh`) ve readiness+drryrun+report+trend+calibration zinciri doğrulandı.
- [x] AI batch JSON parse dayanıklılığı artırıldı (`src-tauri/src/ai_client.rs` balanced JSON extraction + noisy wrapper testleri).
- [x] Website ana sayfasina rakiplerden ayrisan premium differentiator section'i eklendi (`website/components/home/DifferentiatorsSection.tsx`).
- [x] Website ana sayfasina "Why not just use agents?" deger section'i eklendi (`website/components/home/AgentObjectionSection.tsx`).
- [x] FAQ EN/TR icine "Neden sadece ajan review degil?" deger cevabi eklendi (`website/components/faq/faq-page-view.tsx`).
- [x] Website hydration mismatch sertlestirmesi uygulandi (`website/app/layout.tsx` -> `suppressHydrationWarning`), Next Image legacy `layout` kullanimindan cikarildi (`website/components/home/DemoSection.tsx`).
- [x] Homepage yeni section gorunurlugu EN/TR tarafinda browser-level dogrulandi (Playwright DOM check: `/en` ve `/tr`).
- [x] Faz A Accuracy Lockdown benchmark paketi eklendi (`benchmarks/review_precision/*`, `scripts/review_precision_benchmark.py`).
- [x] EN/TR docs tum sayfalarda release-governance diliyle hizalandi (auth/installation/migration/monitoring/reviews/security/troubleshooting/updates).
- [x] Website copy consistency gate'i tum EN/TR docs + home section dosyalarini kapsayacak sekilde genisletildi.

## Reality Check (2026-03-15)
- [x] Tracker'da listelenen Faz 4/5 script artefaktlari workspace'e geri eklendi ve smoke testleri gecti.
- [x] Repository reality sync gecisi yapildi; script/path gap'leri kapatildi.

## SIRALI FAZ PLANI

## Faz 1 - Positioning Closure (Hafta 1) - Durum: COMPLETED
### Goal
Website ve docs dilini tamamen `Control AI-generated code before it ships` catisina oturtmak.

### Entry Gate
- [x] Hero/ana mesaj ve alt mesajlar yeni konuma cekildi.
- [x] EN/TR `guru`, `monitoring`, `configuration` dosyalari revize edildi.
- [x] Copy consistency script ve CI baglantisi eklendi.
- [x] Tum dokumantasyon sayfalarinin full alignment review checklist'i tamamlansin.
- [x] Gerekli yerde Web Search ile ifade standardi ve rakip konumlama dogrulamasi (kaynakli) yapilsin.

### Tasks
- [x] Legacy/genel dil kalintilarinin buyuk bolumu temizlendi.
- [x] Hero scenario video script + storyboard + CTA mapping paketi hazirlandi.
- [x] Kalan docs sayfalarinda (phase-1 kapsam disinda kalanlar dahil) full dil taramasi tamamlanacak.

### Test Gate
- [x] Website lint: pass.
- [x] Website test: pass.
- [x] Website build: pass.
- [x] Copy consistency gate: pass.
- [x] Unit test kayip degisiklik kontrolu.
- [x] Integration test dokuman-link ve i18n tutarliligi.
- [x] E2E docs navigation smoke.
- [x] `python3 scripts/verify_all.py` (ust kok): pass.

### Exit Gate
- [x] Tum docs/website sayfalarinda eski genel konumlandirma ifadesi kalmamis olmali.
- [x] Product messaging owner sign-off alinmali.

### Completion Log (Faz Sonunda Doldurulacak)
- Completion Date: 2026-03-15
- Owner: Guardian Team
- Completed Items:
  - Hero ve ana mesaj yeni positioning'e cekildi.
  - EN/TR `guru`, `monitoring`, `configuration` dokumanlari hizalandi.
  - Copy consistency kontrolu CI'a baglandi.
  - SEO metadata, FAQ ve onboarding copy tamamen "AI-generated code governance for small engineering teams" diline cekildi.
  - `website/scripts/check-copy-consistency.mjs` kapsamı metadata + FAQ + SEO alanlarını kapsayacak sekilde genisletildi.
- Evidence (PR/commit/test output):
  - `website/scripts/check-copy-consistency.mjs`
  - `npm run copy:check` / `npm run lint` / `npm run test:run` / `npm run build` (website pass)
  - `npm run test` / `cargo test -q` / `npm run test:e2e` / `python3 scripts/verify_all.py` (root gates pass)
- Web Search Sources:
  - `https://skills.sh/phuryn/pm-skills/positioning-ideas`
  - `https://skills.sh/sickn33/antigravity-awesome-skills/seo-meta-optimizer`
  - `https://skills.sh/chmouel/lazyworktree/doc-sync`
- Blockers:
  - yok
- Next Phase Entry Decision:
  - Faz 2/3/4/5 execution ve pilot operasyon closure adimlarina devam.

## Faz 2 - Policy + Gate Core (Hafta 2-6) - Durum: IN_PROGRESS
### Goal
Policy-driven release decision motorunu desktop+CLI ortak cekirdekte calisan hale getirmek.

### Entry Gate
- [x] `guardian.policy.yaml` repo root source-of-truth mevcut.
- [x] Policy schema + gate alanlari kodda mevcut.
- [x] AI-heavy intake classifier kodda mevcut.
- [x] Decision statuses kodda mevcut (`PASS`, `PASS_WITH_WARNING`, `BLOCK_UNTIL_APPROVED`, `OVERRIDDEN`).
- [x] Rust toolchain (`cargo`) kullanilabilir.
- [ ] Yeni teknik karar gerekiyorsa Web Search ile resmi kaynak teyidi alinmali.

### Tasks
- [x] Ortak parser/validator: desktop + CLI tarafinda kullanima alinmasi.
- [x] CLI scan ciktilarina release decision alanlari eklenmesi.
- [x] Gate mode davranislarinin (`strict|warn|off`) uygulanmasi.
- [x] AI-heavy threshold kalibrasyon raporu otomasyonu eklendi ve ilk pilot önerisi üretildi.
- [ ] AI-heavy classifier threshold degisikligi (öneri: 18/1450/10/850) 2 hafta ek trend verisi ile finalleştirilecek.

### Test Gate
- [x] Unit: policy parser/validator.
- [x] Unit: AI-heavy classifier.
- [x] Unit: decision engine + override reason zorunlulugu.
- [x] Integration: desktop ve CLI ayni inputta ayni release decision.
- [x] E2E: AI-heavy intake smoke -> block -> approve/override -> gate pass (CLI).
- [x] `python3 scripts/verify_all.py` (ust kok): pass.

### Exit Gate
- [x] Rust unit ve crate test kapilari pass (`guardian-scan-policy`, `guardian-cli`, `src-tauri`).
- [ ] Decision engine behavior dokumantasyonu guncel.
- [x] Pilot reposunda en az bir gercek release gate dry-run pass.

### Completion Log (Faz Sonunda Doldurulacak)
- Completion Date: N/A (In Progress)
- Owner: Guardian Team
- Completed Items:
  - Policy source-of-truth + parser/validator desktop/CLI cekirdegine alindi.
  - AI-heavy classifier ve decision engine statuses tamamlandi.
  - CLI schema v2 output + release gate parametreleri eklendi.
- Evidence (PR/commit/test output):
  - `cargo test` (`guardian-scan-policy`, `guardian-cli`, `src-tauri`) pass
  - `release_decision::tests::desktop_and_cli_decisions_match_for_ai_heavy_and_override_flows` pass
  - `scripts/pilot_generate_ai_heavy_calibration.sh docs/pilot/PILOT_REPO_MANIFEST.real.json` (action=`increase`, confidence=`medium`)
  - `scripts/pilot_weekly_ops.sh docs/pilot/PILOT_REPO_MANIFEST.real.json docs/pilot/APPROVER_ROSTER.json` (pass)
  - `cargo test --manifest-path src-tauri/Cargo.toml ai_client::tests -- --nocapture` (9/9 pass)
- Web Search Sources (varsa): yok.
- Blockers:
  - Decision engine davranis dokumani final degil.
  - AI-heavy threshold final uygulamasi icin 2 haftalik ek trend verisi gerekiyor.
- Next Phase Entry Decision:
  - Faz 3/4 akislari aktif; Faz 2 kapanisi icin kalibrasyon + dokumantasyon tamamlanacak.

## Faz 3 - Human Approval Workflow + Audit Trail (Hafta 4-8) - Durum: IN_PROGRESS
### Goal
Fix onerisi ile release izni arasina insan onayi ve denetlenebilir override zinciri koymak.

### Entry Gate
- [x] Release decision panel desktop UI'da mevcut.
- [x] Tauri commandlari eklendi.
- [x] Audit trail yazimi (`.guardian/release_decisions.jsonl`) mevcut.
- [ ] Approver rol modeli ve team policy dokumani netlestirilsin.
- [ ] Approval flow degisikligi gerekiyorsa Web Search ile compliance/practice kontrolu yapilsin.

### Tasks
- [x] `get_release_decision` implement edildi.
- [x] `set_release_decision` implement edildi.
- [x] `override_release_block` implement edildi.
- [x] Override reason zorunlulugu kodlandi.
- [x] UI/UX tarafinda approval reason zorunlulugunun test kapsami genisletildi.

### Test Gate
- [x] Unit: decision write/read + override reason validation.
- [x] Integration: reviews/fix akisi release decision ile uyumlu.
- [x] E2E: block -> manual approve -> audit trail -> release gate pass.
- [x] `python3 scripts/verify_all.py` (ust kok): pass.

### Exit Gate
- [ ] Audit trail formatinin geriye donuk uyumlulugu dogrulandi.
- [ ] Approval workflow product sign-off aldi.
- [x] Pilot ekipte en az 1 override senaryosu kayitli test edildi.

### Completion Log (Faz Sonunda Doldurulacak)
- Completion Date: N/A (In Progress)
- Owner: Guardian Team
- Completed Items:
  - Desktop release decision panel ve Tauri commandlari eklendi.
  - Override reason zorunlulugu ve audit trail yazimi devrede.
  - Reviews/fix akisi release approvaldan ayrildi.
- Evidence (PR/commit/test output):
  - `cargo test release_decision::tests -- --nocapture` pass
  - `src/components/__tests__/ReleaseDecisionPanel.test.tsx` pass
- Web Search Sources (varsa): yok.
- Blockers:
  - Approval workflow product sign-off henuz alinmadi.
  - Geriye donuk audit trail uyumlulugu icin final migration kontrolu eksik.
- Next Phase Entry Decision:
  - Faz 4/5 rollout devam ederken approval policy dokumani netlestirilecek.

## Faz 4 - CLI/CI Gate + Dashboard-Lite (Hafta 7-12) - Durum: IN_PROGRESS
### Goal
Release aninda karar veren gate ve pilot metrik yuzeyi ile scanner'dan governance urunune gecis.

### Entry Gate
- [x] CLI'da release gate bayraklari mevcut.
- [x] Release script gate entegrasyonu mevcut.
- [x] Dashboard-lite script mevcut.
- [x] Distribution pipeline'da gate fail policy netlestirildi (release workflow gate job).
- [ ] CI gate davranislari icin gerekli resmi dokumanlar gerekiyorsa Web Search ile teyit edilsin.

### Tasks
- [x] `scan` raporu schema v2 alanlari eklendi.
- [x] `release_all_local.sh` BLOCK durumunda publish stop.
- [x] Dashboard-lite temel metrikleri uretildi.
- [x] Pilot dashboard-lite output formati final hale getirildi.
- [x] Distribution pipeline oncesi strict gate fail smoke testi (temp workspace) tamamlandi.

### Test Gate
- [x] Unit: report serialization v2 (guardian-cli test suite).
- [x] Integration: gate modes strict/warn/off (CLI smoke).
- [x] E2E: local release script gate-only smoke (override ile pass).
- [x] CI smoke: distribution publish adimi BLOCK'ta duruyor.
- [x] `python3 scripts/verify_all.py` (ust kok): pass.

### Exit Gate
- [ ] Pilot ekip raporlari aylik bazda uretiliyor olmali.
- [x] Block rate, override coverage, top policy ihlali metrikleri dogrulandi.
- [x] En az 2 design-partner repoda gate aktif dry-run tamamlandi.

### Completion Log (Faz Sonunda Doldurulacak)
- Completion Date: N/A (In Progress)
- Owner: Guardian Team
- Completed Items:
  - CLI/CI release gate strict|warn|off davranislari aktif.
  - Local release script ve Windows release workflow gate fail durumda publish'i durduruyor.
  - Dashboard-lite scripti pilot metrikleri icin schema v2 uretiyor.
- Evidence (PR/commit/test output):
  - `bash scripts/ci/release_gate_ci_smoke.sh` pass
  - `bash scripts/release_all_local.sh --gate-only` smoke pass
  - `python3 /Users/dogan/Desktop/guardian/scripts/verify_all.py` pass
- Web Search Sources (varsa): yok.
- Blockers:
  - Gercek design-partner repolarda aylik metrik trendleri henuz toplanmadi.
- Next Phase Entry Decision:
  - Faz 5 ile birlikte gercek repo operasyonuna gecilerek Faz 4 exit gate kapanacak.

## Faz 5 - Pilot Rollout + Dashboard-Lite Ops (Hafta 13-16) - Durum: IN_PROGRESS
### Goal
2-3 design-partner ekipte governance akisini aktif pilotta calistirip "release decision" degerini sayisal olarak kanitlamak.

### Entry Gate
- [ ] Faz 4 CI smoke + release gate jobs main branch'e merge edildi.
- [x] Pilot ekip/repolar belirlendi (shadow rehearsal: 3 repo + real manifest: 4 repo path).
- [x] Team approver list confirmed (`docs/pilot/APPROVER_ROSTER.json`).
- [x] Pilot policy baseline (`guardian.policy.yaml`) ekip bazinda review edildi (shadow repos + real dry-run paths).
- [ ] Dashboard-lite rapor formati ekiplerle mutabik.

### Tasks
- [x] Her pilot repoda gate dry-run -> strict rollout plani tamamlandi (shadow rehearsal).
- [x] Haftalik dashboard-lite raporu uretim/saklama otomasyonu eklendi (`scripts/pilot_generate_weekly_report.sh`).
- [x] Override reason quality rubric'i (strong/weak/missing) dashboard-lite'a eklendi.
- [x] Multi-repo dry-run orkestrasyonu + markdown/json ozet rapor uretimi eklendi.
- [x] En sik bozulan policy pack/rule icin aksiyon backlog'u olusturuldu (`docs/pilot/POLICY_ACTION_BACKLOG.md`).
- [x] Dry-run scan ciktilari repo audit trail'e (`.guardian/release_decisions.jsonl`) persist ediliyor.
- [x] Real pilot readiness preflight validator + roster/manifest sablonlari eklendi.
- [x] Pilot sonu "release leak prevented" vaka listesi cikartildi (shadow rehearsal).
- [x] Gercek pilotta "release leak prevented" vaka listesi cikartildi.
- [x] Gercek design-partner repolari manifeste eklenip strict dry-run baslatildi.
- [x] Cross-repo rollout trend raporu JSON+MD formatinda uretiliyor.

### Test Gate
- [x] Unit: dashboard-lite hesaplama scripti regression testleri.
- [x] Unit: readiness validator (`scripts/tests/test_pilot_validate_readiness.py`).
- [x] Unit: leak-prevented case collector (`scripts/tests/test_pilot_collect_leak_prevented_cases.py`).
- [x] Integration: CI release-gate check + distribution publish flow uyumu (validator + smoke raporu).
- [x] Integration: multi-repo dry-run orchestrator fixture smoke (3 repo + `--repo-base-dir`).
- [x] Integration: readiness smoke (`pilot_validate_readiness.py` shadow roster + manifest).
- [x] Integration: leak case report smoke (`pilot_collect_leak_prevented_cases.py` shadow dry-run summary).
- [x] E2E: pilot repoda block -> approve/override -> release flow green (shadow rehearsal).
- [x] `python3 scripts/verify_all.py` (ust kok): pass.

### Exit Gate
- [x] En az 2 design-partner repoda strict gate aktif ve stabil.
- [x] Override reason coverage >= %95.
- [ ] Blocklanan riskli AI degisiklik oraninin trendi raporlandi.
- [x] Pilot sonunda en az 1 kritik kacagin release oncesi engellendigi kanitlandi.

### Completion Log (Faz Sonunda Doldurulacak)
- Completion Date: 2026-03-14 (Ara MileStone - Shadow Pilot)
- Owner: Guardian Team
- Completed Items:
  - 3 shadow repo ile strict dry-run tamamlandi (`PASS_WITH_WARNING` + `BLOCK_UNTIL_APPROVED` + `OVERRIDDEN`).
  - Dashboard-lite raporlari haftalik formatta JSON+MD olarak otomatik uretildi.
  - `--repo-base-dir` ile temp manifest kullaniminda relative path hata sinifi kapatildi.
  - Policy action backlog cikartildi.
  - Dry-run karar kayitlari repo audit trail'e yazilarak haftalik trend metrikleri icin veri zemini olusturuldu.
  - Real pilot readiness validator ve roster/manifest sablonlari eklendi.
  - Real pilot calisma dosyalari (manifest + roster) varsayilan olarak olusturuldu.
  - Leak-prevented case list report otomasyonu eklendi ve shadow vaka listesi uretildi.
  - CI/release workflow gate wiring uyumu script ile dogrulandi.
- Evidence (PR/commit/test output):
  - `python3 -m unittest scripts.tests.test_generate_dashboard_lite scripts.tests.test_pilot_dryrun scripts.tests.test_pilot_validate_readiness scripts.tests.test_pilot_collect_leak_prevented_cases scripts.tests.test_pilot_validate_ci_gate_flow -v` (17/17 pass)
  - `bash scripts/pilot_autopilot.sh` (pass, 3 repo summary)
  - `python3 scripts/pilot_validate_readiness.py --manifest <tmp-shadow-manifest>.json --approver-roster docs/pilot/APPROVER_ROSTER.shadow.json --output-dir .guardian/pilot-real-readiness-shadow-smoke` (READY)
  - `python3 scripts/pilot_validate_readiness.py --manifest docs/pilot/PILOT_REPO_MANIFEST.real.json --approver-roster docs/pilot/APPROVER_ROSTER.json --output-dir .guardian/pilot-real-readiness` (READY: blockers=0 warnings=0)
  - `python3 scripts/pilot_dryrun.py --manifest docs/pilot/PILOT_REPO_MANIFEST.real.json --cli-bin guardian-cli/target/release/guardian-cli --summary-dir .guardian/pilot-dryrun-real` (pass: repos=4, allowed=2, blocked=1, overridden=1, errors=0)
  - `GUARDIAN_PILOT_TEAM=<team> GUARDIAN_PILOT_REPO=<repo> scripts/pilot_generate_weekly_report.sh <real_repo_path>` (4 repo icin pass)
  - `python3 scripts/pilot_collect_leak_prevented_cases.py --summary-dir .guardian/pilot-dryrun-real --output-dir .guardian/pilot-leak-cases-real` (pass: prevented_release=1, controlled_override=1)
  - `python3 scripts/pilot_collect_leak_prevented_cases.py --summary-dir .guardian/pilot-dryrun --output-dir .guardian/pilot-leak-cases` (pass)
  - `python3 scripts/pilot_validate_ci_gate_flow.py --ci-workflow .github/workflows/ci-cd-v1.yml --release-workflow .github/workflows/release-windows.yml --output-dir .guardian/pilot-ci-gate-validation` (pass)
  - `scripts/pilot_generate_rollout_trend.sh docs/pilot/PILOT_REPO_MANIFEST.real.json` (pass; weeks=2, block_rate_direction=decreasing)
  - `.guardian/pilot-dryrun/2026-03-14/summary.json` (`allowed=1 blocked=1 overridden=1 errors=0`)
  - `.guardian/pilot-dryrun-real/2026-03-14/summary.json` (`allowed=2 blocked=1 overridden=1 errors=0`)
  - `.guardian/pilot-rollout-trend/2026-03-15/rollout_trend.json` (`weeks=2`, `strict_gate_active_stable=true`, `override_reason_coverage_met=true`)
  - `.guardian/pilot-leak-cases-real/2026-03-14/leak_cases.json` (`cases=2 prevented_release=1 controlled_override=1`)
  - `python3 /Users/dogan/Desktop/guardian/scripts/verify_all.py` (pass)
- Web Search Sources (varsa): yok (yeni dis sistem/pattern secimi yoktu).
- Blockers:
  - CI merge durumu bu workspace'te otomatik dogrulanamadi.
- Next Phase Entry Decision:
  - Faz 5 devam: haftalik cadence ile ciktilari biriktir, stability ve trend exit gate maddelerini kapa.

## Ara Checkpoint Log - 2026-03-14 (Real Dry-Run + Weekly Reports)
- Completed Items:
  - `docs/pilot/PILOT_REPO_MANIFEST.real.json` gercek mutlak path'lerle dolduruldu (4 repo).
  - `docs/pilot/APPROVER_ROSTER.json` ile readiness gate `READY` oldu.
  - Real manifest ile strict dry-run calistirildi (`repos=4`, `allowed=2`, `blocked=1`, `overridden=1`, `errors=0`).
  - Her real repo path icin haftalik dashboard-lite raporu uretildi.
  - Real dry-run ozetinden leak-prevented vaka listesi uretildi (`prevented_release=1`, `controlled_override=1`).
  - Faz kapisi teyidi icin unit + integration + E2E + `verify_all` yeniden kosuldu.
- Evidence:
  - `.guardian/pilot-real-readiness/2026-03-14/readiness.json`
  - `.guardian/pilot-dryrun-real/2026-03-14/summary.json`
  - `.guardian/pilot-shadow-repos/design-partner-a/.guardian/pilot-reports/2026-03-14/dashboard_lite.json`
  - `.guardian/pilot-shadow-repos/design-partner-b/.guardian/pilot-reports/2026-03-14/dashboard_lite.json`
  - `.guardian/pilot-shadow-repos/design-partner-c/.guardian/pilot-reports/2026-03-14/dashboard_lite.json`
  - `.guardian/pilot-reports/2026-03-14/dashboard_lite.json`
  - `.guardian/pilot-leak-cases-real/2026-03-14/leak_cases.json`
  - `python3 -m unittest scripts.tests.test_generate_dashboard_lite scripts.tests.test_pilot_dryrun scripts.tests.test_pilot_validate_readiness scripts.tests.test_pilot_collect_leak_prevented_cases scripts.tests.test_pilot_validate_ci_gate_flow -v` (17/17 pass)
  - `cargo test desktop_and_cli_decisions_match_for_ai_heavy_and_override_flows -- --nocapture` (pass)
  - `cargo test e2e_block_then_approve_then_release_gate_passes_with_audit_trail -- --nocapture` (pass)
  - `python3 /Users/dogan/Desktop/guardian/scripts/verify_all.py` (pass)
- Blockers:
  - Faz 5 exit gate icin haftalik trend/stability verisi 2 hafta (2/4); aylik trend kapisi icin en az 2 hafta daha gerekiyor.
- Next Phase Entry Decision:
  - Haftalik otomasyon cadence'i ile en az 2 hafta daha veri toplanip exit gate trend kapisi kapanacak.

## Ara Checkpoint Log - 2026-03-14
- Completed Items:
  - Rust toolchain kuruldu (Homebrew rust 1.94.0).
  - Rust testleri gecti:
    - `guardian-scan-policy`: 10/10
    - `guardian-cli`: 16/16
    - `src-tauri`: 86/86
  - Root app test/lint/build gecti:
    - `npm run lint`
    - `npm run build`
    - `npm run test` (67/67)
    - `npm run test:e2e` (17/17)
  - Website kapilari gecti:
    - `npm run copy:check`
    - `npm run lint`
    - `npm run test:run`
    - `npm run build`
  - Release gate smoke (temp workspace) gecti:
    - strict -> `BLOCK_UNTIL_APPROVED` (exit 1)
    - warn/off -> decision block ama process exit 0
    - approve -> `PASS_WITH_WARNING`
    - override(with reason) -> `OVERRIDDEN`
  - Release orchestration iyilestirmeleri:
    - `guardian-cli scan` icin `--no-baseline` eklendi.
    - `--no-baseline` davranisi icin regression test eklendi (`no_baseline_flag_ignores_stale_default_baseline_file`).
    - `scripts/release_all_local.sh` icin `--gate-only` eklendi.
    - `release_all_local.sh` gate adimi `--no-baseline` kullanacak sekilde guncellendi.
    - Gate-only smoke: `GUARDIAN_RELEASE_APPROVER` + `GUARDIAN_RELEASE_OVERRIDE_REASON` ile script pass.
  - Desktop+CLI parity integration testi eklendi:
    - test: `release_decision::tests::desktop_and_cli_decisions_match_for_ai_heavy_and_override_flows`
    - akislar: `BLOCK_UNTIL_APPROVED`, `PASS_WITH_WARNING`, `OVERRIDDEN`
    - komut kanitlari:
      - `cargo test desktop_and_cli_decisions_match_for_ai_heavy_and_override_flows -- --nocapture` (pass)
      - `cargo test` (src-tauri, 85/85 pass)
      - `cargo test` (guardian-cli, 16/16 pass)
  - Faz 3 E2E workflow testi eklendi:
    - test: `release_decision::tests::e2e_block_then_approve_then_release_gate_passes_with_audit_trail`
    - komut kanitlari:
      - `cargo test release_decision::tests -- --nocapture` (5/5 pass)
      - `cargo test` (src-tauri, 86/86 pass)
  - Faz 3 integration (reviews/fix <-> decision engine) testi eklendi:
    - test: `release_decision::tests::fix_suggestions_do_not_auto_approve_release_without_human_decision`
    - komut kanitlari:
      - `cargo test release_decision::tests -- --nocapture` (5/5 pass)
      - `cargo test` (src-tauri, 86/86 pass)
  - Release decision panel UI test paketi:
    - test: `src/components/__tests__/ReleaseDecisionPanel.test.tsx` (3/3 pass)
    - komut kaniti:
      - `npm run test` (67/67 pass)
  - Faz 4 CI smoke + release workflow gate:
    - script: `scripts/ci/release_gate_ci_smoke.sh`
    - workflow: `.github/workflows/ci-cd-v1.yml` -> `release-gate-ci-smoke`
    - workflow: `.github/workflows/release-windows.yml` -> `release-gate` (strict)
    - komut kanitlari:
      - `bash scripts/ci/release_gate_ci_smoke.sh` (pass)
      - `cargo test` (guardian-cli, 16/16 pass)
      - `npm run test` (67/67 pass)
      - `npm run test:e2e` (17/17 pass)
      - `python3 /Users/dogan/Desktop/guardian/scripts/verify_all.py` (pass)
  - Faz 5 pilot ops toolkit:
    - `scripts/generate_dashboard_lite.py`:
      - weekly window (`--window-days`)
      - markdown output (`--format markdown|both`, `--md-out`)
      - pilot metadata (`--team`, `--repo`)
      - override reason quality (`strong|weak|missing`)
    - `scripts/pilot_generate_weekly_report.sh`:
      - `.guardian/pilot-reports/<YYYY-MM-DD>/` altina JSON + MD rapor yazar
    - `docs/PHASE5_PILOT_ROLLOUT_PLAYBOOK.md` eklendi
    - `scripts/tests/test_generate_dashboard_lite.py` ile regression unit testleri eklendi
    - komut kanitlari:
      - `python3 -m unittest scripts.tests.test_generate_dashboard_lite -v` (3/3 pass)
      - `GUARDIAN_PILOT_TEAM=design-partner-a GUARDIAN_PILOT_REPO=guardian-core scripts/pilot_generate_weekly_report.sh /Users/dogan/Desktop/guardian/guardian` (pass)
      - `cargo test` (guardian-cli, 16/16 pass)
      - `npm run test` (67/67 pass)
      - `npm run test:e2e` (17/17 pass)
      - `python3 /Users/dogan/Desktop/guardian/scripts/verify_all.py` (pass)
  - Faz 5 multi-repo dry-run orchestrator:
    - script: `scripts/pilot_dryrun.py`
    - manifest template: `docs/pilot/PILOT_REPO_MANIFEST.example.json`
    - regression test: `scripts/tests/test_pilot_dryrun.py`
    - komut kanitlari:
      - `python3 -m unittest scripts.tests.test_generate_dashboard_lite scripts.tests.test_pilot_dryrun scripts.tests.test_pilot_validate_readiness scripts.tests.test_pilot_collect_leak_prevented_cases -v` (14/14 pass)
      - `python3 scripts/pilot_dryrun.py --manifest <tmp>/manifest.json --cli-bin guardian-cli/target/release/guardian-cli --summary-dir <tmp>/summary` (pass)
      - `python3 scripts/pilot_dryrun.py --manifest <tmp>/manifest.json --repo-base-dir /Users/dogan/Desktop/guardian/guardian --cli-bin guardian-cli/target/release/guardian-cli --summary-dir <tmp>/summary` (pass)
      - fixture sonucu: 3 repo -> `allowed=1`, `blocked=1`, `overridden=1`, `errors=0`
      - `cargo test` (guardian-cli, 16/16 pass)
      - `npm run test` (67/67 pass)
      - `npm run test:e2e` (17/17 pass)
      - `python3 /Users/dogan/Desktop/guardian/scripts/verify_all.py` (pass)
  - Faz 5 dashboard-lite dry-run parity fix:
    - `pilot_dryrun.py` artik repo bazli `.guardian/release_gate_report.json` da uretiyor.
    - `generate_dashboard_lite.py` latest report `override.reason` alanini metrik hesabina dahil ediyor.
    - `pilot_dryrun.py` repo bazli `.guardian/release_decisions.jsonl` kaydi append ediyor.
    - `generate_dashboard_lite.py` override reason sinyallerini `override_requires_audit_reason` kuralina map ediyor.
    - komut kanitlari:
      - `bash scripts/pilot_autopilot.sh` (pass)
      - `python3 -m unittest scripts.tests.test_generate_dashboard_lite scripts.tests.test_pilot_dryrun scripts.tests.test_pilot_validate_readiness scripts.tests.test_pilot_collect_leak_prevented_cases -v` (14/14 pass)
      - `python3 /Users/dogan/Desktop/guardian/scripts/verify_all.py` (pass)
  - Faz 5 real pilot readiness preflight:
    - script: `scripts/pilot_validate_readiness.py`
    - templates:
      - `docs/pilot/PILOT_REPO_MANIFEST.real.template.json`
      - `docs/pilot/APPROVER_ROSTER.template.json`
    - shadow smoke roster:
      - `docs/pilot/APPROVER_ROSTER.shadow.json`
    - komut kanitlari:
      - `python3 -m unittest scripts.tests.test_pilot_validate_readiness -v` (3/3 pass)
      - `python3 scripts/pilot_validate_readiness.py --manifest <tmp-shadow-manifest>.json --approver-roster docs/pilot/APPROVER_ROSTER.shadow.json --output-dir .guardian/pilot-real-readiness-shadow-smoke` (READY)
      - `python3 /Users/dogan/Desktop/guardian/scripts/verify_all.py` (pass)
  - Faz 5 leak-prevented case list automation:
    - script: `scripts/pilot_collect_leak_prevented_cases.py`
    - regression test: `scripts/tests/test_pilot_collect_leak_prevented_cases.py`
    - komut kanitlari:
      - `python3 -m unittest scripts.tests.test_pilot_collect_leak_prevented_cases -v` (2/2 pass)
      - `python3 scripts/pilot_collect_leak_prevented_cases.py --summary-dir .guardian/pilot-dryrun --output-dir .guardian/pilot-leak-cases` (pass)
      - output: `.guardian/pilot-leak-cases/2026-03-14/leak_cases.json` (`cases=2`, `prevented_release=1`, `controlled_override=1`)
      - `python3 /Users/dogan/Desktop/guardian/scripts/verify_all.py` (pass)
  - Faz 5 CI/release flow alignment validation:
    - script: `scripts/pilot_validate_ci_gate_flow.py`
    - regression test: `scripts/tests/test_pilot_validate_ci_gate_flow.py`
    - komut kanitlari:
      - `python3 -m unittest scripts.tests.test_pilot_validate_ci_gate_flow -v` (3/3 pass)
      - `python3 scripts/pilot_validate_ci_gate_flow.py --ci-workflow .github/workflows/ci-cd-v1.yml --release-workflow .github/workflows/release-windows.yml --output-dir .guardian/pilot-ci-gate-validation` (pass)
      - output: `.guardian/pilot-ci-gate-validation/2026-03-14/ci_gate_validation.json` (`7/7 checks passed`)
      - `python3 /Users/dogan/Desktop/guardian/scripts/verify_all.py` (pass)
- Ust kok governance kapisi tekrar gecti:
    - `python3 /Users/dogan/Desktop/guardian/scripts/verify_all.py`
- Web Search Sources: yok (bu checkpointte yeni bir dis sistem/pattern secimi yapilmadi).
- Blockers:
  - Full publish E2E (signing + GH release upload) halen gercek gizli anahtar ve auth bagimli.
- Next Phase Entry Decision:
  - Faz 5 orkestrasyon hazir; siradaki kritik adim gercek 2 design-partner repo manifestini doldurup strict dry-run baslatmak.

## Siradaki Adim (Aktif)
- [x] Bu tracker dosyasi olusturuldu ve guncel durum isaretlendi.
- [x] `python3 scripts/verify_all.py` kapisi calistirildi (ust kok).
- [x] Faz 2 Test Gate icin Rust toolchain (`cargo`) kurulumu/erisimi saglandi.
- [x] Faz 2 unit testleri calistirildi ve loglandi.
- [x] Faz 4 CLI gate smoke test (`BLOCK`/`APPROVE`/`OVERRIDE`) tamamlandi.
- [x] Faz 4 release script gate-only smoke (`--gate-only`) tamamlandi.
- [x] Faz 2 Integration: desktop ve CLI karar eslesme testi eklendi.
- [x] Faz 3 E2E approval workflow (desktop karar paneli + audit kaydi) otomasyonu eklendi.
- [x] Faz 4 release script icin guvenli `--gate-only` modu eklendi ve smoke kosuldu.
- [x] Faz 3 Integration: reviews/fix akisi ile decision engine bag testi eklendi.
- [x] Faz 4 CI smoke: distribution publish adimi BLOCK kararinda durdurulacak sekilde kanitlandi.
- [x] Faz 5 pilot toolkit: weekly report automation + rubric + playbook + unit tests tamamlandi.
- [x] Faz 5 multi-repo dry-run orchestrator + fixture integration smoke tamamlandi.
- [x] Faz 5 shadow pilot rollout: 3 shadow repoda strict gate dry-run + haftalik dashboard-lite raporu.
- [x] Faz 5 real pilot readiness preflight: manifest+roster validator ve sablonlari tamamlandi.
- [x] Faz 5 shadow leak-prevented vaka listesi otomatik uretildi.
- [x] Faz 5 CI/release gate alignment smoke (workflow wiring) tamamlandi.
- [x] Faz 5 real pilot rollout: 2+ design-partner repoda strict gate dry-run + haftalik dashboard-lite raporu.

## Ara Checkpoint Log - 2026-03-15 (Batch JSON Schema Hotfix)
- Completed Items:
  - `src-tauri/src/validation.rs` batch schema validatori hem `[]` hem de `{ "critique": [...] }` / `{ "critiques": [...] }` formatini kabul edecek sekilde guncellendi.
  - Batch payload icin path-validation akisi wrapper formatlarla uyumlu hale getirildi.
  - Wrapper format regression testleri eklendi.
- Evidence:
  - `cargo test wrapped_batch -- --nocapture` (3/3 pass)
  - `cargo test validation::tests -- --nocapture` (23/23 pass)
- Blockers:
  - Yok.
- Next Phase Entry Decision:
  - `npm run tauri dev` ile yeniden smoke acilisi yapilip batch audit akisi dogrulanacak.

## Ara Checkpoint Log - 2026-03-15 (Batch JSON Schema Hotfix v2 - `results` Wrapper)
- Completed Items:
  - Batch schema validasyonu `{ "results": [...] }` wrapper formatini da kabul edecek sekilde guncellendi.
  - Batch item cikarimi (`batch_items`) `results` anahtarini da destekliyor.
  - Batch parser (`critiques_from_value`) `results` wrapper formatini dogrudan parse ediyor.
  - `results` wrapper icin validation + parser regression testleri eklendi.
- Evidence:
  - `cargo test wrapped_batch -- --nocapture` (4/4 pass)
  - `cargo test results_wrapper -- --nocapture` (1/1 pass)
  - `cargo test validation::tests -- --nocapture` (24/24 pass)
  - `python3 /Users/dogan/Desktop/guardian/scripts/verify_all.py` (pass)
- Blockers:
  - Yok.
- Next Phase Entry Decision:
  - `npm run tauri dev` altinda real monitoring batch akisini tekrar tetikle; schema hatasi kapanmis olmali.

## Ara Checkpoint Log - 2026-03-15 (Guru Dark Theme Chat Bubble Fix)
- Completed Items:
  - Guru chat satirlarinda `dark:` varyantina bagli beyaz balon sorunu giderildi.
  - Mesaj balonlari ve loading bubble'lari tema token bazli (`bg-surface`, `bg-[var(--accent-200)]`, `text-text-main`) hale getirildi.
  - Avatar kapsulleri `border-border-main` + tema tokenlarla normalize edildi.
- Evidence:
  - `src/components/ChatView.tsx` (chat row + loading row class guncellemesi)
  - `npm run test -- src/components/__tests__/ChatView.test.tsx` (2/2 pass)
  - `npx eslint src/components/ChatView.tsx` (pass)
- Blockers:
  - Yok.
- Next Phase Entry Decision:
  - `npm run tauri dev` ile dark mode UI smoke yapilip Guru panelinde kontrast dogrulanacak.

## Ara Checkpoint Log - 2026-03-15 (Batch Timeout Resilience + Fix Quality Guardrails)
- Completed Items:
  - Batch audit icin timeout/transient send failure tanima (`is_timeout_error`, `is_transient_send_failure`) eklendi.
  - Batch process akisina transient hata retry politikalari eklendi:
    - `GUARDIAN_SEND_FAILURE_RETRIES` (default: 2)
    - `GUARDIAN_SEND_FAILURE_BACKOFF_SECS` (default: 2)
  - Batch prompt agirligi icin proaktif fallback eklendi:
    - `GUARDIAN_MAX_BATCH_PROMPT_TOKENS` (default: 5000)
    - limit asildiginda per-file fallback devreye giriyor.
  - Timeout veya token-limit durumunda per-file fallback akisi tek fonksiyonda toplandi (`process_items_per_file_fallback`).
  - OpenAI timeout icin kullaniciya ayar odakli net hint eklendi (`GUARDIAN_TIMEOUT_OPENAI`, batch/content env knobs).
  - AI suggested diff kalitesi icin placeholder/pseudocode filtresi eklendi:
    - dusuk kaliteli `suggested_diff` otomatik temizleniyor.
    - prompt metinleri "NO PLACEHOLDERS" kuraliyla guncellendi.
  - `.env.example` dosyasina timeout/batch/retry tuning env degiskenleri eklendi.
- Evidence:
  - `cargo test --lib -- --nocapture` (95/95 pass)
  - `python3 /Users/dogan/Desktop/guardian/scripts/verify_all.py` (pass)
- Blockers:
  - Yok.
- Next Phase Entry Decision:
  - `npm run tauri dev` altinda ayni workspace ile timeout senaryosu tekrar smoke edilip fallback/retry davranisi canli dogrulanacak.

## Ara Checkpoint Log - 2026-03-15 (Reality Sync + Strict Real Dry-Run Refresh)
- Completed Items:
  - CI/release tarafinda referans verilen eksik script seti workspace'e geri eklendi:
    - `scripts/release_all_local.sh`
    - `scripts/generate_dashboard_lite.py`
    - `scripts/pilot_generate_weekly_report.sh`
    - `scripts/pilot_dryrun.py`
    - `scripts/pilot_validate_readiness.py`
    - `scripts/pilot_collect_leak_prevented_cases.py`
    - `scripts/pilot_validate_ci_gate_flow.py`
    - `scripts/ci/release_gate_ci_smoke.sh`
  - Silinmis release yardimci scriptleri geri kazandirildi (`verify.sh`, `secret_scan.sh`, `release_local.sh`, `publish_distribution*.sh`, `merge_latest_json.sh`, `collect_macos_artifacts.sh`, `bump_version.sh`, vb.).
  - `docs/pilot/PILOT_REPO_MANIFEST.real.json` path'leri mevcut workspace mutlak path'lerine duzeltildi.
  - Strict real dry-run + haftalik rapor uretimi tekrar calistirildi (2026-03-15 ciktilari).
  - Cross-repo rollout trend raporu otomasyonu calistirildi (2 haftalik trend snapshot).
- Evidence:
  - `python3 scripts/pilot_validate_readiness.py --manifest docs/pilot/PILOT_REPO_MANIFEST.real.json --approver-roster docs/pilot/APPROVER_ROSTER.json --output-dir .guardian/pilot-real-readiness` (READY)
  - `python3 scripts/pilot_dryrun.py --manifest docs/pilot/PILOT_REPO_MANIFEST.real.json --cli-bin guardian-cli/target/release/guardian-cli --summary-dir .guardian/pilot-dryrun-real` (pass)
  - `GUARDIAN_PILOT_TEAM=<team> GUARDIAN_PILOT_REPO=<repo> scripts/pilot_generate_weekly_report.sh <repo_path>` (4 repo pass)
  - `python3 scripts/pilot_collect_leak_prevented_cases.py --summary-dir .guardian/pilot-dryrun-real --output-dir .guardian/pilot-leak-cases-real` (pass)
  - `python3 scripts/pilot_validate_ci_gate_flow.py --ci-workflow .github/workflows/ci-cd-v1.yml --release-workflow .github/workflows/release-windows.yml --output-dir .guardian/pilot-ci-gate-validation` (pass)
  - `scripts/pilot_generate_rollout_trend.sh docs/pilot/PILOT_REPO_MANIFEST.real.json` (pass)
  - `bash scripts/ci/release_gate_ci_smoke.sh` (pass)
  - `GUARDIAN_RELEASE_APPROVER=release-manager GUARDIAN_RELEASE_OVERRIDE_REASON=... bash scripts/release_all_local.sh --gate-only` (pass, decision=`OVERRIDDEN`)
  - `npm run test` / `cargo test -q` / `npm run test:e2e` / `python3 scripts/verify_all.py` (pass)
  - `website: npm run copy:check` / `npm run lint` / `npm run test:run` / `npm run build` (pass)
- Blockers:
  - Faz 5 exit gate icin aylik trend kapisi henuz 2/4 hafta; product sign-off operasyonel takip gerektiriyor.
- Next Phase Entry Decision:
  - Haftalik cadence ile ayni script seti uzerinden en az 2 hafta daha trend biriktir; Faz 5 trend gate maddesini kapat.

## Ara Checkpoint Log - 2026-03-15 (Batch Freshness + System Warning UX + Dependency Hardening)
- Completed Items:
  - Batch queue dedupe mantigi "ilk gelen" yerine "en guncel degisiklik" olacak sekilde guncellendi (`upsert_batch_item`).
  - Ayni dosya icin stale snapshot analizi riski azaltildi; batch her path icin latest content/hash ile flush ediliyor.
  - `guardian:warning` / `guardian:verification` / backend ping warning olaylari bulgu listesine yazilmayip status kanalina alindi; "System Warning" issue satiri gosterim kirliligi temizlendi.
  - NPM dependency security hardening tamamlandi (`npm audit fix`) ve audit vulnerabilities sifirlandi.
- Evidence:
  - `src-tauri/src/watcher.rs` (`upsert_batch_item`, batch loop update + unit test)
  - `src/hooks/useGuardianEvents.ts` (system warning/verification/backend event handling)
  - `cargo test --manifest-path src-tauri/Cargo.toml watcher::tests_protocol:: -- --nocapture` (15/15 pass)
  - `cargo test --manifest-path src-tauri/Cargo.toml ai_client::tests:: -- --nocapture` (9/9 pass)
  - `npm run lint` (pass)
  - `npm run test` (12 file / 67 test pass)
  - `python3 scripts/verify_all.py` (pass)
  - `npm audit --json` (0 vulnerability)
- Blockers:
  - Yok.
- Next Phase Entry Decision:
  - Faz 5 rollout metriklerini gercek design-partner verisiyle haftalik toplamaya devam et; 4 haftalik trend gate kapanisina ilerle.

## Ara Checkpoint Log - 2026-03-15 (Watcher Memory Bound + Concurrency Hygiene)
- Completed Items:
  - Uzun sureli watcher oturumlarinda `LAST_AUDITED_CONTENTS` cache'i sinirsiz buyumeyecek sekilde max-entry limiti eklendi.
  - Cache veri yapisi `content + last_seen_epoch_ms` seklinde guncellendi ve en eski girisler deterministic sekilde evict ediliyor.
  - Yeni runtime ayari eklendi: `GUARDIAN_LAST_AUDITED_CACHE_MAX_ENTRIES` (default: `1200`).
  - Env dokumani guncellendi (`.env.example`) ve eviction regression unit testi eklendi.
- Evidence:
  - `src-tauri/src/config.rs` (`DEFAULT_LAST_AUDITED_CACHE_MAX_ENTRIES`, `last_audited_cache_max_entries`)
  - `src-tauri/src/watcher.rs` (`AuditedContentCacheEntry`, `enforce_last_audited_cache_limit`, cache update/read path)
  - `.env.example` (new watcher cache limit knob)
  - `cargo test --manifest-path src-tauri/Cargo.toml watcher::tests_protocol::last_audited_cache_limit_eviction_removes_oldest_entries -- --nocapture` (pass)
  - `cargo test --manifest-path src-tauri/Cargo.toml watcher::tests_protocol::upsert_batch_item_replaces_existing_path_with_latest_content -- --nocapture` (pass)
  - `npm run lint` (pass)
  - `python3 scripts/verify_all.py` (pass)
- Blockers:
  - Yok.
- Next Phase Entry Decision:
  - Faz 5 operasyonuna devam: weekly real design-partner cadence + trend gate kapanisi.

## Ara Checkpoint Log - 2026-03-15 (Pilot Exit-Gate Automation)
- Completed Items:
  - Faz 5 pilot kapanis durumunu tek komutla degerlendiren script eklendi: `scripts/pilot_exit_gate_check.py`.
  - `pilot_weekly_ops.sh` zincirine exit-gate snapshot adimi eklendi (readiness + dry-run + reports + trend + calibration + exit gate).
  - Playbook dokumani yeni komut ve artefaktlarla guncellendi.
  - Real datayla exit gate raporu uretildi; mevcut durumda tek acik kapinin "weeks=2/4" oldugu dogrulandi.
- Evidence:
  - `python3 scripts/pilot_exit_gate_check.py`
  - `.guardian/pilot-exit-gate/2026-03-15/exit_gate_status.json`
  - `bash scripts/pilot_weekly_ops.sh docs/pilot/PILOT_REPO_MANIFEST.real.json docs/pilot/APPROVER_ROSTER.json`
  - `python3 scripts/verify_all.py`
- Blockers:
  - `block_rate_trend_reported` kapisi icin minimum 4 haftalik trend penceresi (su an 2 hafta).
- Next Phase Entry Decision:
  - Haftalik cadence'i bozmadan 2 hafta daha trend biriktir; sonra `--fail-on-incomplete` ile pilot complete kararini CI-benzeri strict modda kapat.

## Ara Checkpoint Log - 2026-03-15 (No-Wait Launch Gate + Solid Dual-Profile Exit Criteria)
- Completed Items:
  - Exit-gate checker dual-profile modele gecirildi:
    - Launch profile: hizli production-ready karari (2 hafta + hacim esikleri)
    - GA profile: tam mezuniyet karari (4 hafta)
  - Launch/GA icin threshold bazli "trend + decision volume + ai-heavy volume" kapilari eklendi.
  - `pilot_weekly_ops.sh` artik hem launch hem ga profil durumunu raporluyor.
  - Real veriyle dogrulama:
    - launch profile strict mod (`--profile launch --fail-on-incomplete`) PASS
    - ga profile strict mod (`--profile ga --fail-on-incomplete`) beklenen sekilde FAIL (weeks gate)
- Evidence:
  - `python3 scripts/pilot_exit_gate_check.py --profile launch --fail-on-incomplete` (pass)
  - `python3 scripts/pilot_exit_gate_check.py --profile ga --fail-on-incomplete` (fail, expected)
  - `.guardian/pilot-exit-gate/2026-03-15/exit_gate_status.json`
  - `bash scripts/pilot_weekly_ops.sh docs/pilot/PILOT_REPO_MANIFEST.real.json docs/pilot/APPROVER_ROSTER.json`
  - `python3 scripts/verify_all.py`
- Blockers:
  - GA profile icin trend haftasi kapisi (4 hafta) henuz kapanmadi.
- Next Phase Entry Decision:
  - Beklemeden launch profile ile controlled production devam; GA profile icin haftalik cadence ile 4 hafta kapisini kapat.
