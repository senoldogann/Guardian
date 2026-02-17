# 🎯 TECH STACK RULES: Antigravity Workspace

> **CONTEXT:** Bu dosya proje başlangıcında SPAP v2.2 uyarınca oluşturulmuştur.

## 1. MANDATORY CONSTRAINTS (KATI KURALLAR)
* **Language:** TypeScript (Strict Mode: ON)
* **Architecture:** Layered Architecture (Controller -> Service -> Repository)
* **Testing:** Min %80 Coverage.

## 2. FORBIDDEN PATTERNS (YASAKLAR)
* **No `any`:** `any` kullanımı kesinlikle yasaktır, her şey tiplenmelidir.
* **No Inline Styles:** Tüm stiller CSS Modules veya Tailwind ile yönetilmeli.
* **No Magic Strings:** Sabitler `constants/` altında tutulmalı.

## 3. PERFORMANCE & SCALE
* **N+1 Avoidance:** Tüm DB sorguları batching/loading ile optimize edilmeli.
* **Async Correctness:** Hiçbir async işlem `await` edilmeden havada bırakılmamalı.
