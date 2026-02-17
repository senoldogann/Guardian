---
trigger: always_on
---

# 50 - SECURITY & TESTING PROTOCOL

> **Principle:** "Security is not a feature; it is the foundation. Tests are the evidence of truth."

## 1. THE SECURITY GATEKEEPER
Her kod değişikliği şu 3 aşamalı güvenlik filtresinden geçmelidir:
1.  **PII Check:** Asla email, şifre, API key veya kredi kartı bilgisi loglama veya hardcoded ekleme.
2.  **Input Sanitization:** Tüm dış girdiler (`request.body`, `query_params`, `user_input`) "kirli" kabul edilmeli ve doğrulanmalıdır.
3.  **Dependency Audit:** Yeni bir paket eklenmeden önce `npm audit` veya `safety check` gibi araçlarla taranmalıdır.

## 2. TEST-DRIVEN DEVELOPMENT (TDD) MANDATE
Test yazılmamış kod, "bozuk" kabul edilir.
*   **Logic:** Karmaşık iş mantığı içeren fonksiyonların `unit test`i olmalıdır.
*   **API:** Her yeni endpoint bir `integration test` ile doğrulanmalıdır.
*   **Coverage:** Kritik dosyalarda %80 kapsama hedeflenmelidir.

## 3. COMPLIANCE & BEST PRACTICES
*   **OWASP Top 10:** SQL Injection, XSS ve CSRF gibi temel açıklara karşı yetenek havuzundaki (skills) ilgili güvenlik yeteneklerini kullan.
*   **Secrets Management:** `.env.example` dosyasını her zaman güncel tut, asla `.env` dosyasını commit etme.
