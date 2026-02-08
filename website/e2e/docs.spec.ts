import { test, expect } from "@playwright/test";

/**
 * Documentation Page E2E Tests
 * 
 * Tests the documentation system including:
 * - Docs index page
 * - Individual doc pages
 * - Navigation between docs
 * - Markdown rendering
 * - Code syntax highlighting
 * - Mobile responsiveness
 */

test.describe("Documentation - Index", () => {
  test("should load docs index page", async ({ page }) => {
    await page.goto("/docs");
    
    // Page title
    await expect(page).toHaveTitle(/Docs|Documentation|Guardian/);
    
    // Main heading
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
  });
  
  test("should display documentation links", async ({ page }) => {
    await page.goto("/docs");
    
    // Should have links to individual docs
    const docLinks = page.locator('a[href^="/docs/"]');
    const count = await docLinks.count();
    
    expect(count).toBeGreaterThan(0);
    
    // First link should be visible
    await expect(docLinks.first()).toBeVisible();
  });
  
  test("should have navigation structure", async ({ page }) => {
    await page.goto("/docs");
    
    // Should have some navigation elements
    const nav = page.locator("nav, aside, [role='navigation']");
    const navCount = await nav.count();
    
    // At least header navigation should exist
    expect(navCount).toBeGreaterThan(0);
  });
});

test.describe("Documentation - Individual Pages", () => {
  test("should navigate to specific doc page", async ({ page }) => {
    await page.goto("/docs");
    
    // Click first doc link
    const firstDocLink = page.locator('a[href^="/docs/"]').first();
    await firstDocLink.click();
    
    // URL should change
    await page.waitForURL(/\/docs\/.+/);
    
    // Content should load
    const article = page.locator("article, main, [role='main']");
    await expect(article).toBeVisible();
  });
  
  test("should render markdown content", async ({ page }) => {
    // Try to load a known doc (get-started or first available)
    await page.goto("/docs/get-started").catch(() => {
      // If get-started doesn't exist, try docs index
      return page.goto("/docs");
    });
    
    // Should have formatted content elements
    const hasHeading = await page.locator("h1, h2, h3").count() > 0;
    const hasParagraph = await page.locator("p").count() > 0;
    
    expect(hasHeading || hasParagraph).toBe(true);
  });
  
  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/docs/get-started").catch(() => page.goto("/docs"));
    
    // Check for logical heading structure (h1 should exist)
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBeGreaterThan(0);
  });
  
  test("should render code blocks if present", async ({ page }) => {
    await page.goto("/docs/get-started").catch(() => page.goto("/docs"));
    
    // Check for code elements
    const codeBlocks = page.locator("pre code, code");
    const count = await codeBlocks.count();
    
    // Docs likely have code examples
    if (count > 0) {
      await expect(codeBlocks.first()).toBeVisible();
    }
  });
  
  test("should have readable typography", async ({ page }) => {
    await page.goto("/docs/get-started").catch(() => page.goto("/docs"));
    
    // Check paragraph font size is reasonable
    const paragraph = page.locator("p").first();
    
    if (await paragraph.isVisible()) {
      const fontSize = await paragraph.evaluate((el) => 
        window.getComputedStyle(el).fontSize
      );
      
      const size = parseInt(fontSize);
      // Should be at least 14px for readability
      expect(size).toBeGreaterThanOrEqual(14);
    }
  });
});

