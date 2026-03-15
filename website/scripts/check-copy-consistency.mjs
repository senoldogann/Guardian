#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const staticTargets = [
  "app/layout.tsx",
  "app/[locale]/page.tsx",
  "components/home-page.tsx",
  "components/faq/faq-page-view.tsx",
  "content/i18n/en.json",
  "content/i18n/tr.json",
  "lib/seo.ts",
];

const bannedPhrases = [
  "ai coding assistant",
  "code review tool",
  "security scanner",
  "quality checker",
  "developer productivity tool",
  "enterprise-grade",
  "release-driven governance",
];

const requiredSignals = [
  {
    relPath: "content/i18n/en.json",
    phrases: ["control ai-generated code before it ships", "small engineering teams"],
  },
  {
    relPath: "content/i18n/tr.json",
    phrases: ["ai ile üretilen kodu release öncesi kontrol edin", "küçük mühendislik ekipleri"],
  },
];

async function collectTargets(root) {
  const targetSet = new Set(staticTargets);
  const dynamicDirs = [
    { relDir: "components/home", ext: ".tsx" },
    { relDir: "content/docs/en", ext: ".mdx" },
    { relDir: "content/docs/tr", ext: ".mdx" },
  ];

  for (const { relDir, ext } of dynamicDirs) {
    const absDir = resolve(root, relDir);
    try {
      const entries = await readdir(absDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(ext)) {
          targetSet.add(`${relDir}/${entry.name}`);
        }
      }
    } catch {
      // Ignore missing optional directories.
    }
  }

  return [...targetSet];
}

async function main() {
  const root = process.cwd();
  const targets = await collectTargets(root);
  const violations = [];

  for (const relPath of targets) {
    const absPath = resolve(root, relPath);
    let content = "";
    try {
      content = await readFile(absPath, "utf8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    for (const phrase of bannedPhrases) {
      for (let i = 0; i < lines.length; i += 1) {
        const loweredLine = lines[i].toLowerCase();
        if (!loweredLine.includes(phrase)) continue;
        const contextWindow = lines
          .slice(Math.max(0, i - 3), i + 1)
          .join(" ")
          .toLowerCase();
        const isNegated =
          contextWindow.includes(" is not") ||
          contextWindow.includes("not:") ||
          contextWindow.includes("**not**") ||
          contextWindow.includes("not**:") ||
          contextWindow.includes("değildir") ||
          contextWindow.includes("şunlar değildir");
        if (!isNegated) {
          violations.push({ relPath, phrase });
        }
      }
    }
  }

  for (const signal of requiredSignals) {
    const absPath = resolve(root, signal.relPath);
    let content = "";
    try {
      content = (await readFile(absPath, "utf8")).toLowerCase();
    } catch {
      violations.push({
        relPath: signal.relPath,
        phrase: "missing file for required signal check",
      });
      continue;
    }
    for (const phrase of signal.phrases) {
      if (!content.includes(phrase)) {
        violations.push({
          relPath: signal.relPath,
          phrase: `missing required signal "${phrase}"`,
        });
      }
    }
  }

  if (violations.length > 0) {
    console.error("Copy consistency check failed:");
    for (const violation of violations) {
      console.error(`- ${violation.relPath}: banned phrase "${violation.phrase}"`);
    }
    process.exit(1);
  }

  console.log("Copy consistency check passed.");
}

main().catch((error) => {
  console.error("Copy consistency check errored:", error);
  process.exit(1);
});
