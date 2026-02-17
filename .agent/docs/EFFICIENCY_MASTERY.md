# 🧠 Efficiency Mastery: Senior Architect's Pro Tips

Bu belge, Maestro sistemini en üst düzey verimlilikle kullanmanıza yardımcı olacak ileri düzey stratejileri içerir.

---

## 1. Hibrit Geliştirme Stratejisi
Sistemi sadece bir modda tutmak yerine, projenin aşamasına göre mod değiştirin:
*   **Aşama 1 (Fikir/Mimari):** `ACTIVE_MODE=interactive` ile başlayın. `/brainstorm` yaparak mimariyi oturtun.
*   **Aşama 2 (Kitlesel Üretim):** Mimari netleşince bir PRD (Gereksinim Dökümanı) hazırlayın ve `ACTIVE_MODE=autonomous` yaparak Loki'yi salın.
*   **Aşama 3 (Cila/Debug):** Tekrar `interactive` moda geçerek ince ayarları yapın.

## 2. "Sokratik Kapı"yı Bir Filtre Olarak Kullanın
Ben soru sorduğumda, proaktif olun:
*   **Kötü Cevap:** "Evet, yap."
*   **Efso Cevap:** "Evet yap ama performansı önceliklendir, redis cache eklemeyi unutma ve hata yönetimi için SPAP v2.2 kurallarına uy."
*   **Neden?** Bana ne kadar çok "kısıt" (constraint) verirseniz, o kadar az seçenek arasında kaybolur ve en doğru sonucu üretirim.

## 3. Context Pruning (Bağlam Budama) Bilinci
Sistem artık kendi hafızasını buduyor (`prune_memory.py`), ancak siz de yardımcı olabilirsiniz:
*   Çok uzun konuşma geçmişi (Thread) varsa, yeni bir konuşma başlatıp `CONTINUITY.md` üzerinden devam etmemi isteyin. Bu sayede LLM'in dikkati tazelenir.

## 4. Handoff Onayı (Acknowledgment) Takibi
Eğer kompleks bir iş akışı (Workflow) yürütüyorsanız, `.loki/memory/handoffs/` klasörünü kontrol edin:
*   Ajanlar birbirine iş devrederken her şeyin "Acknowledged" olduğundan emin olun.
*   Eğer bir ajan takılırsa, "Handoff dosyasını tekrar incele" diyerek onu uyarın.

## 5. Doğrulama (Verification) Mandası
İş bittiğinde sadece "çalışıyor mu?" diye sormayın:
*   `python scripts/verify_all.py` gibi otomasyonları kullanmamı isteyin.
*   "Güvenlik açıklarını taradın mı?" veya "Performance audit yaptın mı?" gibi spesifik kalite soruları sorun.

---

**Unutmayın:** Sistem ne kadar zeki olursa olsun, en iyi sonuçlar **net hedefler** ve **doğru mod seçimi** ile gelir.
