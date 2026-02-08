import { describe, it, expect } from "vitest";
import { buildPageMetadata, buildSoftwareApplicationJsonLd, buildWebsiteJsonLd, SITE_URL } from "./seo";

describe("SEO Utilities", () => {
  describe("buildPageMetadata", () => {
    it("should build correct metadata structure", () => {
      const metadata = buildPageMetadata({
        title: "Test Page",
        description: "Test description",
        path: "/test",
      });

      expect(metadata.title).toBe("Test Page");
      expect(metadata.description).toBe("Test description");
      expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/test`);
    });

    it("should include OpenGraph data", () => {
      const metadata = buildPageMetadata({
        title: "Test Page",
        description: "Test description",
        path: "/test",
      });

      expect(metadata.openGraph).toBeDefined();
      expect(metadata.openGraph?.title).toBe("Test Page");
      expect(metadata.openGraph?.description).toBe("Test description");
      expect(metadata.openGraph?.url).toBe(`${SITE_URL}/test`);
      expect(metadata.openGraph?.siteName).toBe("Guardian");
      expect(metadata.openGraph?.type).toBe("website");
    });

    it("should include OpenGraph image", () => {
      const metadata = buildPageMetadata({
        title: "Test Page",
        description: "Test description",
        path: "/test",
      });

      expect(metadata.openGraph?.images).toBeDefined();
      expect(metadata.openGraph?.images).toHaveLength(1);
      
      const image = metadata.openGraph?.images?.[0];
      expect(image).toMatchObject({
        width: 1200,
        height: 630,
        alt: "Test Page",
      });
      expect(image?.url).toContain("/og?");
      expect(image?.url).toContain(encodeURIComponent("Test Page"));
      expect(image?.url).toContain(encodeURIComponent("Test description"));
    });

    it("should include Twitter card data", () => {
      const metadata = buildPageMetadata({
        title: "Test Page",
        description: "Test description",
        path: "/test",
      });

      expect(metadata.twitter).toBeDefined();
      expect(metadata.twitter?.card).toBe("summary_large_image");
      expect(metadata.twitter?.title).toBe("Test Page");
      expect(metadata.twitter?.description).toBe("Test description");
      expect(metadata.twitter?.images).toBeDefined();
      expect(metadata.twitter?.images).toHaveLength(1);
    });

    it("should handle special characters in title/description", () => {
      const metadata = buildPageMetadata({
        title: "Special & Characters",
        description: "Description with <special> chars",
        path: "/special",
      });

      const imageUrl = metadata.openGraph?.images?.[0].url;
      expect(imageUrl).toContain(encodeURIComponent("Special & Characters"));
      expect(imageUrl).toContain(encodeURIComponent("Description with <special> chars"));
    });
  });

  describe("buildSoftwareApplicationJsonLd", () => {
    it("should build correct SoftwareApplication schema", () => {
      const jsonLd = buildSoftwareApplicationJsonLd();

      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("SoftwareApplication");
      expect(jsonLd.name).toBe("Guardian");
      expect(jsonLd.applicationCategory).toBe("DeveloperApplication");
      expect(jsonLd.operatingSystem).toContain("macOS");
      expect(jsonLd.operatingSystem).toContain("Windows");
    });

    it("should include offer information", () => {
      const jsonLd = buildSoftwareApplicationJsonLd();
      
      expect(jsonLd.offers).toMatchObject({
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      });
    });

    it("should include URL", () => {
      const jsonLd = buildSoftwareApplicationJsonLd();
      expect(jsonLd.url).toBe(SITE_URL);
    });
  });

  describe("buildWebsiteJsonLd", () => {
    it("should build correct WebSite schema", () => {
      const jsonLd = buildWebsiteJsonLd();

      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("WebSite");
      expect(jsonLd.name).toBe("Guardian");
      expect(jsonLd.url).toBe(SITE_URL);
    });
  });
});
