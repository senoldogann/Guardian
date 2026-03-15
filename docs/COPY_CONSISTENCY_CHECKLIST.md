# Website Copy Consistency Checklist (Phase 1 Closure)

Use this checklist before publishing website copy changes.

## Positioning

- Primary headline stays anchored to: **Control AI-generated code before it ships**
- Audience stays anchored to: **small engineering teams**
- Core value props remain visible:
  - enforce team policies
  - explain risky changes
  - approve with confidence
  - work local when needed
- Copy keeps Guardian in desktop + CLI release-decision category.

## Disallowed Generic Language

Do not reintroduce these phrases:

- AI coding assistant
- code review tool
- security scanner
- quality checker
- developer productivity tool
- enterprise-grade
- release-driven governance

## Scope

Run consistency checks on:

- homepage localization strings
- SEO metadata (`website/app/layout.tsx`, `website/lib/seo.ts`)
- homepage metadata (`website/app/[locale]/page.tsx`)
- FAQ positioning copy (`website/components/faq/faq-page-view.tsx`)
- get-started docs
- guru docs
- monitoring docs
- configuration docs

## CI Gate

Run:

```bash
cd website
npm run copy:check
```

This check is wired into CI via `website/scripts/check-copy-consistency.mjs`.
