# Guardian Website

This folder contains a static landing page for distribution.

## Features

- Detects user OS/architecture in browser.
- Fetches latest release from GitHub Releases API.
- Maps primary download button to the correct installer automatically.
- Keeps links always up to date without manual edits.

## Local Preview

```bash
cd website
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Hosting

You can host this folder directly on:

- GitHub Pages
- Netlify
- Vercel (static)
- Any Nginx/Apache static host