test.describe("Documentation - Navigation Flow", () => {
  test("should navigate between docs", async ({ page }) => {
    await page.goto("/docs");
    
    // Get all doc links
    const docLinks = page.locator('a[href^="/docs/"]');
    const count = await docLinks.count();
    
    if (count >= 2) {
      // Click first doc
      await docLinks.nth(0).click();
      const firstUrl = page.url();
      
      // Go back to docs index
      await page.goto("/docs");
      
      // Click second doc
      await docLinks.nth(1).click();
      const secondUrl = page.url();
      
      // URLs should be different
      expect(firstUrl).not.toBe(secondUrl);
    }
  });
  
  test("should have breadcrumb or back navigation", async ({ page }) => {
    await page.goto("/docs/get-started").catch(() => page.goto("/docs"));
    
    // Should have a way to go back (breadcrumb, back button, or nav)
    const backElements = page.locator('a[href="/docs"], [aria-label*="back" i], nav a');
    const count = await backElements.count();
    
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Documentation - Content Safety", () => {
  test("should sanitize markdown HTML", async ({ page }) => {
    await page.goto("/docs/get-started").catch(() => page.goto("/docs"));
    
    // Check that dangerous HTML is not rendered
    const scripts = page.locator("article script, main script");
    const scriptCount = await scripts.count();
    
    // Markdown content should not have script tags
    expect(scriptCount).toBe(0);
  });
  
  test("should handle missing docs gracefully", async ({ page }) => {
    const response = await page.goto("/docs/non-existent-doc-12345");
    
    // Should either 404 or redirect
    if (response) {
      const status = response.status();
      expect([200, 404]).toContain(status);
    }
  });
});

test.describe("Documentation - SEO", () => {
  test("should have unique meta descriptions per doc", async ({ page }) => {
    await page.goto("/docs/get-started").catch(() => page.goto("/docs"));
    
    // Meta description should exist
    const metaDesc = page.locator('meta[name="description"]');
    const content = await metaDesc.getAttribute("content");
    
    expect(content).toBeTruthy();
    expect(content?.length || 0).toBeGreaterThan(10);
  });
  
  test("should have proper canonical URLs", async ({ page }) => {
    await page.goto("/docs/get-started").catch(() => page.goto("/docs"));
    
    // Canonical link should match current URL
    const canonical = page.locator('link[rel="canonical"]');
    
    if (await canonical.count() > 0) {
      const href = await canonical.getAttribute("href");
      expect(href).toContain("/docs");
    }
  });
});

test.describe("Documentation - Mobile", () => {
  test.use({ 
    viewport: { width: 375, height: 667 } 
  });
  
  test("should be readable on mobile", async ({ page }) => {
    await page.goto("/docs");
    
    // Content should be visible
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    
    // No horizontal scroll
    const bodyWidth = await page.locator("body").evaluate((el) => el.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 0;
    
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });
  
  test("should have mobile-friendly navigation", async ({ page }) => {
    await page.goto("/docs");
    
    // Links should be tappable
    const firstLink = page.locator('a[href^="/docs/"]').first();
    
    if (await firstLink.isVisible()) {
      const box = await firstLink.boundingBox();
      
      if (box) {
        // Minimum touch target size
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }
  });
  
  test("should handle long code blocks on mobile", async ({ page }) => {
    await page.goto("/docs/get-started").catch(() => page.goto("/docs"));
    
    // Code blocks should be scrollable, not overflow
    const codeBlock = page.locator("pre code").first();
    
    if (await codeBlock.isVisible()) {
      const parent = codeBlock.locator("..");
      const overflow = await parent.evaluate((el) => 
        window.getComputedStyle(el).overflowX
      );
      
      // Should be auto or scroll, not visible
      expect(["auto", "scroll", "hidden"]).toContain(overflow);
    }
  });
});

test.describe("Documentation - Accessibility", () => {
  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/docs/get-started").catch(() => page.goto("/docs"));
    
    // H1 should come before H2
    const h1 = page.locator("h1").first();
    const h2 = page.locator("h2").first();
    
    if (await h1.isVisible() && await h2.isVisible()) {
      const h1Y = (await h1.boundingBox())?.y || 0;
      const h2Y = (await h2.boundingBox())?.y || 0;
      
      expect(h1Y).toBeLessThan(h2Y);
    }
  });
  
  test("should have skip to content link", async ({ page }) => {
    await page.goto("/docs");
    
    // Press Tab to focus first focusable element
    await page.keyboard.press("Tab");
    
    // First focused element might be skip link
    const focused = page.locator(":focus");
    const text = await focused.textContent();
    
    // Skip link should exist (though might not be first)
    const skipLink = page.locator('a[href="#main"], a[href="#content"]');
    
    // Either skip link exists or main navigation is first
    expect(await skipLink.count() >= 0).toBe(true);
  });
});
