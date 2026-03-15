import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, FileQuestion, Home, Search } from "lucide-react";
import { getDictionary } from "../../lib/i18n";
import { normalizeLocale, withLocale } from "../../lib/locale";

export default async function LocaleNotFoundPage() {
  const hdrs = await headers();
  const locale = normalizeLocale(hdrs.get("x-guardian-locale"));
  const dict = getDictionary(locale);

  const title = locale === "tr" ? "Sayfa bulunamadı" : "Page not found";
  const description =
    locale === "tr"
      ? "Üzgünüz, aradığınız sayfayı bulamadık. Sayfa taşınmış, silinmiş veya hiç var olmamış olabilir."
      : "Sorry, we couldn't find the page you're looking for. It might have been moved, deleted, or never existed.";
  const goHome = locale === "tr" ? "Ana sayfaya dön" : "Go home";
  const browseDocs = locale === "tr" ? "Dokümantasyona göz at" : "Browse docs";
  const looking = locale === "tr" ? "Başka bir şey mi arıyorsunuz?" : "Looking for something else?";

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
                <FileQuestion className="w-10 h-10 text-black/60 dark:text-white/60" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-black dark:text-white mb-4">
          {title}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
          {description}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={withLocale(locale, "/")}
            className="inline-flex items-center justify-center rounded-full px-6 h-12 gap-2 bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            {goHome}
          </Link>
          <Link
            href={withLocale(locale, "/docs")}
            className="inline-flex items-center justify-center rounded-full px-6 h-12 gap-2 border border-black/20 dark:border-white/20 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            {browseDocs}
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-black/10 dark:border-white/10">
          <p className="text-sm text-zinc-500 mb-4">
            {looking}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={withLocale(locale, "/download")}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" aria-hidden="true" />
              {dict.nav.download}
            </Link>
            <Link
              href={withLocale(locale, "/changelog")}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" aria-hidden="true" />
              {dict.nav.changelog}
            </Link>
            <Link
              href={withLocale(locale, "/docs")}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" aria-hidden="true" />
              {dict.nav.docs}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
