"use client";

import Link from "next/link";
import {
  HelpCircle,
  Download,
  MessageCircle,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/locale";
import { withLocale } from "@/lib/locale";
import type { SiteDictionary } from "@/lib/i18n";

type FaqItem = { q: string; a: string };
type FaqCategory = {
  id: string;
  title: string;
  icon: LucideIcon;
  questions: FaqItem[];
};

const faqCategoriesEn: FaqCategory[] = [
  {
    id: "general",
    title: "General",
    icon: HelpCircle,
    questions: [
      {
        q: "What is Guardian?",
        a: "Guardian is a local-first desktop + CLI governance layer for small engineering teams that control AI-generated or AI-assisted code before it ships. It isolates risky changes, enforces team policies, and keeps human approval decisions with an audit trail.",
      },
      {
        q: "Who is Guardian for?",
        a: "Guardian is designed for small engineering teams that need policy-backed release confidence on AI-assisted changes. It is not a generic chatbot, coding assistant, or scanner.",
      },
      {
        q: "Is Guardian open source?",
        a: "This repository is licensed under MIT. If you are using a fork or a packaged distribution, check the LICENSE file shipped with that build for the definitive terms.",
      },
      {
        q: "What platforms does Guardian support?",
        a: "Guardian ships macOS builds today (Apple Silicon and Intel). Windows and Linux installers will appear on the download page as they are published.",
      },
    ],
  },
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Download,
    questions: [
      {
        q: "How do I install Guardian?",
        a: "Visit the download page and choose the recommended installer for your operating system. After downloading, run the installer and follow the setup flow in the app.",
      },
      {
        q: "What are the system requirements?",
        a: "macOS 12+ is required for current builds. At least 4GB RAM and ~500MB free disk space are recommended. Internet access is required only if you enable cloud AI providers or in-app update checks.",
      },
      {
        q: "How do I control what files Guardian scans?",
        a: "Use Settings > Scan Scope. Source (default) focuses on code and skips docs/tests/scripts/lockfiles. Extended adds infra and security surfaces (Docker/CI/locks/config). Full scans most text files for deep one-off audits.",
      },
      {
        q: "How do I use web search with Guru?",
        a: "Add your Tavily key in Settings, then enable Web Search. To force web search for a single message, prefix your question with /web or include @web. If your message includes a URL, Guardian prefers focused URL extraction; otherwise it uses web search.",
      },
    ],
  },
  {
    id: "support",
    title: "Support & Community",
    icon: MessageCircle,
    questions: [
      {
        q: "How can I get help with Guardian?",
        a: "Start with the documentation on this website. For technical issues and feature requests, use the repository issue tracker or contact us through the contact page.",
      },
      {
        q: "Where can I report bugs or request features?",
        a: "Use the contact page (recommended) and include reproduction steps and logs. You can also use the repository issue tracker if you prefer.",
      },
      {
        q: "How often is Guardian updated?",
        a: "Updates are delivered through the in-app updater when enabled, and new releases are also published via the distribution repository.",
      },
    ],
  },
];

const faqCategoriesTr: FaqCategory[] = [
  {
    id: "general",
    title: "Genel",
    icon: HelpCircle,
    questions: [
      {
        q: "Guardian nedir?",
        a: "Guardian, küçük mühendislik ekiplerinin AI ile üretilen veya AI destekli kodu release öncesi kontrol etmesi için tasarlanmış local-first bir desktop + CLI yönetişim katmanıdır. Riskli değişiklikleri ayırır, takım politikalarını uygular ve insan onay kararlarını denetim iziyle kaydeder.",
      },
      {
        q: "Guardian kimler için?",
        a: "Guardian, AI destekli değişikliklerde politika temelli release güveni isteyen küçük mühendislik ekipleri için tasarlanmıştır. Genel bir chatbot, coding assistant veya scanner değildir.",
      },
      {
        q: "Guardian açık kaynak mı?",
        a: "Bu repository MIT lisanslıdır. Fork veya paketlenmiş bir dağıtım kullanıyorsanız, ilgili build ile gelen LICENSE dosyası nihai kaynaktır.",
      },
      {
        q: "Guardian hangi platformları destekliyor?",
        a: "Guardian bugün macOS için yayınlanır (Apple Silicon ve Intel). Windows ve Linux yükleyicileri yayınlandıkça indirme sayfasında görünür.",
      },
    ],
  },
  {
    id: "getting-started",
    title: "Başlarken",
    icon: Download,
    questions: [
      {
        q: "Guardian'ı nasıl kurarım?",
        a: "İndirme sayfasına gidip işletim sisteminize önerilen paketi indirin. Kurulumu çalıştırın ve uygulama içindeki setup adımlarını takip edin.",
      },
      {
        q: "Sistem gereksinimleri neler?",
        a: "Mevcut sürümler için macOS 12+ gerekir. En az 4GB RAM ve ~500MB boş disk alanı önerilir. İnternet sadece cloud AI sağlayıcıları veya update kontrolü etkinse gereklidir.",
      },
      {
        q: "Guardian'ın hangi dosyaları tarayacağını nasıl kontrol ederim?",
        a: "Ayarlar > Scan Scope alanını kullanın. Source (varsayılan) kodu hedefler ve docs/tests/scripts/lockfiles gibi gürültüyü atlar. Extended infra ve güvenlik yüzeylerini ekler (Docker/CI/lock/config). Full çoğu text dosyayı tarar (tek seferlik derin audit için).",
      },
      {
        q: "Guru ile web search nasıl kullanılır?",
        a: "Ayarlar'da Tavily anahtarınızı ekleyin ve Web Search'ü açın. Tek mesaj için web search zorlamak isterseniz sorunun başına /web ekleyin veya @web yazın. Mesajınızda bir URL varsa Guardian önce o sayfadan odaklı extract yapmayı tercih eder; yoksa search kullanır.",
      },
    ],
  },
  {
    id: "support",
    title: "Destek",
    icon: MessageCircle,
    questions: [
      {
        q: "Guardian için nasıl yardım alabilirim?",
        a: "Önce bu sitedeki dokümantasyona bakın. Teknik sorunlar/feature istekleri için issue tracker veya iletişim sayfasını kullanabilirsiniz.",
      },
      {
        q: "Bug bildirimini / öneriyi nereye yapabilirim?",
        a: "İletişim sayfasını (önerilir) kullanın ve mümkünse çoğaltma adımlarıyla log ekleyin. İsterseniz repository issue tracker'ı da kullanılabilir.",
      },
      {
        q: "Guardian ne sıklıkla güncellenir?",
        a: "Güncellemeler uygulama içi updater ile (etkinse) gelir; yeni release’ler ayrıca distribution reposu üzerinden yayınlanır.",
      },
    ],
  },
];

