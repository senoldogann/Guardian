# Release Approval Policy

Bu dokuman Guardian'in human approval + override akisini ve takim bazli approver rol modelini netlestirir.

## Goal
- Fix onerisi ile release izni arasina insan onayi koymak.
- `BLOCK_UNTIL_APPROVED` ve `OVERRIDDEN` kararlarini denetlenebilir, tekrar okunabilir ve geriye donuk uyumlu tutmak.
- Approver yetkisini takim sorumluluguna ve incident baglamina gore sinirlamak.

## Source of Truth
- Runtime karar semantigi: [`/Users/dogan/Desktop/guardian/docs/GOVERNANCE_OUTPUT_CONTRACT.md`](/Users/dogan/Desktop/guardian/docs/GOVERNANCE_OUTPUT_CONTRACT.md)
- Pilot approver roster formati: [`/Users/dogan/Desktop/guardian/docs/pilot/APPROVER_ROSTER.template.json`](/Users/dogan/Desktop/guardian/docs/pilot/APPROVER_ROSTER.template.json)
- Policy gate konfigu: [`/Users/dogan/Desktop/guardian/guardian.policy.yaml`](/Users/dogan/Desktop/guardian/guardian.policy.yaml)
- Desktop/CLI implementasyonu: [`/Users/dogan/Desktop/guardian/src-tauri/src/release_decision.rs`](/Users/dogan/Desktop/guardian/src-tauri/src/release_decision.rs)

## Approver Roles
| Role | Scope | Allowed Actions |
|------|-------|-----------------|
| Release Manager | Takim veya repo bazli release sorumlulugu (`teams`) | `PASS`, `PASS_WITH_WARNING`, gerekli ise `OVERRIDDEN` |
| Incident Commander | Aktif production incident / hotfix baglami, genelde tum takimlar (`teams: ["*"]`) | Sadece incident/hotfix gerekcesiyle `OVERRIDDEN` ve zorunlu reason |
| Reviewer / Developer | Bulgulari duzeltir, fix onerisi uretir | Release state degistiremez, onay yerine gecmez |

## Team Policy Rules
- Approver identity bos olamaz; desktop command'lari bos `approver` ile fail eder.
- `set_release_decision` yalnizca `PASS` veya `PASS_WITH_WARNING` yazar; `OVERRIDDEN` icin `override_release_block` kullanilir.
- Override reason bos olamaz ve incident, rollback, scope, residual risk, post-release verification bilgisi tasimalidir.
- Fix suggestion, chat_message veya suggested_diff hicbir zaman otomatik approval sayilmaz.
- Son audit kaydi current state'i belirler; onceki kayitlar append-only tarihce olarak korunur.
- Takim rosters'inda `teams` alanı repo/takim scope'unu, `can_override` alanı override yetkisini temsil eder. `teams: ["*"]` sadece incident command gibi genis kapsama ihtiyaci olan roller icin kullanilmalidir.

## Override Reason Quality Bar
Strong override reason asgari olarak sunlari icermeli:
- Neden blok bilerek override ediliyor
- Hangi mitigation veya rollback plani var
- Release sonrasi hangi verification adimi kosulacak
- Riskin hangi scope ile sinirli oldugu

Weak/missing reason ornekleri kabul edilmemeli:
- `urgent`
- `ship now`
- `approved`
- bos string / whitespace

## Audit Trail Compatibility
- Yeni audit satirlari `action`, `critical_findings`, `warning_findings`, `ai_heavy_change`, `policy_path` alanlariyla yazilir.
- Eski JSONL satirlarinda bu yeni alanlar yoksa parser default degerlerle okumaya devam eder ve manuel approval state'i kaybetmez.
- Bilerek malformed JSON satirlari halen atlanir; bu append-only log icin corruption izolasyonu saglar, ancak son gecerli kaydin yazildigi operasyonel olarak izlenmelidir.

## Operational Failure Scenarios
- Stale audit row: Yanlis approval gozukuyorsa `.guardian/release_decisions.jsonl` son satiri ve aktif `.guardian/critiques.json` birlikte kontrol edilir.
- Missing roster alignment: Pilot onboarding'de approver id'leri roster ile uyumlu degilse blok giderilmeden override verilmemelidir.
- Incident override abuse: `teams: ["*"]` sadece incident commander gibi sinirli role verilmeli; normal release manager yetkisi mumkunse repo/takim bazinda dar tutulmalidir.
- Legacy log ingestion: Eski formatli audit satirlari okunur, ancak yeni yazilan satirlar daima yeni alanlari tasimalidir.
