# Guardian Website (Next.js)

Public-facing website for:
- Download page (OS-aware installer selection)
- Changelog page (GitHub Releases driven)
- Documentation page

## Development

```bash
cd website
npm install
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## Environment

Copy `.env.example` to `.env.local` if you need custom owner/repo values.

Default release source is:
- `senoldogann/guardian-distribution`

## Deployment (Vercel)

1. Import `website/` as a separate Vercel project.
2. Add environment variables if needed:
   - `GITHUB_RELEASE_OWNER`
   - `GITHUB_RELEASE_REPO`
   - `GITHUB_PUBLIC_READ_TOKEN` (optional)
3. Deploy.

The site updates automatically as soon as a new GitHub Release is published to the distribution repository.
