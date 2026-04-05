"use client";

import Image from "next/image";

export function ProductHuntBadge() {
  return (
    <div className="mt-6 flex justify-center">
      <a
        href="https://www.producthunt.com/products/guardian-ide?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-guardian-ide"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View Guardian IDE on Product Hunt"
        className="inline-flex rounded-lg ring-1 ring-black/10 dark:ring-white/10 transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Image
          alt="Guardian IDE - Control AI-generated code before it ships. | Product Hunt"
          width="250"
          height="54"
          src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1115664&theme=light&t=1775411982329"
          className="block dark:hidden h-auto w-[250px] max-w-full"
          unoptimized
        />
        <Image
          alt="Guardian IDE - Control AI-generated code before it ships. | Product Hunt"
          width="250"
          height="54"
          src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1115664&theme=dark&t=1775412029200"
          className="hidden dark:block h-auto w-[250px] max-w-full"
          unoptimized
        />
      </a>
    </div>
  );
}
