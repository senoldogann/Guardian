# Local Release Runbook

Bu dokuman, Guardian release surecini sadece local makineden yurutmek icin adim adim referanstir.

Kapsam:
- Build
- Signing / Notarization
- Artifact toplama
- `senoldogann/guardian-distribution` reposunda release olusturma ve upload

## 1) Once Kontrol (Version + Test)

Release scripti artik version dosyalarini otomatik senkronlar:
- `package.json`
- `website/package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

Manuel bump gerekirse:

```bash
cd Guardian
scripts/bump_version.sh patch   # veya minor/major/X.Y.Z
```

Ardindan temel dogrulama:

```bash
cd Guardian
npm run verify
```

## 2) Gerekli Ortam Degiskenleri

Asagidaki degerleri local shell'de set et. Gercek sifre/key degerlerini dosyaya yazma.

```bash
# Apple signing/notarization
export APPLE_SIGNING_IDENTITY="Developer ID Application: SENOL DOGAN (79DZ4AA4DW)"
export APPLE_TEAM_ID="79DZ4AA4DW"
export APPLE_API_KEY="D257Q5HBKT"
export APPLE_API_ISSUER="10585e36-d130-478a-b63a-5b871d472338"
export APPLE_API_KEY_P8="$(cat /path/AuthKey_D257Q5HBKT.p8 | base64)"

# P12 certificate (CI-benzeri local kullanim)
export APPLE_CERTIFICATE="$(cat /path/Certificates.p12 | base64)"
export APPLE_CERTIFICATE_PASSWORD="BURAYA_YAZ"

# Tauri updater imza anahtari
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/guardian.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="BURAYA_YAZ"
```

Not:
- `APPLE_CERTIFICATE_PASSWORD` ve `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` terminalde set edilir.
- Sifreleri repo dosyalarina veya commit'e koyma.

## 3) macOS Build (ARM + Intel)

```bash
cd Guardian

# Apple Silicon
npm run tauri build -- --target aarch64-apple-darwin

# Intel
npm run tauri build -- --target x86_64-apple-darwin
```

Windows artifacts farkli makinede build ediliyorsa daha sonra artifacts klasorune eklenir.

## 4) Artifact Toplama

Iki macOS target ciktilarini tek artifacts klasorunde topla:

```bash
cd /Users/dogan/Desktop/new-idee/guardian
scripts/collect_macos_artifacts.sh vX.Y.Z ./artifacts \
  ./src-tauri/target/aarch64-apple-darwin/release/bundle \
  ./src-tauri/target/x86_64-apple-darwin/release/bundle
```

Eger Win/Linux `latest.json` dosyalari farkli makineden geldiyse merge et:

```bash
scripts/merge_latest_json.sh vX.Y.Z ./artifacts/latest.json \
  /path/to/mac/latest.json \
  /path/to/win/latest.json \
  /path/to/linux/latest.json
```

## 5) Distribution Repo Release Publish

`gh` ile login oldugundan emin ol:

```bash
gh auth status
```

Release olustur + asset upload:

```bash
cd Guardian
scripts/release_local.sh vX.Y.Z ./artifacts senoldogann/guardian-distribution
```

Bu script:
- `latest.json` varligini ve versiyonunu dogrular
- URL'leri distribution repo'ya rewrite eder
- `guardian-distribution` release'ini olusturur/gunceller
- tum asset'lari upload eder
- `releases.json` snapshot olusturup upload eder

## 6) Post-Release Kontrol

Kontrol et:
- GitHub release olustu mu:  
  `https://github.com/senoldogann/guardian-distribution/releases/tag/vX.Y.Z`
- Updater metadata:
  - `https://github.com/senoldogann/guardian-distribution/releases/latest/download/latest.json`
  - `https://github.com/senoldogann/guardian-distribution/releases/latest/download/releases.json`

## 7) Sik Hata ve Cozum

1. `latest.json version does not match release tag`
- Tag ile `latest.json.version` ayni olmali:
  - Tag: `v1.2.0` ise `latest.json.version` `1.2.0` veya `v1.2.0` olabilir (ikisi de kabul).

2. `latest.json has no updater platform entries`
- Build ciktisinda updater platform alanlari dolu olmali.

3. `gh is not authenticated`
- `gh auth login` yap.

4. `no .dmg files found`
- En az bir macOS installer (DMG) artifacts klasorunde olmali.

## 8) Tek Komut Durumu (Mevcut Gercek)

Su an tek komuta en yakin yol:

```bash
cd Guardian
scripts/release_all_local.sh
```

Bu script:
- default olarak patch bump yapar ve tum version dosyalarini sync eder
- `npm run verify` gate'ini calistirir
- macOS build alir (default: host arch; istenirse `--mac-both`)
- artifact toplar (`./artifacts/vX.Y.Z`)
- `guardian-distribution` repo'sunda release olusturur/gunceller
- release notes/title bilgisini `CHANGELOG.md`'den cekip distribution release'ine yazar

Alternatif:

```bash
scripts/release_all_local.sh --bump minor
scripts/release_all_local.sh vX.Y.Z
```

Not: Script sifreleri dosyaya yazmaz; terminalden prompt eder.
