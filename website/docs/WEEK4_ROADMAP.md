# Week 4: Performance & Production Readiness

**Status:** Ready to Execute  
**Prerequisites:** Week 3 hydration fixes completed  
**Estimated Time:** 3-4 hours

---

## 🎯 Objectives

1. ✅ Verify all hydration fixes work in production
2. 🧪 Run comprehensive E2E tests across browsers
3. 📊 Measure and optimize performance (Lighthouse)
4. 📈 Improve test coverage to 50-70%
5. 🚀 Prepare production deployment
6. ✅ Complete pre-launch checklist

---

## 📋 Task Checklist

### Phase 1: Verification (30 minutes)

#### ✅ Task 1.1: Manual Hydration Verification
**Status:** IN PROGRESS (waiting for user confirmation)

**Steps:**
1. Dev server is running: `http://localhost:3000`
2. Open browser DevTools Console
3. **Look for:** Zero hydration warnings
4. **Test:**
   - [ ] Reload page (Cmd+R)
   - [ ] Theme toggle (Light → Dark → System)
   - [ ] Navigate to `/features`, `/pricing`, `/contact`
   - [ ] Skip-to-content link (press Tab)
   - [ ] Footer year displays correctly

**Expected Result:** Clean console, no errors

---

#### 🧪 Task 1.2: Run E2E Tests

**Command:**
```bash
npm run test:e2e
```

**What it tests:**
- Homepage functionality (4 tests)
- Download page with GitHub API (6 tests)
- Documentation navigation (9 tests)
- Error handling (404, 500) (7 tests)

**Browsers tested:**
- Desktop: Chrome, Firefox, Safari (WebKit)
- Mobile: Chrome (Pixel 5), Safari (iPhone 13)
- Tablet: iPad Pro

**Expected:** All tests pass across all browsers

**If tests fail:**
```bash
# Run with UI for debugging
npm run test:e2e:ui

# Run with visible browser
npm run test:e2e:headed

# View report
npm run test:e2e:report
```

---

### Phase 2: Performance Optimization (1 hour)

#### 📊 Task 2.1: Run Lighthouse Audit

**Command:**
```bash
npm run lighthouse
```

**What it does:**
- Audits 5 key pages (homepage, features, download, docs, privacy)
- Measures: Performance, Accessibility, Best Practices, SEO
- Generates HTML + JSON reports

**Target Scores:**
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 95+

**Reports saved to:** `lighthouse-reports/`

**View reports:**
```bash
open lighthouse-reports/homepage.report.html
open lighthouse-reports/features.report.html
open lighthouse-reports/download.report.html
open lighthouse-reports/docs.report.html
open lighthouse-reports/privacy-policy.report.html
```

---

#### 🔧 Task 2.2: Optimize Based on Lighthouse Results

**Common Issues & Fixes:**

1. **Low Performance Score (<90)**
   - Check: "Largest Contentful Paint (LCP)"
   - Fix: Optimize images with `npm run optimize:media`
   - Fix: Add `priority` prop to hero images
   ```tsx
   <Image src="/hero.jpg" priority alt="..." />
   ```

2. **Accessibility Issues**
   - Check: Missing alt text, low contrast
   - Fix: Add descriptive alt text to all images
   - Fix: Ensure color contrast ratio > 4.5:1

3. **SEO Issues**
   - Check: Missing meta descriptions
   - Fix: Add to page metadata
   ```tsx
   export const metadata = {
     description: "Your page description"
   }
   ```

4. **Best Practices**
   - Check: Console errors, insecure requests
   - Fix: Ensure all resources use HTTPS
   - Fix: Remove console.log statements

---

### Phase 3: Test Coverage (45 minutes)

#### 📈 Task 3.1: Generate Coverage Report

**Command:**
```bash
npm run test:coverage
```

**Expected Output:**
```
----------------------------------|---------|----------|---------|---------|
File                              | % Stmts | % Branch | % Funcs | % Lines |
----------------------------------|---------|----------|---------|---------|
All files                         |   45.2  |   38.7   |   42.1  |   45.8  |
  components/                     |   62.3  |   55.4   |   58.9  |   63.1  |
  lib/                            |   78.9  |   71.2   |   82.3  |   79.4  |
  app/                            |   21.4  |   15.8   |   18.2  |   22.1  |
----------------------------------|---------|----------|---------|---------|
```

**Coverage goals:**
- `lib/`: 80%+ (utility functions - high priority)
- `components/`: 60%+ (UI components)
- `app/`: 30%+ (page components - lower priority)

**View detailed report:**
```bash
open coverage/index.html
```

---

#### 🧪 Task 3.2: Add Missing Tests (if needed)

**Priority areas to test:**

1. **Critical Utility Functions** (if <80%)
   - `lib/download.ts` - OS detection, download URL generation
   - `lib/seo.ts` - Metadata generation
   - `lib/github.ts` - API calls, error handling

