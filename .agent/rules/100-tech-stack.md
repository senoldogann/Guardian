# 100-TECH-STACK RULES

## 1. COMMON RULES
*   **Package Manager:** `npm`
*   **Formatting:** Prettier (implicit).
*   **Linting:** ESLint (Flat Config).

## 2. FRONTEND (DESKTOP & WEB)
*   **Frameworks:** React 18.3
*   **Styling:** Tailwind CSS v4.
    *   Use `@theme` block in CSS for custom tokens.
    *   Use `clsx` and `tailwind-merge` for class manipulation.
*   **Icons:** `lucide-react`.
*   **Animation:** `framer-motion`.

## 3. TAURI (DESKTOP SPECIFIC)
*   **Inter-Process Communication (IPC):** Use strict typing for Tauri commands.
*   **Security:** Explicitly define permissions in `capabilities/`.
*   **Windowing:** Use `react-window` for large lists to ensure performance.

## 4. NEXT.JS (WEB SPECIFIC)
*   **Router:** App Router (`/app` directory).
*   **Components:** Server Components by default. Use `"use client"` only when necessary (state, effects, interactivity).
*   **Optimization:** Use `next/image` and `next/font`.

## 5. TESTING STRATEGY
*   **Unit:** Vitest. Co-locate tests with components (`Component.test.tsx`).
*   **E2E:** Playwright. Store in `/tests` for cross-app testing or project-specific folders.
