import { cache } from "react";
import path from "node:path";
import { promises as fs } from "node:fs";
import matter from "gray-matter";

export type DocMeta = {
  slug: string;
  title: string;
  summary: string;
  section: string;
  order: number;
};

export type DocHeading = {
  id: string;
  text: string;
  level: 2 | 3;
};

export type DocEntry = {
  meta: DocMeta;
  content: string;
  headings: DocHeading[];
};

const DOCS_ROOT = path.join(process.cwd(), "content", "docs");
const DOCS_LOCALE = "en";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parseHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const match = line.match(/^(##|###)\s+(.+)$/);
    if (!match) continue;
    const level = match[1] === "##" ? 2 : 3;
    const text = match[2].replace(/`/g, "").trim();
    headings.push({
      id: slugify(text),
      text,
      level
    });
  }
  return headings;
}

async function readDocFile(fileName: string): Promise<DocEntry> {
  const filePath = path.join(DOCS_ROOT, DOCS_LOCALE, fileName);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  const slug = fileName.replace(/\.mdx?$/i, "");

  const meta: DocMeta = {
    slug,
    title: String(parsed.data.title ?? slug),
    summary: String(parsed.data.summary ?? ""),
    section: String(parsed.data.section ?? "General"),
    order: Number(parsed.data.order ?? 999),
  };

  return {
    meta,
    content: parsed.content.trim(),
    headings: parseHeadings(parsed.content)
  };
}

async function readDocs(): Promise<DocEntry[]> {
  const localeDir = path.join(DOCS_ROOT, DOCS_LOCALE);
  const files = await fs.readdir(localeDir);
  const docs = await Promise.all(
    files
      .filter((file) => file.endsWith(".mdx") || file.endsWith(".md"))
      .map((file) => readDocFile(file))
  );

  return docs.sort((a, b) => {
    if (a.meta.section !== b.meta.section) {
      return a.meta.section.localeCompare(b.meta.section);
    }
    if (a.meta.order !== b.meta.order) {
      return a.meta.order - b.meta.order;
    }
    return a.meta.title.localeCompare(b.meta.title);
  });
}

export const getDocs = cache(readDocs);

export const getDoc = cache(async (slug: string): Promise<DocEntry | null> => {
  const docs = await getDocs();
  return docs.find((doc) => doc.meta.slug === slug) ?? null;
});

export const getDocSections = cache(async (): Promise<Array<{ title: string; docs: DocMeta[] }>> => {
  const docs = await getDocs();
  const map = new Map<string, DocMeta[]>();
  for (const doc of docs) {
    const current = map.get(doc.meta.section) ?? [];
    current.push(doc.meta);
    map.set(doc.meta.section, current);
  }
  return Array.from(map.entries()).map(([title, entries]) => ({
    title,
    docs: entries
  }));
});
