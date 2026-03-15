---
name: gstack
version: 1.0.0
description: |
  Shared workflow pack that vendors the gstack skill suite for all supported
  providers. Includes browse, founder/engineering plan review, pre-landing
  review, shipping, and retrospective workflows.
allowed-tools:
  - Read
  - Bash
---

# gstack Shared Workflow Pack

This directory vendors the upstream `gstack` structure once and re-exposes its
skills through the shared provider bridges in this repository.

## Included Skills

- `browse`
- `plan-ceo-review`
- `plan-eng-review`
- `review`
- `ship`
- `retro`

## Provider Routing

- Shared source lives in `.maestro/skills/`
- `Codex` loads the shared skills through `.agents/skills/`
- `Claude Code` loads the same skills through `.claude/skills/` and exposes thin slash-command wrappers in `.claude/commands/`
- `OpenCode` loads the same skills through `.opencode/skills/` and exposes thin command wrappers in `.opencode/commands/`
- `Antigravity` exposes the same shared source through `.agent/skills/`

## browse Setup

The `browse` skill needs a one-time local build before the binary is available.
Run this from the vendored pack when the binary is missing:

```bash
cd .maestro/skills/gstack && ./setup
```

That setup script builds `browse/dist/browse` and refreshes the direct skill
symlinks in the surrounding `skills/` directory.

## Notes

- Use `snapshot -i` for interaction-heavy flows so element refs stay stable.
- Use `js` when you need targeted extraction instead of full-page parsing.
- Use `responsive` when you need one-pass mobile, tablet, and desktop checks.

## When to Use What

| Task | Commands |
|------|----------|
| Read a page | `goto <url>` then `text` |
| Interact with elements | `snapshot -i` then `click @e3` |
| Check if element exists | `js "!!document.querySelector('.thing')"` |
| Extract specific data | `js "document.querySelector('.price').textContent"` |
| Visual check | `screenshot /tmp/x.png` then Read the image |
| Fill and submit form | `snapshot -i` → `fill @e4 "val"` → `click @e5` → `screenshot` |
| Check CSS | `css "selector" "property"` or `css @e3 "property"` |
| Inspect DOM | `html "selector"` or `attrs @e3` |
| Debug console errors | `console` |
| Check network requests | `network` |
| Check local dev | `goto http://127.0.0.1:3000` |
| Compare two pages | `diff <url1> <url2>` |
| Mobile layout check | `responsive /tmp/prefix` |
| Multi-step flow | `echo '[...]' \| browse chain` |

## Architecture

- Persistent Chromium daemon on localhost (port 9400-9410)
- Bearer token auth per session
- State file: `/tmp/browse-server.json`
- Console log: `/tmp/browse-console.log`
- Network log: `/tmp/browse-network.log`
- Auto-shutdown after 30 min idle
- Chromium crash → server exits → auto-restarts on next command
