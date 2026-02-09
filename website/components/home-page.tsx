"use client";

import { StructuredData } from "./structured-data";
import type { SiteDictionary } from "../lib/i18n";
import { buildOrganizationJsonLd, buildSoftwareApplicationJsonLd, buildWebsiteJsonLd } from "../lib/seo";
import { HeroSection } from "./home/HeroSection";
import { FeaturesSection } from "./home/FeaturesSection";
import { DemoSection } from "./home/DemoSection";
import { UseCasesSection } from "./home/UseCasesSection";

type HomePageProps = {
  dict: SiteDictionary;
};

export function HomePageView({ dict }: HomePageProps) {
  return (
    <>
      <StructuredData payload={buildSoftwareApplicationJsonLd()} />
      <StructuredData payload={buildOrganizationJsonLd()} />
      <StructuredData payload={buildWebsiteJsonLd()} />

      <div className="flex flex-col min-h-screen pt-16 overflow-x-hidden">
        <HeroSection dict={dict} />
        <FeaturesSection />
        <DemoSection dict={dict} />
        <UseCasesSection />
      </div>
    </>
  );
}
