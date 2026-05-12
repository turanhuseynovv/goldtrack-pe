// public/map.js — GoldTrack PE (Interactive Mine Map)

const BACKEND_URL = window.location.origin || "http://localhost:3000";

let map = null;          // Harita instance'ı
let markerLayer = null;  // Marker grubu

// Yardımcı: ROI'ye göre renk belirle
function getMarkerColor(roi) {
    if (roi >= 20) return '#16a34a'; // Yeşil (Yüksek Kar)
    if (roi >= 10) return '#ca8a04'; // Sarı (Orta Kar)
    return '#dc2626';                // Kırmızı (Düşük/Riskli)
}

export async function renderMap() {
    const container = document.getElementById("mapContainer");
    
    // Eğer harita kutusu sayfada yoksa işlem yapma
    if (!container) return;

    // 1. Haritayı Başlat (Singleton Pattern)
    if (!map) {
        map = L.map(container, {
            zoomControl: false, // Zoom butonunu biz ekleyeceğiz
            attributionControl: false,
            minZoom: 5,
            maxZoom: 18
        });

        // Peru Merkezli Başlangıç
        map.setView([-9.19, -75.0152], 5);

        // Harita Altlığı (Sade ve Modern)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(map);

        // Zoom Kontrolü (Sağ Alt)
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Marker Grubu
        markerLayer = L.layerGroup().addTo(map);
    }

    // 2. Eski Markerları Temizle
    markerLayer.clearLayers();

    // 3. Veriyi Çek (Slider Değerine Göre)
    const priceChange = document.getElementById("goldPriceSlider")?.value || 0;

    try {
        const res = await fetch(`${BACKEND_URL}/api/top-mines?priceChange=${priceChange}`);
        const mines = await res.json();

        if (!Array.isArray(mines)) {
            console.error("Harita verisi alınamadı.");
            return;
        }

        console.log(`Harita için ${mines.length} maden yüklendi.`);

        // 4. Markerları Döngüyle Ekle
        mines.forEach((mine) => {
            // Veri Dönüşümü (Çok Önemli: Sayıya Çevirme)
            const lat = parseFloat(mine.latitude);
            const lng = parseFloat(mine.longitude);
            const roi = parseFloat(mine.estimated_roi_percent || 0);

            // Koordinat hatası varsa atla
            if (isNaN(lat) || isNaN(lng)) return;

            // Marker Stili (CSS + SVG)
            const color = getMarkerColor(roi);
            
            // Leaflet CircleMarker (Performanslı ve Şık)
            const marker = L.circleMarker([lat, lng], {
                radius: 8,              // Nokta büyüklüğü
                fillColor: color,       // ROI'ye göre renk
                color: "#fff",          // Beyaz çerçeve
                weight: 2,              // Çerçeve kalınlığı
                opacity: 1,
                fillOpacity: 0.9
            });

            // Popup İçeriği (HTML)
            const popupContent = `
                <div style="font-family: 'Inter', sans-serif; text-align: center; min-width: 150px;">
                    <h3 style="margin: 0; color: #1e293b; font-weight: bold; font-size: 14px;">${mine.name}</h3>
                    <p style="margin: 2px 0 8px 0; color: #64748b; font-size: 11px;">${mine.region}</p>
                    
                    <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                        <span style="color: #64748b;">Rezerv:</span>
                        <span style="font-weight: bold;">${(parseFloat(mine.reserve_ton)/1000).toFixed(0)}k ton</span>
                    </div>
                    
                    <div style="margin-top: 6px; padding: 4px; background: ${color}; color: white; border-radius: 4px; font-weight: bold; font-size: 12px;">
                        ROI: %${roi.toFixed(1)}
                    </div>
                    
                    <button id="btn-detail-${mine.id}" style="margin-top: 8px; width: 100%; padding: 4px; background: #f1f5f9; border: none; border-radius: 4px; color: #475569; font-size: 11px; cursor: pointer; font-weight: 600;">
                        Detayları Gör
                    </button>
                </div>
            `;

            marker.bindPopup(popupContent);

            // Popup açıldığında içindeki butona tıklama olayını yakala
            marker.on('popupopen', () => {
                const btn = document.getElementById(`btn-detail-${mine.id}`);
                if (btn) {
                    btn.onclick = () => {
                        // Dashboard.js'deki fonksiyonu tetikle (Event Dispatch Yöntemi)
                        // Bu yöntem modüller arası bağımlılığı azaltır
                        const event = new CustomEvent('mine-selected', { detail: mine.id });
                        document.dispatchEvent(event);
                    };
                }
            });
            
            marker.addTo(markerLayer);
        });

        // Harita boyutunu düzelt (CSS yüklenince bazen gri kalma sorunu için)
        setTimeout(() => map.invalidateSize(), 300);

    } catch (error) {
        console.error("Harita render hatası:", error);
    }
}

// Global Event Listener (dashboard.js bu eventi dinleyip paneli açacak)
// Not: Bu listener'ı dashboard.js tarafına da ekleyebiliriz ama burada da tetikleyici olması iyidir.