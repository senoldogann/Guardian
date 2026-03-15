import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { normalizeLocale, withLocale } from "@/lib/locale";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const title = locale === "tr" ? "Gizlilik Politikası" : "Privacy Policy";
  const description =
    locale === "tr"
      ? "Guardian için gizlilik politikası."
      : "Privacy Policy for Guardian.";

  return buildPageMetadata({
    title,
    description,
    path: withLocale(locale, "/privacy-policy"),
    locale,
  });
}

export default async function PrivacyPolicyPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  const lastUpdated = locale === "tr" ? "Son güncelleme: 9 Şubat 2026" : "Last updated: February 9, 2026";

  return (
    <div className="min-h-screen pt-32 pb-20 px-4 md:px-8 bg-white dark:bg-black">
      <div className="max-w-4xl mx-auto prose prose-zinc dark:prose-invert">
        <h1>{locale === "tr" ? "Gizlilik Politikası" : "Privacy Policy"}</h1>
        <p className="lead">{lastUpdated}</p>

        <p>
          {locale === "tr"
            ? "Guardian (\"biz\") gizliliğinize saygı duyar. Bu web sitesi üzerinden kişisel veri toplamıyoruz. Bu politika, cihazınızda neleri yerel olarak sakladığımızı ve bunu nasıl kontrol edebileceğinizi açıklar."
            : "At Guardian (\"we\", \"us\", or \"our\"), we respect your privacy and do not collect personal data through this website. This policy explains what we store locally on your device and how you can control it."}
        </p>

        <h2>{locale === "tr" ? "1. Gizliliğe yaklaşımımız" : "1. Our Approach to Privacy"}</h2>
        <p>
          {locale === "tr"
            ? "Pazarlama takipçileri veya reklam pikseli kullanmıyoruz. Kullanıcı profilleri tutmuyor, kimliği belirlenebilir etkinlikleri sunucularımızda loglamıyoruz. Ziyaretiniz anonimdir."
            : "We do not run marketing trackers or advertising pixels. We do not store user profiles or log identifiable activity on our servers. Your visit to this website is anonymous and we do not collect any personally identifiable information."}
        </p>

        <h2>{locale === "tr" ? "2. Toplamadığımız veriler" : "2. What We Do Not Collect"}</h2>
        <p>{locale === "tr" ? "Özellikle şunları toplamıyoruz:" : "We explicitly do not collect:"}</p>
        <ul>
          <li>{locale === "tr" ? "Kimlik bilgileri (ad, e-posta, telefon)" : "Identity information (name, email, phone number)"}</li>
          <li>{locale === "tr" ? "Ödeme/fatura bilgileri" : "Contact data or billing information"}</li>
          <li>{locale === "tr" ? "IP adresi veya konum verisi" : "IP addresses or location data"}</li>
          <li>{locale === "tr" ? "Gezinme geçmişi veya kullanım profilleri" : "Browsing history or usage patterns"}</li>
          <li>{locale === "tr" ? "Takip/reklam amaçlı çerezler" : "Cookies for tracking or advertising purposes"}</li>
        </ul>

        <h2>{locale === "tr" ? "3. Yerel cihaz depolaması" : "3. Local Device Storage"}</h2>
        <p>
          {locale === "tr"
            ? "Deneyimi iyileştirmek için yalnızca temel tercihleri cihazınızda saklarız:"
            : "We only store essential preferences directly on your device to improve your experience:"}
        </p>
        <ul>
          <li>
            <strong>{locale === "tr" ? "Tema tercihi:" : "Theme Preference:"}</strong>{" "}
            {locale === "tr"
              ? "Açık/koyu mod seçiminiz tarayıcı localStorage’ında tutulur."
              : "Your choice of light or dark mode is stored in your browser's localStorage."}
          </li>
        </ul>
        <p>
          {locale === "tr"
            ? "Bu veriler cihazınızdan dışarı çıkmaz ve üçüncü taraflarla paylaşılmaz."
            : "This data never leaves your device and is not transmitted to our servers or any third parties."}
        </p>

        <h2>{locale === "tr" ? "4. İletişim formu" : "4. Contact Form"}</h2>
        <p>
          {locale === "tr"
            ? "İletişim formu varsayılan e-posta istemcinizi (mailto) kullanır. Mesajlarınızı sunucularımızda işlemiyor veya saklamıyoruz."
            : "Our contact form uses your default email client (mailto link). We do not process or store your messages on our servers."}
        </p>

        <h2>{locale === "tr" ? "5. Veri güvenliği" : "5. Data Security"}</h2>
        <p>
          {locale === "tr"
            ? "Sunucularımızda kişisel veri olmadığı için, bu kapsamda korunacak bir kullanıcı verisi depolamıyoruz. Yerel cihazınızdaki veriler sizin kontrolünüzdedir."
            : "Since we do not collect personal data on our servers, there is no personal data to secure on our end. The only data stored is on your own device, which you control completely."}
        </p>

        <h2>{locale === "tr" ? "6. İletişim" : "6. Contact Details"}</h2>
        <p>
          {locale === "tr"
            ? "Gizlilik politikasıyla ilgili sorularınız için bize şuradan ulaşın: "
            : "If you have any questions about this privacy policy or our privacy practices, please contact us at: "}
          <a href="mailto:contact@senoldogan.dev">contact@senoldogan.dev</a>.
        </p>
      </div>
    </div>
  );
}
