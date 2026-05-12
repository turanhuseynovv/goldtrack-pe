# ⛏️ GoldTrack PE — Taktiksel Karar Destek Sistemi (DSS)

Peru altın madenciliği operasyonları için geliştirilmiş, **veri ve model güdümlü (Data & Model-Driven)** taktiksel seviyede Karar Destek Sistemi. Orta ve üst düzey yöneticilerin **6–12 aylık planlama ufkunda** veri odaklı operasyonel kararlar almasını sağlar.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express)
![Lisans](https://img.shields.io/badge/Lisans-MIT-blue?style=flat-square)

---

## 📌 Proje Kapsamı ve Veri Modeli

GoldTrack PE, Peru genelindeki **39 aktif altın madenini** tek bir portföy olarak izler. Sistem; coğrafi konum, rezerv miktarı, altın tenörü, çevresel risk seviyesi, AISC (Toplam Sürdürme Maliyeti) ve CAPEX gibi operasyonel parametreleri kullanarak hibrit bir analiz sunar. 

Sistem her başlangıçta **24 aylık sentetik üretim ve finansal veri** üreten deterministik bir model çalıştırır. Bu model mevsimsel dalgalanmaları, rastgele volatiliteyi ve %5 olasılıkla gelişen anomali olaylarını simüle ederek gerçekçi bir test ortamı yaratır. Veritabanı **MySQL 8.0** üzerinde **3. Normal Form (3NF)** ilişkisel yapıda çalışır.

---

## 🖥️ Ekran Görüntüleri

### Taktiksel Genel Bakış & Saha Haritası
![Dashboard](screenshots/dashboard.png)

### Saha Haritası (Tam Ekran)
![Harita](screenshots/map.png)

### Maden Performans Karnesi & Bütçe Kontrolü
![Performans](screenshots/performance.png)

### Taktiksel Analiz & Finansal Araçlar
![Analiz](screenshots/analysis.png)

### Bütçe ve Finansal Kontrol Detayı
![Finans](screenshots/finance.png)

---

## 🚀 Temel Modüller ve Yetenekler

- 📊 **Maden Performans Karnesi:** 39 maden için A/B/C/D derecelendirme sistemi (0–100 puan).
- 💰 **Bütçe ve Finansal Kontrol:** Gerçekleşen kâr, kalan CAPEX bütçesi ve OPEX hedef marj sapma analizi.
- 🗺️ **İnteraktif Saha Haritası:** ROI bazlı renk kodlamasına sahip dinamik Leaflet.js haritası.
- 📈 **Taktiksel Analiz Araçları:** Bütçe Sapma (Tornado), Başa Baş Noktası, 3 Aylık Üretim Tahmini ve Verimlilik Kıyaslama (Benchmark) grafikleri.
- 🎯 **Operasyonel İyileştirme:** Acil müdahale gerektiren, en düşük performanslı 8 sahanın tespiti.
- 🤖 **Yapay Zeka Taktiksel Rapor:** Portföy genel durumu için PDF olarak indirilebilen otomatik yönetici özeti.

---

## 🧠 Gelişmiş Karar Destek Mekanizmaları (Prescriptive DSS)

Sistem sadece veriyi göstermekle kalmaz, yöneticiyi yönlendirir:

*   🚨 **Kural Tabanlı Uyarı Motoru:** Lojistik maliyeti artışı, üretim düşüşü veya çevresel risklere karşı 6 farklı kural ile otomatik **KIRMIZI / SARI / MAVİ** uyarılar üretir.
*   🔄 **Karar Denetim İzi (Decision Audit Trail):** Yöneticilerin aldığı kararları ve hedefleri kaydeder. Sistem **90 gün sonra** bu kararları otomatik değerlendirerek kurumsal öğrenme döngüsü oluşturur.
*   💡 **Altın Fiyatı Senaryo Simülasyonu:** Altın fiyatlarındaki **±%30** aralığındaki değişimlerin, portföy gelirlerine ve hedeflere olan anlık etkisini simüle eder.
*   ⚖️ **YoY (Yıldan Yıla) Kıyaslama:** Çeyreklik bazda mevcut yıl ile önceki yılın gider analizini sunar.

---

## 🔧 Performans Puanlama Algoritması

Her maden için bileşik bir puanlama modeli (0–100) işletilir. Sonuçlar **A** (≥80) · **B** (≥60) · **C** (≥40) · **D** (<40) olarak derecelendirilir.

| Bileşen | Ağırlık | Analiz Mantığı |
|---------|---------|----------|
| **AISC Verimliliği** | %40 | Düşük sürdürme maliyeti = Yüksek puan |
| **ROI Performansı** | %30 | Toplam yatırım getirisi oranı (Gelir / Gider optimizasyonu) |
| **Risk Profili** | %30 | Çevresel risk seviyesiyle (1-5) ters orantılı hesaplama |

---

## 🛠️ Teknik Mimari

Proje, **3. Normal Form (3NF)** ilişkisel veritabanı yapısında, 3 katmanlı (Frontend, Backend, DB) bir mimari ile inşa edilmiştir.

| Katman | Kullanılan Teknolojiler | Detaylar |
|--------|-----------|-----------|
| **Arayüz (Frontend)** | HTML5, Vanilla JS, TailwindCSS | SPA mimarisi. Grafikler için `Chart.js` & `ApexCharts`, Harita için `Leaflet.js`, PDF Çıktı için `jsPDF + html2canvas` |
| **Sunucu (Backend)** | Node.js, Express.js | 9 farklı RESTful API endpointi (KPI'lar, zaman serileri, uyarılar, YoY analizleri). |
| **Veritabanı (DB)** | MySQL 8.0 (InnoDB) | `companies`, `regions`, `mines`, `mine_metrics` ve `decision_audit` tabloları. Otomatik Seed mekanizması. |

Sistem her başlangıçta `IF NOT EXISTS` korumasıyla tabloları kurar ve `.env` üzerinden çalışarak tek bir `npm start` komutuyla ayağa kalkar.

---

## ⚙️ Kurulum ve Çalıştırma

Projeyi lokal ortamınızda çalıştırmak için aşağıdaki adımları izleyebilirsiniz:

1. Repoyu bilgisayarınıza klonlayın:
   ```bash
   git clone <repo-url>
