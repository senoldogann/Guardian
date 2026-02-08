"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FileQuestion, Home, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full text-center"
      >
        <div className="mb-8">
          <div className="relative inline-block">
            <div className="text-9xl font-black text-white/5 select-none">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <FileQuestion className="w-10 h-10 text-white/60" />
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Page not found
        </h1>
        <p className="text-zinc-400 leading-relaxed mb-8">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved, deleted, or never existed.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            className="rounded-full px-6 h-12 gap-2 bg-white text-black hover:bg-zinc-200"
          >
            <Link href="/">
              <Home className="w-4 h-4" />
              Go home
            </Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="rounded-full px-6 h-12 gap-2 border-white/20 text-white hover:bg-white/10"
          >
            <Link href="/docs">
              <Search className="w-4 h-4" />
              Browse docs
            </Link>
          </Button>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-sm text-zinc-500 mb-4">
            Looking for something else?
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link 
              href="/download" 
              className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Download
            </Link>
            <Link 
              href="/changelog" 
              className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Changelog
            </Link>
            <Link 
              href="/docs" 
              className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Documentation
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
