import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, FileQuestion, Home, Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center animate-in fade-in-0">
        <div className="mb-8">
          <div className="relative inline-block">
            <div className="text-9xl font-black text-black/5 dark:text-white/5 select-none">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center">
                <FileQuestion className="w-10 h-10 text-black/60 dark:text-white/60" />
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-black dark:text-white mb-4">
          Page not found
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved, deleted, or never existed.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full px-6 h-12 gap-2 bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go home
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center rounded-full px-6 h-12 gap-2 border border-black/20 dark:border-white/20 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <Search className="w-4 h-4" />
            Browse docs
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-black/10 dark:border-white/10">
          <p className="text-sm text-zinc-500 mb-4">
            Looking for something else?
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link 
              href="/download" 
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Download
            </Link>
            <Link 
              href="/changelog" 
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Changelog
            </Link>
            <Link 
              href="/docs" 
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Documentation
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
