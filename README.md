# ⛏️ GoldTrack PE — Taktiksel Karar Destek Sistemi (DSS)

Peru altın madenciliği taktiksel karar almak için geliştirilmiş, **veri ve model güdümlü (Data & Model-Driven)** taktiksel seviyede Karar Destek Sistemi. Orta düzey yöneticilerin **6–12 aylık planlama ufkunda** veri odaklı taktiksel kararlar almasını sağlar.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express)
![Lisans](https://img.shields.io/badge/Lisans-MIT-blue?style=flat-square)

---

## 📌 Proje Kapsamı ve Veri Modeli

GoldTrack PE, Peru genelindeki **39 aktif altın madenini** tek bir portföy olarak izler. Sistem; coğrafi konum, rezerv miktarı, altın tenörü, çevresel risk seviyesi, AISC (Toplam Sürdürme Maliyeti) ve CAPEX gibi operasyonel parametreleri kullanarak hibrit bir analiz sunar. 

Veritabanı **MySQL 8.0** üzerinde **3. Normal Form (3NF)** ilişkisel yapıda çalışır. Sistem, gerçek veri bulunmadığı durumlarda analitik yeteneklerini sergilemek üzere **Dinamik Simülasyon Motoru**'nu devreye sokar. Bu motor; mevsimsel dalgalanmaları, piyasa volatilitesini ve %5 olasılıklı anomali senaryolarını (arıza vb.) matematiksel olarak modelleyerek 24 aylık tutarlı, algoritmik veriler üretir.

---

## 🖥️ Ekran Görüntüleri

### Taktiksel Genel Bakış & Saha Haritası
![Dashboard](dashboard.png)

### Saha Haritası (Tam Ekran)
![Harita](map.png)

### Maden Performans Karnesi & Bütçe Kontrolü
![Performans](performance.png)

### Taktiksel Analiz & Finansal Araçlar
![Analiz](analysis.png)

### Bütçe ve Finansal Kontrol Detayı
![Finans](finance.png)

---

## 🚀 Temel Modüller ve Yetenekler

- 📊 **Maden Performans Karnesi:** 39 maden için A/B/C/D derecelendirme sistemi (0–100 puan).
- 💰 **Bütçe ve Finansal Kontrol:** Gerçekleşen kâr, kalan CAPEX bütçesi ve OPEX hedef marj sapma analizi.
- 🗺️ **İnteraktif Saha Haritası:** ROI bazlı renk kodlamasına sahip dinamik Leaflet.js haritası.
- 📈 **Taktiksel Analiz Araçları:** Bütçe Sapma (Tornado), Başa Baş Noktası, 3 Aylık Üretim Tahmini ve Verimlilik Kıyaslama (Benchmark) grafikleri.
- 🎯 **Operasyonel İyileştirme:** Acil müdahale gerektiren, en düşük performanslı 8 sahanın otomatik tespiti.
- 🤖 **Yapay Zeka Taktiksel Rapor:** Portföy genel durumu için PDF olarak indirilebilen yönetici özeti.

---

## 🧠 Gelişmiş Karar Destek Mekanizmaları (Prescriptive DSS)

Sistem sadece mevcut durumu raporlamakla kalmaz, analitik karar alma süreçlerini yönlendirir:

*   🚨 **Kural Tabanlı Uyarı Motoru:** Lojistik maliyeti artışı, üretim düşüşü veya çevresel risklere karşı 6 farklı kural ile otomatik **KIRMIZI / SARI / MAVİ** uyarılar üretir.
*   🔄 **Karar Denetim İzi (Decision Audit Trail):** Yöneticilerin aldığı kararları ve operasyonel hedefleri kaydeder. Sistem **90 gün sonra** bu kararların sonuçlarını otomatik olarak denetleyerek kurumsal öğrenme döngüsü oluşturur.
*   💡 **Fiyat Senaryo Simülasyonu:** Altın fiyatlarındaki **±%30** aralığındaki piyasa değişimlerinin, portföy gelirlerine ve hedeflere olan anlık etkisini simüle eder.
*   ⚖️ **YoY (Yıldan Yıla) Kıyaslama:** Çeyreklik bazda mevcut yıl ile önceki yılın maliyet ve performans analizini sunar.

---

## 🔧 Performans Puanlama Algoritması

Her operasyon sahası için bileşik bir puanlama modeli (0–100) işletilir. Sonuçlar **A** (≥80) · **B** (≥60) · **C** (≥40) · **D** (<40) olarak derecelendirilir.

| Bileşen | Ağırlık | Analiz Mantığı |
|---------|---------|----------|
| **AISC Verimliliği** | %40 | Düşük sürdürme maliyeti = Yüksek puan |
| **ROI Performansı** | %30 | Toplam yatırım getirisi oranı (Gelir / Gider optimizasyonu) |
| **Risk Profili** | %30 | Çevresel risk seviyesiyle (1-5) ters orantılı hesaplama |

---

## 🛠️ Teknik Mimari & Katmanlar

Proje, operasyonel bağımsızlığı maksimize eden, dışa bağımlılığı düşük (vendor lock-in riskini azaltan) 3 katmanlı bir mimari üzerine inşa edilmiştir.

| Katman | Kullanılan Teknolojiler | Detaylar |
|--------|-----------|-----------|
| **Arayüz (Frontend)** | HTML5, Vanilla JS, TailwindCSS | SPA mimarisi. Grafikler için `Chart.js` & `ApexCharts`, Harita için `Leaflet.js`, PDF Çıktı için `jsPDF + html2canvas` |
| **Sunucu (Backend)** | Node.js, Express.js | 9 farklı RESTful API endpointi (KPI'lar, zaman serileri, uyarılar, YoY analizleri). |
| **Veritabanı (DB)** | MySQL 8.0 (InnoDB) | `companies`, `regions`, `mines`, `mine_metrics` ve `decision_audit` tabloları. |
