import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { buildPageMetadata } from "../../../lib/seo";
import { normalizeLocale, withLocale } from "../../../lib/locale";
import { Mail, MapPin } from "lucide-react";

// LinkedIn ve Twitter/X logolu SVG icon'ları (lucide-react'te kararsız, inline kullanıyoruz)
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const title = locale === "tr" ? "İletişim" : "Contact";
  const description =
    locale === "tr"
      ? "Ürün, destek veya işbirliği konuları için Guardian ekibiyle iletişime geçin."
      : "Get in touch with the Guardian team for product, support, or partnership questions.";

  return buildPageMetadata({
    title,
    description,
    path: withLocale(locale, "/contact"),
    locale,
  });
}

export default async function ContactPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  const heroTitleTop =
    locale === "tr" ? "Geleceği konuşalım" : "Let's talk about";
  const heroTitleBottom =
    locale === "tr" ? "geleceği." : "the future.";

  const heroDesc =
    locale === "tr"
      ? "Mühendislik ekiplerinin daha iyi yazılım üretmesine yardım ediyoruz. Zorluklarınızı paylaşın, birlikte çözüm bulalım."
      : "We help engineering teams build better software. Share your challenges, and let's find a solution together.";

  const emailTitle = locale === "tr" ? "E-posta" : "Email us";
  const emailSubtitle =
    locale === "tr" ? "Genel sorular ve destek" : "For general inquiries and support";

  const basedInTitle = locale === "tr" ? "Konum" : "Based in";
  const basedInSubtitle = locale === "tr" ? "Merkez" : "Our headquarters";
  const basedInValue = locale === "tr" ? "Finlandiya" : "Finland";

  const socialsTitle = locale === "tr" ? "Bizi takip edin" : "Connect with us";
  const formTitle = locale === "tr" ? "Mesaj gönderin" : "Send us a message";

  return (
    <div className="min-h-screen pt-32 pb-20 px-4 md:px-8 lg:px-12 bg-white dark:bg-black">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
        <div className="space-y-12 lg:py-8">
          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-[1.1]">
              {heroTitleTop} <br />
              <span className="text-zinc-400 dark:text-zinc-600">{heroTitleBottom}</span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-md leading-relaxed font-light">
              {heroDesc}
            </p>
          </div>

          <div className="space-y-10">
            <div className="flex items-start gap-5 group">
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800 transition-colors">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{emailTitle}</h3>
                <p className="text-zinc-500 dark:text-zinc-500 text-sm mb-2">{emailSubtitle}</p>
                <a
                  href="mailto:contact@senoldogan.dev"
                  className="text-lg font-medium text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors border-b-2 border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white pb-0.5"
                >
                  contact@senoldogan.dev
                </a>
              </div>
            </div>

            <div className="flex items-start gap-5 group">
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800 transition-colors">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{basedInTitle}</h3>
                <p className="text-zinc-500 dark:text-zinc-500 text-sm mb-2">{basedInSubtitle}</p>
                <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{basedInValue}</p>
              </div>
            </div>
          </div>

          <div className="pt-10 border-t border-zinc-100 dark:border-zinc-800">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-6">
              {socialsTitle}
            </h3>
            <div className="flex gap-4">
              <a
                href="https://linkedin.com/in/senoldogann"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-[#0077b5] hover:text-white hover:border-transparent transition-all duration-300"
              >
                <LinkedInIcon className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com/senoldoganx"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black hover:border-transparent transition-all duration-300"
              >
                <XIcon className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900/20 p-8 md:p-10 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-none lg:sticky lg:top-32 h-fit">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-8">{formTitle}</h2>
          <ContactForm locale={locale} />
        </div>
      </div>
    </div>
  );
}
