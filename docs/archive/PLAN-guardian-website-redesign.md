# PLAN-guardian-website-redesign.md

## 1. Context & Goal
The current Guardian website is functional but visually outdated ("dandik"). The goal is to redesign it into a professional, "2026-standard" official application site. This involves migrating to a modern tech stack (Tailwind CSS v4, Framer Motion) and adding critical sections: Changelog, Documentation, and Download.

## 2. Tech Stack & Architecture
- **Framework**: Next.js 15 (Existing)
- **Styling**: Tailwind CSS v4 (New) + PostCSS
- **Icons**: Lucide React
- **Animation**: Framer Motion
- **Data Fetching**: GitHub API (for Releases/Changelog)
- **Typography**: Space Grotesk (Headings), DM Sans (Body) - Existing
- **Theme**: Guardian Emerald + Dark Glassmorphism

## 3. Implementation Steps

### Phase 1: Foundation Setup
- [ ] Install dependencies: `tailwindcss postcss @tailwindcss/postcss lucide-react framer-motion clsx tailwind-merge`
- [ ] Configure PostCSS and Tailwind v4 in `globals.css`
- [ ] Create `lib/utils.ts` for `cn` helper
- [ ] Initialize `components/ui` folder (Button, Badge, Card, Container)

### Phase 2: Core Pages
- [ ] **Homepage (`/`)**: 
  - Hero Section (Value Prop + Download CTA)
  - Features Grid (Glassmorphism cards)
  - Stats / Social Proof
  - Footer
- [ ] **Changelog (`/changelog`)**:
  - Fetch releases from `https://api.github.com/repos/doganchen/guardian/releases` (Simulated or Real)
  - Render Markdown content
  - Timeline layout
- [ ] **Documentation (`/docs`)**:
  - Sidebar navigation
  - Markdown rendering (utilizing existing `react-markdown` but styled)
- [ ] **Download (`/download`)**:
  - OS Detection
  - Direct download links for DMG, MSI, AppImage

### Phase 3: Polish & "Pro-Max" UX
- [ ] Micro-animations (Hover states, Page transitions)
- [ ] Responsive Design Check
- [ ] SEO Metadata update
- [ ] Dark Mode Optimization (Default)

## 4. Verification
- [ ] Check build success: `npm run build`
- [ ] Verify Tailwind integration
- [ ] Verify GitHub data fetching
- [ ] Accessibility Audit (Lighthouse)

## 5. Agent Assignments
- **Architect/Planner**: Antigravity (Me)
- **Frontend Specialist**: Antigravity (Me) - implementing Design System
