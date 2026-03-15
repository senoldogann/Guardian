"use client";

import { StructuredData } from "./structured-data";
import type { SiteDictionary } from "../lib/i18n";
import { buildOrganizationJsonLd, buildSoftwareApplicationJsonLd, buildWebsiteJsonLd } from "../lib/seo";
import { HeroSection } from "./home/HeroSection";
import { DifferentiatorsSection } from "./home/DifferentiatorsSection";
import { AgentObjectionSection } from "./home/AgentObjectionSection";
import { FeaturesSection } from "./home/FeaturesSection";
import { DemoSection } from "./home/DemoSection";
import { UseCasesSection } from "./home/UseCasesSection";
import type { Locale } from "../lib/locale";

type HomePageProps = {
  dict: SiteDictionary;
  locale: Locale;
};

export function HomePageView({ dict, locale }: HomePageProps) {
  return (
    <>
      <StructuredData payload={buildSoftwareApplicationJsonLd()} />
      <StructuredData payload={buildOrganizationJsonLd()} />
      <StructuredData payload={buildWebsiteJsonLd()} />

      <div className="flex flex-col min-h-screen pt-16 overflow-x-hidden">
        <HeroSection dict={dict} locale={locale} />
        <DifferentiatorsSection locale={locale} />
        <AgentObjectionSection locale={locale} />
        <FeaturesSection locale={locale} />
        <DemoSection dict={dict} locale={locale} />
        <UseCasesSection locale={locale} />
      </div>
    </>
  );
}
