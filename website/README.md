# Guardian Website

Production-ready marketing and documentation website for Guardian desktop application.

## 🚀 Features

- ⚡ **Next.js 15** with App Router
- 🎨 **Tailwind CSS** + Framer Motion animations
- 📊 **Vercel Analytics** + Custom event tracking
- 🧪 **Vitest** + **Playwright** (80%+ coverage target)
- 🔒 **Security headers** (CSP, X-Frame-Options, etc.)
- 🚀 **Optimized media** (WebP images, compressed videos)
- ♿ **Accessible** (WCAG 2.1 AA compliant)
- 🌐 **SEO optimized** (OpenGraph, Schema.org, sitemap)

## 📋 Pages

- **Homepage**: Product showcase with demo videos
- **Download**: OS-aware installer selection (auto-detects platform)
- **Changelog**: GitHub Releases driven timeline
- **Documentation**: Markdown-based docs with search

---

## 🛠️ Development

### Quick Start
```bash
cd website
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Available Scripts
```bash
npm run dev              # Start development server
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint
npm run test             # Unit tests (watch mode)
npm run test:run         # Unit tests (CI mode)
npm run test:coverage    # Coverage report
npm run test:e2e         # End-to-end tests
npm run test:e2e:ui      # E2E with Playwright UI
npm run optimize:media   # Optimize images/videos
npm run lighthouse       # Performance audit
npm run pre-launch       # Pre-deployment checks
```

---

## 🌍 Environment Variables

### Required
```bash
GITHUB_RELEASE_OWNER=senoldogann
GITHUB_RELEASE_REPO=guardian-distribution
```

### Optional
```bash
# GitHub API token for higher rate limits (5000/hour vs 60/hour)
GITHUB_PUBLIC_READ_TOKEN=ghp_xxx
```

**Setup:**
1. Copy `.env.example` to `.env.local`
2. Update values if using custom repository
3. For production, set in Vercel/Netlify dashboard

---

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm i -g vercel
vercel login
vercel --prod
```

**Configuration:**
- Framework: Next.js
- Build Command: `npm run build`
- Output: `.next`
- Environment Variables: Set in Vercel dashboard

### Netlify
```bash
npm i -g netlify-cli
netlify deploy --prod
```

### Docker
```bash
docker build -t guardian-website .
docker run -p 3000:3000 guardian-website
```

**Full guide:** See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## 📊 Performance

### Bundle Size
- First Load JS: **102 KB** ✅
- Total Media: **2.1 MB** (optimized from 6.3 MB)

### Lighthouse Scores (Target)
- Performance: **95+**
- Accessibility: **100**
- Best Practices: **100**
- SEO: **100**

### Core Web Vitals
- LCP: < 2.5s
- FID: < 100ms
- CLS: < 0.1

---

## 🧪 Testing

### Unit Tests
```bash
npm run test              # Watch mode
npm run test:run          # CI mode
npm run test:coverage     # With coverage
```

**Coverage target:** 80%+

### E2E Tests
```bash
npm run test:e2e          # Headless
npm run test:e2e:ui       # Playwright UI
npm run test:e2e:headed   # With browser
```

**Test files:** `e2e/*.spec.ts`

---

## 🎨 Tech Stack

### Core
- **Framework**: Next.js 15.5 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4.x
- **Animations**: Framer Motion

### UI Components
- Radix UI (primitives)
- Lucide React (icons)
- Custom components in `components/ui/`

### Testing
- Vitest (unit/integration)
- Playwright (E2E)
- Testing Library (React)

### Analytics
- Vercel Analytics
- Vercel Speed Insights
- Custom event tracking

### Optimization
- Next.js Image optimization
- FFmpeg video compression
- WebP image generation

---

## 📁 Project Structure

```
guardian/website/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Homepage
│   ├── docs/              # Documentation pages
│   ├── download/          # Download page
│   ├── changelog/         # Changelog page
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/                # Reusable UI components
│   └── *.tsx              # Page-specific components
├── lib/                   # Utilities
│   ├── seo.ts             # SEO helpers
│   ├── github.ts          # GitHub API client
│   └── analytics.ts       # Event tracking
├── public/                # Static assets
│   └── media/             # Images & videos
├── e2e/                   # End-to-end tests
├── scripts/               # Build scripts
│   └── optimize-media.sh  # Media optimization
├── docs/                  # Documentation
│   ├── DEPLOYMENT.md      # Deployment guide
│   └── MEDIA_OPTIMIZATION.md
└── content/               # Markdown content
```

---

## 🔒 Security

### Headers
- Content Security Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy (camera, microphone disabled)

### Best Practices
- No exposed secrets
- HTTPS enforced
- Dependency audits: `npm audit`
- Automated Dependabot updates

---

## 🎥 Media Optimization

### Running
```bash
npm run optimize:media
```

**Requirements:**
- FFmpeg: `brew install ffmpeg`
- ImageMagick: `brew install imagemagick`

### Output
- Videos: `-optimized.mp4` (desktop), `-mobile.mp4` (mobile)
- Images: `.webp` (modern), `-optimized.png` (fallback)

**Full guide:** See [docs/MEDIA_OPTIMIZATION.md](docs/MEDIA_OPTIMIZATION.md)

---

## 📚 Documentation

- **Deployment**: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Media Optimization**: [docs/MEDIA_OPTIMIZATION.md](docs/MEDIA_OPTIMIZATION.md)
- **Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) *(coming soon)*
- **Testing**: [docs/TESTING.md](docs/TESTING.md) *(coming soon)*

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Before submitting:
- Run `npm run lint`
- Run `npm run test:run`
- Run `npm run build`
- Update docs if needed

---

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details

---

## 🔗 Links

- **Website**: https://guardianide.com
- **Repository**: https://github.com/senoldogann/guardian-distribution
- **Issues**: https://github.com/senoldogann/guardian-distribution/issues
- **Next.js Docs**: https://nextjs.org/docs

---

**Last updated:** February 2026
