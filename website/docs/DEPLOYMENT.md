# Guardian Website - Deployment Guide

## Pre-Deployment Checklist

### ✅ Environment Variables
Before deploying to production, ensure these environment variables are set:

#### Required
```bash
GITHUB_RELEASE_OWNER=senoldogann
GITHUB_RELEASE_REPO=guardian-distribution
```

#### Optional (but recommended)
```bash
GITHUB_PUBLIC_READ_TOKEN=ghp_xxx  # For higher API rate limits
```

**Where to set:**
- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site Settings → Build & Deploy → Environment
- **Self-hosted**: Create `.env.production` file

---

## Build Verification

Run these checks before deploying:

```bash
# 1. Install dependencies
npm install

# 2. Lint check
npm run lint

# 3. Type check
npx tsc --noEmit

# 4. Unit tests
npm run test:run

# 5. Build
npm run build

# 6. Test production build locally
npm run start
```

All should pass without errors.

---

## Guardian Deployment Automation (Internal)

The `/api/deploy` and `/api/health` endpoints are reference implementations designed for integration with your deployment platform.

Current limitations:
- Deployment state is stored in memory (resets on serverless or container restart).
- Traffic switching is simulated (requires platform-specific routing/hooks).
- Disk space check in `health-check.ts` is a placeholder.

Recommended production setup:
- Persist deployment state in Redis or a database.
- Wire `/api/deploy` to your CI/CD provider (Vercel, Netlify, GitHub Actions).
- Replace disk checks with a real system metric collector.

---

## Deployment Platforms

### Vercel (Recommended)

**Why Vercel:**
- Native Next.js support
- Automatic deployments
- Built-in analytics
- Edge network (CDN)

**Setup:**
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

**Configuration:**
- Framework Preset: Next.js
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

**Environment Variables:**
```
GITHUB_RELEASE_OWNER=senoldogann
GITHUB_RELEASE_REPO=guardian-distribution
GITHUB_PUBLIC_READ_TOKEN=<your-token>
```

---

### Netlify

**Setup:**
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

**Configuration (netlify.toml):**
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

---

### Self-Hosted (Docker)

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**Build & Run:**
```bash
docker build -t guardian-website .
docker run -p 3000:3000 \
  -e GITHUB_RELEASE_OWNER=senoldogann \
  -e GITHUB_RELEASE_REPO=guardian-distribution \
  guardian-website
```

---

## Post-Deployment Checks

After deployment, verify:

### Functional Tests
- [ ] Homepage loads without errors
- [ ] Navigation works (docs, download, changelog)
- [ ] Download page fetches latest release
- [ ] Theme toggle works
- [ ] Videos play correctly
- [ ] Mobile responsive

### Performance Tests
```bash
# Run Lighthouse
npm run lighthouse

# Target scores:
# - Performance: 95+
# - Accessibility: 100
# - Best Practices: 100
# - SEO: 100
```

### SEO Checks
- [ ] Open Graph images generate: `https://your-domain.com/og?title=Test`
- [ ] Sitemap accessible: `https://your-domain.com/sitemap.xml`
- [ ] Robots.txt accessible: `https://your-domain.com/robots.txt`
- [ ] Meta tags present (view source)

### Security Checks
- [ ] HTTPS enforced
- [ ] CSP headers active (check Network tab)
- [ ] No console errors
- [ ] No exposed secrets in source

---

## Domain Configuration

### Custom Domain (Vercel)
1. Go to Project Settings → Domains
2. Add your domain: `guardian-app.com`
3. Configure DNS:
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

### SSL/TLS
- Vercel: Automatic (Let's Encrypt)
- Netlify: Automatic (Let's Encrypt)
- Self-hosted: Use Certbot or CloudFlare

---

## Monitoring

### Vercel Analytics
Automatic if deployed on Vercel. View at:
- Dashboard → Your Project → Analytics

### Custom Monitoring
Set up error tracking (Week 4):
- Sentry
- LogRocket
- DataDog

---

## Rollback Procedure

### Vercel
```bash
# List deployments
vercel ls

# Promote previous deployment
vercel promote <deployment-url>
```

### Git-based
```bash
# Revert to previous commit
git revert HEAD
git push origin main
```

---

## CI/CD Pipeline

### GitHub Actions (Example)

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.x'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Test
        run: npm run test:run
      
      - name: Build
        run: npm run build
        env:
          GITHUB_RELEASE_OWNER: ${{ secrets.GITHUB_RELEASE_OWNER }}
          GITHUB_RELEASE_REPO: ${{ secrets.GITHUB_RELEASE_REPO }}
      
      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

---

## Troubleshooting

### Build Fails
```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### API Rate Limit
```
Error: GitHub API rate limit exceeded
```
**Solution:** Add `GITHUB_PUBLIC_READ_TOKEN` env var

### Videos Not Loading
- Check file paths (case-sensitive on Linux)
- Verify CDN is serving files
- Check browser console for MIME type errors

### Slow Performance
- Run `npm run optimize:media`
- Enable Vercel Speed Insights
- Check bundle analyzer: `npx @next/bundle-analyzer`

---

## Maintenance

### Weekly
- Monitor analytics for errors
- Check Vercel build logs
- Review security advisories: `npm audit`

### Monthly
- Update dependencies: `npm update`
- Run Lighthouse audit
- Review and optimize media

### Quarterly
- Major dependency updates
- Performance review
- SEO audit

---

## Support

**Issues:** https://github.com/senoldogann/guardian-distribution/issues
**Docs:** https://nextjs.org/docs
**Vercel Support:** https://vercel.com/support

---

**Last updated:** February 2026