2. **Key Components** (if <60%)
   - `components/theme-toggle.tsx` - Theme switching
   - `components/ui/direct-download-button.tsx` - Platform detection
   - `components/command-header.tsx` - Command palette

3. **Error Boundaries**
   - Ensure all error scenarios are tested
   - Check fallback UI rendering

**Test template:**
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import YourComponent from './your-component';

describe('YourComponent', () => {
  it('should render correctly', () => {
    render(<YourComponent />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```

---

### Phase 4: Production Build (30 minutes)

#### 🏗️ Task 4.1: Create Production Build

**Command:**
```bash
npm run build
```

**Expected Output:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (23/23)
✓ Collecting build traces
✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                    5.1 kB        102 kB
├ ○ /contact                             2.8 kB         98 kB
├ ○ /docs                                8.4 kB        109 kB
├ ○ /download                            4.2 kB        101 kB
├ ○ /features                            6.3 kB        105 kB
├ ○ /privacy-policy                      3.1 kB         99 kB
└ ○ /pricing                             4.7 kB        103 kB

○  (Static)  prerendered as static HTML
```

**Verify:**
- First Load JS < 120 KB (target: 100-110 KB)
- No build errors or warnings
- All routes marked as ○ (Static)

---

#### 🧪 Task 4.2: Test Production Build Locally

**Commands:**
```bash
# Start production server
npm run start

# In another terminal, test key pages
curl http://localhost:3000 | grep "Guardian"
curl http://localhost:3000/download | grep "Download"
curl http://localhost:3000/docs | grep "Documentation"
```

**Manual test:**
1. Open `http://localhost:3000`
2. Test all functionality:
   - Navigation works
   - Download page fetches release data
   - Theme toggle works
   - Videos play
   - Mobile responsive (use DevTools)

---

### Phase 5: Pre-Launch Validation (30 minutes)

#### ✅ Task 5.1: Run Pre-Launch Checklist

**Command:**
```bash
npm run pre-launch
```

**What it checks:**
- ✅ Dependencies installed correctly
- ✅ TypeScript type errors
- ✅ ESLint errors
- ✅ Unit tests (105 tests)
- ✅ Production build success
- ✅ Environment variables configured
- ✅ Security vulnerabilities (npm audit)
- ✅ Bundle size validation
- ✅ Critical files present
- ✅ Documentation complete

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ PRE-LAUNCH CHECKLIST PASSED

Your website is ready for production deployment!

Next steps:
  1. Deploy to Vercel: vercel --prod
  2. Run E2E tests: npm run test:e2e
  3. Run Lighthouse: npm run lighthouse
  4. Monitor Vercel Analytics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

#### 🔧 Task 5.2: Fix Any Pre-Launch Issues

**If checklist fails:**

1. **TypeScript Errors:**
   ```bash
   npx tsc --noEmit --skipLibCheck
   # Fix errors shown in output
   ```

2. **ESLint Errors:**
   ```bash
   npm run lint
   # Fix errors, or run npm run lint -- --fix for auto-fixes
   ```

3. **Build Failures:**
   ```bash
   rm -rf .next node_modules
   npm install
   npm run build
   ```

4. **Security Vulnerabilities:**
   ```bash
   npm audit
   npm audit fix  # For auto-fixable issues
   ```

---

### Phase 6: Deployment Preparation (30 minutes)

#### 🚀 Task 6.1: Configure Environment Variables

**Required for Vercel:**

```bash
GITHUB_RELEASE_OWNER=senoldogann
GITHUB_RELEASE_REPO=guardian-distribution
```

**Optional (recommended):**
```bash
GITHUB_PUBLIC_READ_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
```

**Where to set:**
- Vercel: Dashboard → Project → Settings → Environment Variables
- Or use Vercel CLI:
```bash
vercel env add GITHUB_RELEASE_OWNER
vercel env add GITHUB_RELEASE_REPO
vercel env add GITHUB_PUBLIC_READ_TOKEN
```

---

#### 📝 Task 6.2: Review Deployment Configuration

**Check `vercel.json` (if exists):**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

**Recommended Headers (create `next.config.ts` additions):**
```typescript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block'
        }
      ]
    }
  ];
}
```

---

#### 🎯 Task 6.3: Deploy to Production

**Using Vercel CLI:**

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login
vercel login

# Deploy to production
vercel --prod
```

**Expected Output:**
```
✅  Production: https://guardian-website.vercel.app [3s]
📝  Inspect: https://vercel.com/your-username/guardian-website/abc123
```

---

### Phase 7: Post-Deployment Validation (30 minutes)

#### ✅ Task 7.1: Functional Tests

**Test on production URL:**

- [ ] Homepage loads without errors
- [ ] Navigation works (all pages)
- [ ] Download page fetches latest release
- [ ] Theme toggle persists across pages
- [ ] Videos load and play
- [ ] Mobile responsive (test on real device or BrowserStack)
- [ ] Forms work (contact page)

---

#### 📊 Task 7.2: Production Lighthouse Audit

**Run on deployed URL:**

```bash
lighthouse https://your-domain.com \
  --output=html \
  --output-path=./lighthouse-production.html
```

**Or use online tools:**
- PageSpeed Insights: https://pagespeed.web.dev/
- WebPageTest: https://www.webpagetest.org/

**Target Scores:**
- Performance: 95+
- Accessibility: 100
- Best Practices: 100
- SEO: 100

---

#### 🔍 Task 7.3: SEO Verification

**Check these URLs:**

- [ ] **Open Graph Image:** `https://your-domain.com/og?title=Test`
- [ ] **Sitemap:** `https://your-domain.com/sitemap.xml`
- [ ] **Robots.txt:** `https://your-domain.com/robots.txt`
- [ ] **Favicon:** `https://your-domain.com/favicon.ico`

**Meta tags check:**
```bash
curl -s https://your-domain.com | grep '<meta'
```

Should include:
- `og:title`, `og:description`, `og:image`
- `twitter:card`, `twitter:title`
- `description`, `keywords`

---

#### 🔒 Task 7.4: Security Checks

**Verify HTTPS:**
```bash
curl -I https://your-domain.com | grep "HTTP/"
# Should show: HTTP/2 200
```

**Check headers:**
```bash
curl -I https://your-domain.com | grep -i "x-"
# Should include security headers:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
```

**Check for exposed secrets:**
- View page source
- Search for "token", "key", "secret"
- Should find NONE

---

## 📊 Success Metrics

### Week 4 Complete When:

✅ **All automated tests pass:**
- Unit tests: 105/105 ✓
- E2E tests: All browsers ✓
- Pre-launch script: 0 failures ✓

✅ **Performance targets met:**
- Lighthouse Performance: 90+ ✓
- Lighthouse Accessibility: 95+ ✓
- Lighthouse Best Practices: 95+ ✓
- Lighthouse SEO: 95+ ✓

✅ **Coverage targets met:**
- Overall: 45%+ ✓
- lib/: 80%+ ✓
- components/: 60%+ ✓

✅ **Production deployment successful:**
- Site live on Vercel ✓
- Custom domain configured (optional) ✓
- Analytics tracking works ✓

✅ **Zero errors in production:**
- Browser console clean ✓
- No hydration warnings ✓
- All pages load < 3s ✓

---

## 🆘 Troubleshooting

### E2E Tests Failing

**Issue:** Tests timeout or fail
```bash
# Increase timeout in playwright.config.ts
timeout: 60000  # 60 seconds
```

**Issue:** API rate limit during tests
```bash
# Add GitHub token to .env.test
GITHUB_PUBLIC_READ_TOKEN=ghp_xxx
```

---

### Lighthouse Score Low

**Performance < 90:**
- Optimize images: `npm run optimize:media`
- Add `priority` to hero images
- Reduce JavaScript bundle size

**Accessibility < 95:**
- Add alt text to all images
- Improve color contrast
- Add ARIA labels to interactive elements

---

### Build Fails in Production

**Check Vercel build logs:**
```bash
vercel logs <deployment-url>
```

**Common issues:**
- Missing environment variables
- TypeScript errors (strict mode)
- Missing dependencies in package.json

---

### Deployment Issues

**Issue:** "Build failed" on Vercel
1. Check build logs in Vercel dashboard
2. Replicate locally: `npm run build`
3. Fix errors and redeploy

**Issue:** Site loads but API fails
1. Check environment variables are set in Vercel
2. Verify GitHub token has correct permissions
3. Check Vercel Function logs

---

## 📚 Additional Resources

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **Lighthouse Guides:** https://web.dev/lighthouse/
- **Playwright Docs:** https://playwright.dev/
- **Web Vitals:** https://web.dev/vitals/

---

## 🎯 Next Steps After Week 4

### Immediate (Week 5):
1. **Monitor:** Vercel Analytics for errors
2. **Optimize:** Based on real user data
3. **Test:** Cross-browser compatibility on BrowserStack

### Short-term (Month 1):
1. **SEO:** Submit sitemap to Google Search Console
2. **Performance:** Monitor Core Web Vitals
3. **Analytics:** Set up conversion tracking

### Long-term (Quarter 1):
1. **CDN:** Consider CloudFlare for additional caching
2. **Internationalization:** Add i18n support if needed
3. **A/B Testing:** Experiment with landing page variants

---

**Last Updated:** February 7, 2026  
**Status:** Ready for Execution  
**Blocker:** Waiting for user to confirm hydration fixes in browser
