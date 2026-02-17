# 🚀 USAGE GUIDE: Maestro Sistemi Nasıl Kullanılır?

Bu sistem, senin için kod yazan sıradan bir AI değil; kurallara sıkı sıkıya bağlı bir **Yazılım Mühendisidir**. 
Onu bir "Junior Developer" gibi değil, bir "Takım Arkadaşı" gibi yönetmelisin.

---

## 🟢 Adım 1: Görevi Başlat (Tetikleyici)
Her iş için özel bir komut var. İsteğini yazmadan önce mutlaka bunları kullan:

| Komut | Ne Zaman Kullanılır? | Örnek |
|-------|----------------------|-------|
| `/brainstorm` | Fikrin henüz tam değilse, tartışmak istiyorsan. | *"Müzik uygulaması için veritabanı ne olmalı?"* |
| `/plan` | Ne yapacağını biliyorsun ama adım adım plan lazım. | *"Login sisteminin kurulum planını hazırla."* |
| `/create` | Yeni bir dosya, fonksiyon veya özellik eklenecekse. | *"User modelini oluştur ve API endpoint'i yaz."* |
| `/enhance` | Var olan bir koda özellik ekleyeceksen. | *"Login sistemine 'Google ile Giriş' ekle."* |
| `/debug` | Bir hata veya sorun varsa. | *"Uygulama 500 hatası veriyor, sebebi bul."* |
| `/test` | Test yazmak veya çalıştırmak için. | *"Auth servisi için unit testleri yaz."* |

---

## 🟡 Adım 2: Sokratik Kapı (Durdur & Düşün)
Komutu verdikten sonra ben hemen koda "saldırmam". Seni durdurur ve soru sorarım.
*   **Benim Amacım:** Hata yapma riskini sıfıra indirmek.
*   **Senin Görevin:** Sorularıma kısa ve net cevaplar vermek.

> *Örnek:* 
> **Ben:** "Veritabanı ilişkisel mi olacak? Hangi kütüphaneyi kullanacağız?"
> **Sen:** "PostgreSQL ve Prisma kullan."

---

## 🔵 Adım 3: Operasyonel Modu Seç (`MODE.md`)
Sistemin nasıl davranacağını belirlemek için `MODE.md` dosyasını kullanabilirsin:
*   **Interactive (Varsayılan):** Benimle karşılıklı konuşarak kod geliştirmek istediğinde.
*   **Autonomous (Otonom):** Elinde tam bir teknik döküman (PRD) varsa ve benim hiç soru sormadan işi bitirmemi istiyorsan.

> **İpucu:** Mod değiştirmek için `MODE.md` içindeki `ACTIVE_MODE` değerini güncellemen yeterli.

---

## 🟣 Adım 4: İş Teslimi ve El Sıkışma (Handoff)
Artık ajanlar arası geçişler daha güvenli. Bir ajan işini bitirdiğinde:
1.  Bir **Handoff (Teslimat)** dosyası oluşturur. 
2.  Diğer ajan bu dosyayı okur ve **"Onaylandı"** (Acknowledged) işareti bırakır.
Bu sayede hiçbir detay arada kaybolmaz. Sen sadece süreci izlersin.

---

## 🔴 Adım 5: Plan, Onay ve Kontrol (Verification)
Cevaplarını aldıktan sonra sana bir **Yol Haritası (Implementation Plan)** sunarım.
*   Bu dosyada hangi dosyaların değişeceği yazar.
*   Sen **"Onaylıyorum"** demeden tek satır kod yazmam.
*   İş bittiğinde **"Son kontrolleri yap ve raporu göster."** diyerek beni denetle.

---

## 💡 İpuçları (Advanced Cheat Sheet)
*   **Kısa Ol:** Uzun destanlar yazmana gerek yok. `/create Login sayfası` demen yeterli. Detayları ben soracağım.
*   **Hafıza Temizliği:** Sistem çok şişerse endişelenme, `scripts/prune_memory.py` arka planda hafızayı budayarak beni hep taze tutuyor.
*   **Kuralcı Ol:** Eğer kurallara uymadığımı hissedersen (örn: test yazmadım), beni uyar: *"Kuralları oku!"*
*   **Hiyerarşiye Güven:** Önce `AGENTS.md` sonra `MODE.md` okunur. Mimaride bir sorun görürsen buraları kontrol et.

**Hazırsan `/brainstorm` veya `/create` ile ilk görevini ver!** 🚀

