# GUARDIAN - AGENT GOVERNANCE PROTOCOL

> **Project:** Guardian
> **Type:** Hybrid Desktop (Tauri) & Web (Next.js) Application
> **Stack:** TypeScript, Rust (Tauri), React, Next.js, Tailwind CSS v4

## 1. PROJECT IDENTITY & PUROPSE
Guardian is a secure, cross-platform application designed for [User to Confirm Specific Purpose]. It consists of a desktop client built with Tauri and a companion website built with Next.js.

## 2. TECH STACK OVERVIEW
| Component | Technology | Version |
|-----------|------------|---------|
| **Core** | TypeScript | 5.x |
| **Desktop** | Tauri (Rust) | v2 |
| **Web Framework** | Next.js | 15.x (App Router) |
| **UI Library** | React | 18.3 |
| **Styling** | Tailwind CSS | v4.x |
| **State** | Zustand | 5.x |
| **Testing** | Vitest, Playwright | - |

## 3. ARCHITECTURAL PATTERNS
*   **Monorepo-ish Structure:**
    *   `/src-tauri`: Rust backend logic.
    *   `/src`: Desktop frontend (Vite + React).
    *   `/website`: Web application (Next.js).
*   **Styling:** Mobile-first, utility-first with Tailwind v4. NO arbitrary values if possible. Use design tokens.
*   **State:** Global UI state via Zustand. Server state via React Query (if applicable) or native hooks.
*   **Components:** Radix UI primitives + Tailwind.

## 4. AGENT RESTRICTIONS & MANDATES
1.  **Tailwind v4 Mandate:** Do NOT use `tailwind.config.js` unless absolutely necessary. Use CSS variables in global CSS for configuration.
2.  **Tauri v2 Mandate:** Follow Tauri v2 security best practices (permissions, capabilities).
3.  **Strict TypeScript:** No `any`. All props must be typed.
4.  **Testing:** New features MUST have Vitest unit tests. Critical flows MUST have Playwright E2E tests.

## 5. DIRECTORY MAP
*   `docs/governance/`: Operational rules and policies.
*   `.agent/rules/`: Agent-specific instruction sets.
*   `src/components/`: Shared UI components (Desktop).
*   `website/components/`: Shared UI components (Web).