export function FAQPageView({ dict, locale }: { dict: SiteDictionary; locale: Locale }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const faqCategories = locale === "tr" ? faqCategoriesTr : faqCategoriesEn;

  useEffect(() => {
    const handleScroll = () => {
      const footer = document.querySelector("footer");
      const sidebar = document.querySelector("aside");

      if (!footer || !sidebar) return;

      const sidebarContent = sidebar.firstElementChild as HTMLElement;
      if (!sidebarContent) return;

      const footerRect = footer.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const distanceToFooter = footerRect.top - windowHeight;

      if (distanceToFooter < 0) {
        sidebarContent.style.maxHeight = `calc(100vh - 8rem - ${Math.abs(distanceToFooter)}px)`;
      } else {
        sidebarContent.style.maxHeight = "calc(100vh - 8rem)";
      }
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const contactHref = withLocale(locale, "/contact");

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="mx-auto max-w-6xl px-4 pt-28 pb-20">
        <section className="mb-10">
          <p className="text-xs font-semibold tracking-[0.24em] uppercase text-neutral-500 dark:text-neutral-400">
            {locale === "tr" ? "Destek Merkezi" : "Support Center"}
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            {locale === "tr" ? "Sık Sorulan Sorular" : "Frequently Asked Questions"}
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg text-neutral-600 dark:text-neutral-400">
            {locale === "tr"
              ? "Guardian hakkında bilmeniz gereken her şey. Aradığınızı bulamadınız mı?"
              : "Everything you need to know about Guardian. Can't find what you're looking for?"}{" "}
            <Link
              href={contactHref}
              className="text-neutral-950 dark:text-white underline decoration-neutral-300 hover:decoration-neutral-900"
            >
              {locale === "tr" ? "İletişime geçin" : "contact us"}
            </Link>
            .
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12 relative">
          <aside className="hidden lg:block">
            <div className="sticky top-32 w-full transition-all duration-200">
              <h3 className="px-3 mb-4 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                {locale === "tr" ? "Kategoriler" : "Categories"}
              </h3>
              <div className="space-y-2">
                {faqCategories.map((category) => (
                  <a
                    key={category.id}
                    href={`#${category.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-950 dark:hover:text-white transition-colors"
                  >
                    <category.icon className="w-4 h-4" aria-hidden="true" />
                    {category.title}
                  </a>
                ))}
              </div>
            </div>
          </aside>

          <div className="lg:hidden mb-6">
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/60 text-neutral-800 dark:text-neutral-200"
            >
              <span className="text-sm font-semibold">{locale === "tr" ? "Kategoriler" : "Categories"}</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${mobileNavOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {mobileNavOpen ? (
              <div className="mt-2 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2">
                {faqCategories.map((category) => (
                  <a
                    key={category.id}
                    href={`#${category.id}`}
                    onClick={() => setMobileNavOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-950 dark:hover:text-white transition-colors"
                  >
                    <category.icon className="w-4 h-4" aria-hidden="true" />
                    {category.title}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-12">
            {faqCategories.map((category) => (
              <section key={category.id} id={category.id} className="scroll-mt-32">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
                    <category.icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <h2 className="text-2xl font-semibold text-neutral-950 dark:text-white">
                    {category.title}
                  </h2>
                </div>

                <div className="space-y-4">
                  {category.questions.map((item, idx) => (
                    <details
                      key={`${category.id}-${idx}`}
                      className="group rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-black/40 backdrop-blur"
                    >
                      <summary className="list-none cursor-pointer px-5 py-4 flex items-start justify-between gap-4">
                        <span className="text-base font-medium text-neutral-950 dark:text-white">
                          {item.q}
                        </span>
                        <ChevronDown
                          className="w-5 h-5 text-neutral-500 dark:text-neutral-400 transition-transform group-open:rotate-180"
                          aria-hidden="true"
                        />
                      </summary>
                      <div className="px-5 pb-5 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {item.a}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}

            <section className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/30 p-6">
              <h3 className="text-lg font-semibold text-neutral-950 dark:text-white">
                {locale === "tr" ? "Daha fazla yardım mı lazım?" : "Need more help?"}
              </h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {locale === "tr"
                  ? "Sorununuzu ve mümkünse logları paylaşın, birlikte çözelim."
                  : "Share your issue (and logs if possible) and we will help you resolve it."}
              </p>
              <div className="mt-4">
                <Link
                  href={contactHref}
                  className="inline-flex items-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-2 text-sm font-semibold text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  {dict.nav.contact}
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
