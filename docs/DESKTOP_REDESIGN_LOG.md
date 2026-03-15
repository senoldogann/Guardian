# Desktop Redesign Log

Date: 2026-03-15
Owner: Codex + Dogan

## Scope
- Desktop UI redesign across core views (Monitor, Guru, Reviews, AI Context, Project Map)
- EN/TR text consistency and missing translation completion

## Completed
- [x] New visual token system in `src/App.css` (dark/light palette, panel hierarchy, focus rings, chat bubble tokens)
- [x] New shell surface treatment (`guardian-shell`, elevated/subtle card primitives)
- [x] Header redesign in `src/components/Header.tsx`
- [x] Sidebar visual refresh in `src/components/layout/ControlSidebar.tsx`
- [x] Workspace container redesign in `src/components/layout/MainWorkspace.tsx`
- [x] Guru/Chat redesign + dark mode bubble readability fix in `src/components/ChatView.tsx`
- [x] Reviews panel modernization in `src/components/ReleaseDecisionPanel.tsx`
- [x] AI Context / Fix Proposals visual consistency pass
- [x] New i18n keys added for app state + release decision + chat fix actions (`src/i18n/index.tsx`)
- [x] Turkish copy cleanup for major navigation and workflow labels
- [x] Header KPI strip refined: removed card borders/backgrounds, moved KPI cluster next to session controls
- [x] Reviews page duplicate refresh action removed (single refresh flow remains in release decision panel)
- [x] Release decision save CTA aligned with primary launch color system
- [x] Sidebar compact behavior improved to prevent main left-column scroll by default (details collapsed + internal capped detail area)
- [x] Light mode Updates tab `Check Now` button visibility improved with stronger filled background
- [x] Guru input placeholder contrast improved in light mode (`.guru-input::placeholder`)
- [x] Control Center top alignment fixed by adding matching top spacing wrapper (no header-border overflow look)
- [x] Guru reply notification sound added (subtle chime) when response arrives outside Guru screen
- [x] New General setting added to enable/disable Guru reply sound (EN/TR localized)

## Verification Gates
- [x] `npm run test` passed (67/67)
- [x] `npm run lint` passed
- [x] `npm run build` passed

## Notes
- Build shows existing Vite CSS warning for unsupported `file` property token from generated utility output; build still succeeds.
- Follow-up improvement can include a dedicated copy QA sweep for every remaining niche technical string in EN/TR.

## Incremental Completion Log (2026-03-15)
- Goal:
  Polish visual consistency and response awareness flow without regressing core behavior.
- Tasks:
  - [x] Updates action button contrast in light mode
  - [x] Guru input placeholder readability in light mode
  - [x] Control sidebar top border spacing/alignment fix
  - [x] Guru background chime + settings toggle
  - [x] EN/TR key coverage for new setting
- Test Gate:
  - [x] `npm run lint`
  - [x] `npm run test`
  - [x] `npm run build`
  - [x] `python3 scripts/verify_all.py`
- Entry Gate:
  - [x] Existing redesign baseline active
  - [x] Requested UX refinements confirmed
- Exit Gate:
  - [x] Requested UI behaviors implemented
  - [x] Settings control added for new sound behavior
  - [x] Quality gates passed

## Incremental Completion Log (2026-03-15, Round 2)
- Goal:
  Remove harsh color contrast, complete TR label localization, and enforce exact left/right top alignment.
- Tasks:
  - [x] Release override card colors normalized for both dark/light themes
  - [x] Severity badge labels localized via i18n (`KRİTİK/UYARI/BİLGİ`)
  - [x] Turkish `Fix` wording converted to `Düzeltme` in user-facing labels
  - [x] Content layout moved to shared outer padding for left/right top-gap parity
  - [x] Release decision panel now shows audit trail file path
- Test Gate:
  - [x] `npm run lint`
  - [x] `npm run test`
  - [x] `npm run build`
  - [x] `python3 scripts/verify_all.py`

## Incremental Completion Log (2026-03-15, Round 3)
- Goal:
  Prevent raw internal AI schema/transport errors from appearing in user-facing monitor rows.
- Tasks:
  - [x] Added system-warning/error sanitization mapping in watcher event bridge
  - [x] Replaced raw JSON/schema/preview/time-out messages with concise product-safe copy (EN/TR)
  - [x] Preserved safe monitoring behavior while avoiding sensitive/technical dump exposure
- Test Gate:
  - [x] `npm run lint`
  - [x] `npm run test`
  - [x] `npm run build`
  - [x] `python3 scripts/verify_all.py`
