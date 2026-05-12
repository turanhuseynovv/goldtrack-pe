// =============================================================
// GoldTrack PE — Tactical Decision Support System (Frontend)
// =============================================================
// Version: 3.2 (Production)
// Modules: Budget Tracking, Operational Scoring, CSV Export,
//          Scenario Simulation, Tactical Analysis Engine
// =============================================================

import { renderMap } from "./map.js";

// Backend API base URL — change if deploying to a different host
const BACKEND_URL = window.location.origin || "http://localhost:3000";

// ============================================================
// 1. GLOBAL DEĞİŞKENLER VE STATE YÖNETİMİ
// ============================================================

// Veri Tutucular (Sıralama ve Filtreleme İçin)
let currentMineData = [];
let currentSort = { key: 'tactical_score', order: 'desc' }; // Varsayılan: En yüksek performans en üstte

// Grafik Instance'ları (Global tanımlıyoruz ki sayfalar arası geçişte yok edebilelim)
let mainFinancialChart = null;
let costDonutChart = null;
let analysisChartInstance = null;
let chartProdInstance = null;
let chartProfitInstance = null;
let detailMapInstance = null;
let detailYoyChartInstance = null; // Step 4 YoY Chart

// Chart.js Global Ayarları
if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#475569'; 
    Chart.defaults.borderColor = '#e2e8f0'; 
    Chart.defaults.font.family = "'Inter', sans-serif";
}

// ============================================================
// 2. DOM ELEMENT SEÇİCİLERİ
// ============================================================

// Header & Simülasyon
const priceSlider = document.getElementById("goldPriceSlider");
const priceChangeValue = document.getElementById("priceChangeValue");
const simulatedPriceDisplay = document.getElementById("simulatedPriceDisplay"); 
const headerTitle = document.getElementById("headerTitle"); 

// Paneller
const detailPanel = document.getElementById("mineDetailPanel");
const closeDetailBtn = document.getElementById("closeDetailPanel");

// Analiz Alanı
const analysisResultArea = document.getElementById("analysisResultArea");
const analysisTitle = document.getElementById("analysisTitle");
const analysisContent = document.getElementById("analysisContent");

// Raporlama Alanı
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const btnExportExcel = document.getElementById("btnExportExcel");
const summaryDateEl = document.getElementById("summaryDate");
const aiReportContentEl = document.getElementById("aiReportContent");
const quickStatsContentEl = document.getElementById("quickStatsContent");

// ============================================================
// 3. CANLI BORSA BANDI (TICKER)
// ============================================================
function updateLiveTicker() {
    const ticker = document.getElementById("liveGoldTicker");
    if(!ticker) return;
    
    // Simüle Edilmiş Canlı Veri
    const goldPrice = (1950 + Math.random() * 10).toFixed(2);
    const change = (Math.random() * 2 - 1).toFixed(2);
    const isPositive = change > 0;
    
    const silverPrice = (23.50 + Math.random()).toFixed(2);
    const copperPrice = (3.85 + Math.random() * 0.1).toFixed(2);
    
    ticker.innerHTML = `
        <span class="mx-4">GOLD (SPOT): <span class="text-white">$${goldPrice}</span> <span class="${isPositive ? 'text-green-400' : 'text-red-400'}">(${isPositive ? '+' : ''}${change}%)</span></span>
        <span class="mx-4 text-gray-500">|</span>
        <span class="mx-4">SILVER (XAG): <span class="text-white">$${silverPrice}</span></span>
        <span class="mx-4 text-gray-500">|</span>
        <span class="mx-4">COPPER (HG): <span class="text-white">$${copperPrice}</span></span>
        <span class="mx-4 text-gray-500">|</span>
        <span class="mx-4 text-blue-300 ml-8 font-bold">TACTICAL ENGINE: ACTIVE (Monitoring ${getCurrentQuarterLabel()} Operational Budget...)</span>
    `;
}

// Dinamik Çeyrek Hesaplama
function getCurrentQuarterLabel() {
    const now = new Date();
    const q = Math.ceil((now.getMonth() + 1) / 3);
    return `Q${q} ${now.getFullYear()}`;
}

// Header alt başlığını güncelle
const headerSubtitle = document.getElementById('headerSubtitle');
if (headerSubtitle) headerSubtitle.textContent = `${getCurrentQuarterLabel()} Performans Takibi`;

// Ticker'ı Başlat
setInterval(updateLiveTicker, 5000);
updateLiveTicker(); 

// ============================================================
// 4. SIMÜLASYON SLIDER MANTIĞI (Debounce Korumalı)
// ============================================================
let sliderTimeout;

if(priceSlider) {
    priceSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        
        // 1. Yüzdeyi Güncelle
        if(priceChangeValue) {
            priceChangeValue.innerText = (val > 0 ? "+" : "") + val + "%";
            
            // Renk Değişimi (Psikolojik Etki)
            if (val > 0) {
                priceChangeValue.className = "text-sm font-bold text-white bg-green-600 px-3 py-1.5 rounded-lg shadow-sm min-w-[55px] text-center flex-shrink-0 transition-colors";
            } else if (val < 0) {
                priceChangeValue.className = "text-sm font-bold text-white bg-red-600 px-3 py-1.5 rounded-lg shadow-sm min-w-[55px] text-center flex-shrink-0 transition-colors";
            } else {
                priceChangeValue.className = "text-sm font-bold text-white bg-blue-600 px-3 py-1.5 rounded-lg shadow-sm min-w-[55px] text-center flex-shrink-0 transition-colors";
            }
        }

        // 2. Dolar Tutarını Güncelle (Simülasyon)
        const basePrice = 1950;
        const newPrice = basePrice * (1 + val/100);
        if(simulatedPriceDisplay) {
            simulatedPriceDisplay.innerText = "$" + newPrice.toLocaleString('en-US', {maximumFractionDigits: 0});
        }

        // 3. Sayfayı ve KPI'ları Yenile (Debounce - Performans için 300ms bekletir)
        clearTimeout(sliderTimeout);
        sliderTimeout = setTimeout(() => {
            // [DÜZELTME 1]: Slider oynadığında Global KPI'ları (Büyük Kartları) her zaman güncelle
            loadStrategicKPIs(); 
            
            // Aktif olan sayfayı (tablo, grafikler vb.) güncelle
            reloadActivePage();
        }, 300);
    });
}

// ============================================================
// 5. SAYFA YÖNETİMİ VE NAVİGASYON
// ============================================================

// Sayfa Başlıkları Haritası
const pageTitles = {
    home: "Taktiksel Genel Bakış",
    mines: "Maden Performans Karnesi",
    sixMonth: "Bütçe ve Finansal Kontrol",
    analysis: "Taktiksel Analiz Araçları",
    investments: "Operasyonel İyileştirme Fırsatları",
    summary: "Taktiksel Durum Raporu (AI)"
};

// Menü Buton Dinleyicileri
document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const pageId = btn.dataset.page;
        
        // 1. Detay Panelini Kapat (Eğer açıksa)
        if(detailPanel) detailPanel.classList.add("translate-x-full"); 
        
        // 2. Aktif Menüyü İşaretle
        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active", "bg-slate-800", "text-white"));
        btn.classList.add("active", "bg-slate-800", "text-white"); 
        
        // 3. Sayfayı Göster/Gizle
        document.querySelectorAll(".page-section").forEach(s => s.classList.add("hidden"));
        const targetSection = document.getElementById(pageId);
        if(targetSection) targetSection.classList.remove("hidden");
        
        // 4. HEADER BAŞLIĞINI GÜNCELLE
        if(headerTitle) {
            headerTitle.innerText = pageTitles[pageId] || "GoldTrack Dashboard";
        }

        // 5. İlgili Sayfanın Verilerini Yükle
        reloadActivePage();
    });
});

// Aktif Sayfayı Yenileme Fonksiyonu
function reloadActivePage() {
    const active = document.querySelector(".page-section:not(.hidden)");
    if (!active) return;

    // Sayfa ID'sine göre ilgili fonksiyonu çalıştır
    if (active.id === "home") {
        renderMap();
        loadStrategicKPIs();
        loadAlerts(); // Step 3: Load Alerts on Home page
    } else if (active.id === "mines") {
        loadMinesTable();
    } else if (active.id === "sixMonth") {
        loadFinancialDashboard('6m'); // Varsayılan 6 ay
    } else if (active.id === "investments") {
        loadInvestmentList();
    } else if (active.id === "summary") {
        loadSystemSummary();
    } else if (active.id === "analysis") {
        if(analysisResultArea) analysisResultArea.classList.add("hidden");
    }
}

// ============================================================
// 5.5 ALERT ENGINE & DECISION AUDIT (Steps 3 & 5)
// ============================================================
async function loadAlerts() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/alerts`);
        const alerts = await res.json();
        
        const panel = document.getElementById("attentionRequiredPanel");
        const container = document.getElementById("alertsContainer");
        const badge = document.getElementById("alertCountBadge");
        
        if (!alerts || alerts.length === 0) {
            if (panel) panel.classList.add("hidden");
            return;
        }

        // Show panel
        if (panel) panel.classList.remove("hidden");
        if (badge) badge.innerText = `${alerts.length} Uyarı`;
        
        // Filter to show only RED and YELLOW (high priority)
        const priorityAlerts = alerts.filter(a => a.level === 'RED' || a.level === 'YELLOW');
        
        // Populate container (max 6 to avoid clutter)
        if (container) {
            container.innerHTML = "";
            priorityAlerts.slice(0, 6).forEach(alert => {
                const isRed = alert.level === 'RED';
                const borderColor = isRed ? '#ef4444' : '#eab308';
                const badgeBg = isRed ? '#fef2f2' : '#fefce8';
                const badgeColor = isRed ? '#dc2626' : '#ca8a04';
                const btnBg = isRed ? '#fef2f2' : '#fefce8';
                const btnHoverBg = isRed ? '#fee2e2' : '#fef9c3';
                const btnColor = isRed ? '#b91c1c' : '#a16207';
                const icon = isRed ? '⚠️' : '⚡';
                
                const card = document.createElement("div");
                card.className = "bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition";
                card.style.borderLeft = `4px solid ${borderColor}`;
                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <span style="background:${badgeBg};color:${badgeColor};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding:2px 8px;border-radius:3px;">${alert.level} ALERT</span>
                            <h4 class="font-bold text-slate-800 mt-1 flex items-center">${icon} ${alert.mineName}</h4>
                        </div>
                        <button class="text-gray-400 hover:text-gray-600 transition" onclick="openMineDetail(${alert.mineId})" title="Saha Detayını İncele">🔍</button>
                    </div>
                    <p class="text-xs font-bold text-slate-700 mt-2">${alert.title}</p>
                    <p class="text-xs text-gray-500 mt-1">${alert.message}</p>
                    
                    <div class="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                        <button style="background:${btnBg};color:${btnColor};padding:6px 16px;font-size:12px;font-weight:700;border-radius:8px;border:none;cursor:pointer;transition:background 0.2s;" 
                            onmouseover="this.style.background='${btnHoverBg}'"
                            onmouseout="this.style.background='${btnBg}'"
                            onclick='openDecisionModal(${JSON.stringify(alert).replace(/'/g, "&#39;")})'>
                            Aksiyon Al
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });
        }
    } catch (err) {
        console.error("Alert yükleme hatası:", err);
    }
}

window.openDecisionModal = function(alert) {
    const modal = document.getElementById("decisionModal");
    if (!modal) return;
    
    // Pre-fill modal
    document.getElementById("decisionMineId").value = alert.mineId;
    document.getElementById("decisionAlertLevel").value = alert.level;
    document.getElementById("decisionAlertTitle").innerText = `${alert.mineName} - ${alert.title}`;
    document.getElementById("decisionAlertMessage").innerText = alert.message;
    document.getElementById("decisionText").value = alert.action + "\n\nYönetici Ek Notu: ";
    
    modal.classList.remove("hidden");
};

// Handle Form Submit
const decisionForm = document.getElementById("decisionForm");
if (decisionForm) {
    decisionForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const payload = {
            mine_id: document.getElementById("decisionMineId").value,
            alert_level: document.getElementById("decisionAlertLevel").value,
            trigger_reason: document.getElementById("decisionAlertTitle").innerText,
            decision_text: document.getElementById("decisionText").value,
            action_category: document.getElementById("decisionActionCategory").value,
            success_metric: document.getElementById("decisionSuccessMetric").value,
            target_value: document.getElementById("decisionTargetValue").value || null
        };
        
        try {
            const res = await fetch(`${BACKEND_URL}/api/decisions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert("Karar başarıyla kaydedildi. 90 Günlük takip başlatıldı.");
                document.getElementById("decisionModal").classList.add("hidden");
                // Open detail to see the context
                openMineDetail(payload.mine_id);
            }
        } catch (err) {
            console.error(err);
            alert("Karar kaydedilirken hata oluştu.");
        }
    });
}

// ============================================================
// 6. TACTICAL SCORE ALGORITHM (6–12 Month Horizon)
// ============================================================
// Composite scoring model for middle-management decision making.
// Weights reflect tactical priorities:
//   - Cost Efficiency (AISC):  40 pts — budget adherence
//   - ROI Performance:         30 pts — return vs capital deployed
//   - Operational Risk:        30 pts — environmental & regulatory
// ============================================================
function calculateTacticalScore(mine) {
    // --- Cost Efficiency Component (0–40 pts) ---
    const aisc = parseFloat(mine.aisc_usd_oz || mine.aiscUsdOz || 1200);
    let budgetScore = 0;
    if (aisc <= 1000) budgetScore = 40;
    else if (aisc >= 1500) budgetScore = 10;
    else budgetScore = 40 - ((aisc - 1000) / 500) * 30;

    // --- ROI Component (0–30 pts) ---
    const roi = parseFloat(mine.estimated_roi_percent || mine.estimatedRoi || 0);
    let prodScore = Math.max(0, Math.min(30, (roi / 15) * 30));

    // --- Risk Component (0–30 pts, inverse) ---
    const risk = parseInt(mine.env_risk_level || mine.envRiskLevel || 3);
    const riskMap = { 1: 30, 2: 25, 3: 15, 4: 5, 5: 0 };
    const riskScore = riskMap[risk] ?? 0;

    return Math.round(budgetScore + prodScore + riskScore);
}

// ============================================================
// 7. MADEN LİSTESİ (TABLO, SIRALAMA VE EXCEL EXPORT)
// ============================================================

document.addEventListener('sort-request', (e) => {
    const key = e.detail;
    if (currentSort.key === key) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = key;
        currentSort.order = 'desc'; 
    }
    renderMinesTable(currentMineData); 
});

async function loadMinesTable() {
    const pc = priceSlider.value;
    const tbody = document.getElementById("mineTableBody");
    if(tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500 font-medium animate-pulse">Veriler ve Taktiksel Skorlar Hesaplanıyor...</td></tr>';

    try {
        const res = await fetch(`${BACKEND_URL}/api/top-mines?priceChange=${pc}`);
        let rawData = await res.json();
        
        currentMineData = rawData.map(m => {
            m.tactical_score = calculateTacticalScore(m);
            return m;
        });

        renderMinesTable(currentMineData);  
    } catch (err) { 
        console.error("Tablo yükleme hatası:", err); 
        if(tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Veri yüklenirken hata oluştu. Lütfen backend bağlantısını kontrol edin.</td></tr>';
    }
}

function renderMinesTable(data) {
    const tbody = document.getElementById("mineTableBody");
    if(!tbody) return;
    tbody.innerHTML = "";

    data.sort((a, b) => {
        let valA = a[currentSort.key];
        let valB = b[currentSort.key];

        if(!isNaN(parseFloat(valA))) valA = parseFloat(valA);
        if(!isNaN(parseFloat(valB))) valB = parseFloat(valB);

        if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
        return 0;
    });

    data.forEach(m => {
        const budgetRemaining = (parseFloat(m.capex_required_usd || 0) / 1000000).toFixed(1);
        const score = m.tactical_score;

        let scoreBadge = "";
        if(score >= 80) scoreBadge = `<span class="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded border border-green-200 shadow-sm">A (${score})</span>`;
        else if(score >= 60) scoreBadge = `<span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded border border-blue-200 shadow-sm">B (${score})</span>`;
        else if(score >= 40) scoreBadge = `<span class="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded border border-yellow-200 shadow-sm">C (${score})</span>`;
        else scoreBadge = `<span class="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded border border-red-200 shadow-sm">D (${score})</span>`;

        let riskIndicator = m.env_risk_level >= 4 
            ? '<span class="flex items-center justify-center text-red-600 font-bold"><span class="w-2 h-2 bg-red-600 rounded-full mr-2"></span>Yüksek</span>' 
            : '<span class="flex items-center justify-center text-green-600 font-bold"><span class="w-2 h-2 bg-green-600 rounded-full mr-2"></span>Normal</span>';

        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition border-b border-gray-100 cursor-pointer group"; 
        
        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800 flex items-center gap-2">
                    ${m.name}
                    ${score >= 85 ? '<span title="Verimli Saha">⚡</span>' : ''}
                </div>
                <div class="text-xs text-gray-500 font-normal">${m.company}</div>
            </td>
            <td class="px-6 py-4 text-slate-600 text-sm font-medium">${m.region}</td>
            <td class="px-6 py-4 text-right">
                ${scoreBadge}
            </td>
            <td class="px-6 py-4 text-right text-slate-600 font-mono text-sm">$${budgetRemaining}M</td>
            <td class="px-6 py-4 text-center text-sm">
                ${riskIndicator}
            </td>
        `;
        
        tr.addEventListener("click", () => openMineDetail(m.id));
        tbody.appendChild(tr);
    });
}

// Excel Export
if(btnExportExcel) {
    btnExportExcel.addEventListener("click", async () => {
        const pc = priceSlider.value;
        const originalText = btnExportExcel.innerHTML;
        btnExportExcel.innerHTML = `<span class="animate-spin mr-2">⏳</span> Veri İşleniyor...`;
        btnExportExcel.disabled = true;

        try {
            const res = await fetch(`${BACKEND_URL}/api/top-mines?priceChange=${pc}`);
            let mines = await res.json();
            
            mines = mines.map(m => ({ ...m, tactical_score: calculateTacticalScore(m) }));

            let csvContent = "\uFEFF"; 
            csvContent += "Maden Adi,Sirket,Bolge,Performans Puani (0-100),Butce Durumu,Kalan Butce ($),Risk Seviyesi\r\n";

            mines.forEach(m => {
                const budgetStatus = m.estimated_roi_percent > 10 ? "Bütçe İçi" : "Bütçe Aşımı";
                
                const row = [
                    `"${m.name}"`,
                    `"${m.company}"`,
                    `"${m.region}"`,
                    m.tactical_score,
                    budgetStatus,
                    m.capex_required_usd,
                    m.env_risk_level
                ];
                csvContent += row.join(",") + "\r\n";
            });

            const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            
            const dateStr = new Date().toISOString().split('T')[0];
            link.setAttribute("download", `GoldTrack_Tactical_Report_${dateStr}.csv`);
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) { 
            console.error("Export Error:", err);
            alert("Rapor oluşturulurken bir hata meydana geldi."); 
        } finally {
            btnExportExcel.innerHTML = originalText;
            btnExportExcel.disabled = false;
        }
    });
}

// ============================================================
// 8. FİNANSAL DASHBOARD (Chart.js / ApexCharts)
// ============================================================

window.updateFinancials = function(period, btn) {
    const buttons = document.querySelectorAll('#financial-filters button');
    buttons.forEach(b => {
        b.classList.remove('bg-slate-800', 'text-white');
        b.classList.add('text-gray-600', 'hover:bg-gray-100');
    });
    btn.classList.remove('text-gray-600', 'hover:bg-gray-100');
    btn.classList.add('bg-slate-800', 'text-white');

    loadFinancialDashboard(period);
}

async function loadFinancialDashboard(period = '6m') {
    const priceChange = priceSlider.value;

    try {
        const kpiRes = await fetch(`${BACKEND_URL}/api/financial/kpi?period=${period}&priceChange=${priceChange}`);
        const kpiData = await kpiRes.json();

        const formatMoney = (val) => {
            if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
            if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}K`;
            return `$${val.toFixed(0)}`;
        };

        if(document.getElementById('fin-revenue')) document.getElementById('fin-revenue').innerText = formatMoney(kpiData.revenue);
        if(document.getElementById('fin-expense')) document.getElementById('fin-expense').innerText = formatMoney(kpiData.expense);
        
        const profitEl = document.getElementById('fin-profit');
        if(profitEl) {
            profitEl.innerText = formatMoney(kpiData.profit);
            profitEl.className = `text-3xl font-bold mt-2 ${kpiData.profit >= 0 ? 'text-green-600' : 'text-red-600'}`;
        }

        if(document.getElementById('fin-margin')) document.getElementById('fin-margin').innerText = `%${kpiData.margin}`;
        
        const historyRes = await fetch(`${BACKEND_URL}/api/financial/history?period=${period}&priceChange=${priceChange}`);
        const historyData = await historyRes.json();

        // Budget Variance Model:
        // Budget = Actual Cost × (1 + target margin)
        // This represents management's revenue target for each period.
        // Variance = Actual Revenue - Budgeted Revenue
        const TARGET_MARGIN = 0.15; // 15% target profit margin
        // DSS Expert Update: Diverging Bar Chart for Budget Variance
        // This is the industry standard for showing positive vs negative variances.
        const varianceData = historyData.map(d => {
            const budget = parseFloat(d.Gider) * (1 + TARGET_MARGIN);
            const variance = parseFloat(d.Gelir) - budget;
            return variance.toFixed(0);
        });

        const optionsMain = {
            series: [{
                name: 'Bütçe Sapması (Variance)',
                data: varianceData
            }],
            chart: {
                type: 'bar',
                height: 350,
                toolbar: { show: false },
                fontFamily: 'Inter, sans-serif'
            },
            plotOptions: {
                bar: {
                    colors: {
                        ranges: [
                            { from: -999999999, to: -1, color: '#ef4444' }, // Red for negative variance (Under budget/Loss)
                            { from: 0, to: 999999999, color: '#22c55e' }    // Green for positive variance (Profit)
                        ]
                    },
                    columnWidth: '80%',
                    borderRadius: 2
                }
            },
            dataLabels: { enabled: false },
            xaxis: {
                categories: historyData.map(d => d.name),
                labels: { style: { colors: '#64748b' } }
            },
            yaxis: {
                title: { text: 'Sapma Tutarı ($)' },
                labels: { formatter: (val) => formatMoney(val) }
            },
            tooltip: {
                y: { formatter: (val) => formatMoney(val) }
            },
            // Add a zero line
            annotations: {
                yAxis: [{
                    y: 0,
                    strokeDashArray: 0,
                    borderColor: '#334155',
                    borderWidth: 2
                }]
            }
        };

        if (mainFinancialChart) {
            mainFinancialChart.destroy();
        }
        mainFinancialChart = new ApexCharts(document.querySelector("#apex-main-chart"), optionsMain);
        mainFinancialChart.render();

        const costRes = await fetch(`${BACKEND_URL}/api/financial/cost-breakdown?period=${period}`);
        const costData = await costRes.json();

        const optionsDonut = {
            series: costData.map(c => c.value),
            labels: costData.map(c => c.name),
            chart: { type: 'donut', height: 300, fontFamily: 'Inter, sans-serif' },
            colors: costData.map(c => c.color),
            plotOptions: {
                pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'Toplam OPEX', formatter: (w) => {
                    const sum = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                    return formatMoney(sum);
                }}}}}
            },
            legend: { position: 'bottom' },
            dataLabels: { enabled: false }
        };

        if (costDonutChart) {
            costDonutChart.destroy();
        }
        costDonutChart = new ApexCharts(document.querySelector("#apex-donut-chart"), optionsDonut);
        costDonutChart.render();

    } catch (err) {
        console.error("Finansal dashboard yükleme hatası:", err);
    }
}

// ============================================================
// 9. SİSTEM ÖZETİ VE AI RAPORU
// ============================================================
async function loadSystemSummary() {
    const now = new Date();
    if(summaryDateEl) summaryDateEl.innerText = now.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + " - " + now.toLocaleTimeString('tr-TR');

    const pc = priceSlider.value;
    
    try {
        const res = await fetch(`${BACKEND_URL}/api/top-mines?priceChange=${pc}`);
        let mines = await res.json();
        
        mines = mines.map(m => ({ ...m, tactical_score: calculateTacticalScore(m) }));
        
        const totalMines = mines.length;
        const avgScore = (mines.reduce((a,b) => a + b.tactical_score, 0) / totalMines).toFixed(0);
        const highRiskMines = mines.filter(m => m.env_risk_level >= 4);
        const efficientMines = mines.filter(m => m.tactical_score >= 80);
        
        let aiText = `<p class="mb-4 text-lg text-slate-700">Sayın Operasyon Müdürü, <strong>Q4 Taktiksel Analiz Motoru</strong> portföyünüzü "Bütçe Senaryosu ${pc}%" koşullarında değerlendirmiştir.</p>`;
        
        if (avgScore >= 75) {
            aiText += `<p class="mb-4 border-l-4 border-green-500 pl-4 bg-green-50 p-3 rounded text-slate-700">🚀 <strong>Performans Hedefin Üzerinde:</strong> Operasyonel verimlilik puanı <strong>${avgScore}/100</strong> seviyesindedir. Bütçe sapmaları kontrol altındadır ve nakit akışı pozitiftir.</p>`;
        } else if (avgScore >= 50) {
            aiText += `<p class="mb-4 border-l-4 border-yellow-500 pl-4 bg-yellow-50 p-3 rounded text-slate-700">⚖️ <strong>Performans Kabul Edilebilir:</strong> Ortalama puan <strong>${avgScore}/100</strong> seviyesindedir. Enerji maliyetlerinde kısmi sapmalar gözlenmektedir, bakım planlaması gözden geçirilmelidir.</p>`;
        } else {
            aiText += `<p class="mb-4 border-l-4 border-red-500 pl-4 bg-red-50 p-3 rounded text-slate-700">⚠️ <strong>Performans Kritik:</strong> Ortalama puan <strong>${avgScore}/100</strong> ile hedefin altındadır. Acil maliyet kontrolü (Cost Cutting) gerekmektedir.</p>`;
        }

        if (highRiskMines.length > 0) {
            aiText += `<p class="mb-4 text-slate-600">🛠️ <strong>Darboğaz Tespiti:</strong> <strong>${highRiskMines.length} adet madende</strong> operasyonel risk seviyesi yüksektir. Özellikle <strong>${highRiskMines[0].name}</strong> sahasında öngörülemeyen duruşlar hedeflenen üretimi düşürmektedir.</p>`;
        }

        if (efficientMines.length > 0) {
            aiText += `<p class="mb-4 text-slate-600">💡 <strong>İyi Uygulama Örneği:</strong> <strong>${efficientMines[0].name}</strong> madeni, ${efficientMines[0].tactical_score} puan ile bütçeye en uyumlu sahadır. Buradaki vardiya sistemi diğer sahalara uygulanabilir.</p>`;
        }

        // --- Fetch and Display 90-Day Audit Feedback ---
        try {
            const evalRes = await fetch(`${BACKEND_URL}/api/decisions/evaluate`);
            const evalData = await evalRes.json();
            
            if (evalData.history && evalData.history.length > 0) {
                aiText += `<div class="mt-8 pt-6 border-t border-gray-200">
                    <h4 class="font-bold text-slate-800 text-lg mb-4 flex items-center"><span class="mr-2">⚖️</span> 90 Günlük Karar Değerlendirmesi (Audit Feedback)</h4>
                    <div class="space-y-3">`;
                
                evalData.history.forEach(dec => {
                    const isSuccess = dec.resolution_status === 'SUCCESS';
                    const icon = isSuccess ? '✅' : '❌';
                    const bgColor = isSuccess ? '#f0fdf4' : '#fef2f2';
                    const borderColor = isSuccess ? '#bbf7d0' : '#fecaca';
                    const textColor = isSuccess ? '#166534' : '#991b1b';
                    const targetDisplay = dec.target_value ? `$${parseFloat(dec.target_value).toFixed(0)}` : 'Belirtilmedi';
                    const cleanText = (dec.decision_text || '').replace(/\\n/g, ' ').replace(/\n/g, ' ').trim();
                    
                    aiText += `
                        <div style="background:${bgColor};border:1px solid ${borderColor};padding:12px;border-radius:8px;font-size:13px;">
                            <div style="display:flex;justify-content:space-between;font-weight:700;color:${textColor};margin-bottom:4px;">
                                <span>${icon} ${dec.mineName} — ${dec.action_category}</span>
                                <span>Hedef: ${targetDisplay} ${dec.success_metric}</span>
                            </div>
                            <p style="color:#475569;"><strong>Karar:</strong> ${cleanText}</p>
                            <p style="font-size:11px;color:${textColor};margin-top:4px;font-weight:700;">Sonuç: ${isSuccess ? 'Hedef Başarıyla Tutturuldu' : 'Hedefin Gerisinde Kalındı'}</p>
                        </div>
                    `;
                });
                
                aiText += `</div></div>`;
            }
        } catch (e) {
            console.error("Karar değerlendirme yüklenemedi", e);
        }

        if(aiReportContentEl) aiReportContentEl.innerHTML = aiText;
        
        if(quickStatsContentEl) {
            quickStatsContentEl.innerHTML = `
                <div class="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                    <span class="text-gray-500">Ort. Verimlilik</span>
                    <span class="font-bold text-blue-600 text-xl">${avgScore}/100</span>
                </div>
                <div class="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span class="text-gray-500">Hedef Tutan Saha</span>
                    <span class="font-bold text-green-600">${efficientMines.length} Adet</span>
                </div>
            `;
        }

    } catch (err) {
        console.error("Özet yükleme hatası:", err);
    }
}

if(downloadPdfBtn) {
    downloadPdfBtn.addEventListener("click", async () => {
        const { jsPDF } = window.jspdf;
        downloadPdfBtn.style.visibility = 'hidden';
        const summaryElement = document.getElementById("summary");
        
        try {
            const canvas = await html2canvas(summaryElement, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth - 20, pdfHeight);
            pdf.save("GoldTrack_Taktiksel_Rapor.pdf");
        } catch (err) {
            alert("Rapor oluşturulamadı.");
        } finally {
            downloadPdfBtn.style.visibility = 'visible';
        }
    });
}

// ============================================================
// 10. KPI CARDS (Tactical Focus — Scenario-Responsive)
// ============================================================
// KPI calculations use consistent models:
//   - Revenue responds to price scenarios (multiplicative)
//   - Costs are sticky (mining OPEX is price-inelastic)
//   - AISC has minor elasticity via energy/diesel correlation
// ============================================================
async function loadStrategicKPIs() {
    try {
        const pc = priceSlider.value;
        const changePercent = parseFloat(pc);
        const priceFactor = 1 + changePercent / 100;

        // Fetch both mine data and financial KPIs for consistency
        const [minesRes, kpiRes] = await Promise.all([
            fetch(`${BACKEND_URL}/api/top-mines?priceChange=${pc}`),
            fetch(`${BACKEND_URL}/api/financial/kpi?period=1y&priceChange=${pc}`)
        ]);
        const mines = await minesRes.json();
        const kpiData = await kpiRes.json();

        if (!mines || mines.length === 0) return;

        // --- KPI 1: Realized Profit (from financial endpoint for consistency) ---
        const profitM = kpiData.profit / 1000000;
        const roiEl = document.getElementById("kpi-roi");
        roiEl.innerHTML = `$${profitM.toFixed(1)}M`;
        roiEl.className = `stat-value text-4xl font-bold mt-2 transition duration-300 ${profitM >= 0 ? 'text-green-600' : 'text-red-600'}`;

        // --- KPI 2: Remaining CAPEX Budget ---
        // CAPEX is largely pre-committed; minor inflation effect
        let totalCapex = 0;
        mines.forEach(m => { totalCapex += parseFloat(m.capex_required_usd) || 0; });
        const inflationFactor = 1 + (changePercent * 0.15 / 100);
        const adjustedCapex = (totalCapex / 1e9 * inflationFactor).toFixed(2);
        document.getElementById("kpi-capex").innerText = "$" + adjustedCapex + "B";

        // --- KPI 3: Average AISC (All-In Sustaining Cost) ---
        // AISC has ~30% energy component which correlates with commodity prices
        let totalAisc = 0;
        mines.forEach(m => { totalAisc += parseFloat(m.aisc_usd_oz) || 0; });
        const avgAisc = totalAisc / mines.length;
        const energyElasticity = 0.3; // 30% of AISC is energy-sensitive
        const adjustedAisc = (avgAisc * (1 + (changePercent * energyElasticity / 100))).toFixed(0);
        document.getElementById("kpi-aisc").innerText = "$" + adjustedAisc;

        // --- KPI 4: Year-End Production Target Attainment ---
        // Calculate from actual tactical scores vs target threshold
        const scoredMines = mines.map(m => ({ ...m, tactical_score: calculateTacticalScore(m) }));
        const onTargetCount = scoredMines.filter(m => m.tactical_score >= 60).length;
        const attainmentRate = Math.round((onTargetCount / mines.length) * 100);
        // Scenario impact: higher prices improve margins → more mines hit targets
        const scenarioBoost = changePercent > 0 ? Math.min(changePercent * 0.3, 5) : Math.max(changePercent * 0.2, -10);
        const finalTarget = Math.min(100, Math.max(0, attainmentRate + scenarioBoost));
        document.getElementById("kpi-reserve").innerText = "%" + Math.round(finalTarget);

    } catch (err) { console.error("KPI Error:", err); }
}

// ============================================================
// 11. İYİLEŞTİRME FIRSATLARI LİSTESİ
// ============================================================
async function loadInvestmentList() {
    const pc = priceSlider.value;
    const ul = document.getElementById("investmentList");
    if(ul) ul.innerHTML = "<li class='text-gray-500'>Fırsatlar Taranıyor...</li>";
    
    try {
        const res = await fetch(`${BACKEND_URL}/api/top-mines?priceChange=${pc}`);
        let mines = await res.json();
        
        mines = mines.map(m => ({ ...m, tactical_score: calculateTacticalScore(m) }));
        mines.sort((a, b) => a.tactical_score - b.tactical_score); 

        if(ul) {
            ul.innerHTML = "";
            mines.slice(0, 8).forEach((m, i) => {
                const li = document.createElement("li");
                li.className = "bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center hover:bg-gray-50 cursor-pointer transition transform hover:translate-x-1";
                
                li.innerHTML = `
                    <div class="flex items-center">
                        <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center font-bold text-red-500 mr-4 border border-red-200">!</div>
                        <div>
                            <h4 class="font-bold text-slate-800">${m.name}</h4>
                            <p class="text-xs text-slate-500">Maliyet Sapması Yüksek</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="px-2 py-1 text-xs font-bold rounded bg-red-100 text-red-700">${m.tactical_score} Puan</span>
                        <div class="text-[10px] text-gray-400 uppercase mt-1">Verimlilik</div>
                    </div>
                `;
                li.addEventListener("click", () => openMineDetail(m.id));
                ul.appendChild(li);
            });
        }
    } catch (err) {}
}

// ============================================================
// 12. TAKTİKSEL ANALİZLER (CHART.JS)
// ============================================================

async function runAnalysis(type) {
    if(analysisResultArea) analysisResultArea.classList.remove("hidden");
    
    if (analysisChartInstance) {
        analysisChartInstance.destroy();
    }

    const canvas = document.getElementById("analysisChart");
    if(!canvas) return;
    const ctx = canvas.getContext("2d");
    const pc = priceSlider.value; 

    if (type === 'tornado') {
        analysisTitle.textContent = "Bütçe Sapma Analizi (Budget Variance)";
        
        try {
            const res = await fetch(`${BACKEND_URL}/api/analysis/tornado`);
            const data = await res.json();
            
            const labels = data.map(d => d.name);
            const variances = data.map(d => d.value);
            const backgroundColors = variances.map(v => v > 0 ? '#ef4444' : '#10b981');

            analysisChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Maliyet Sapması ($)',
                        data: variances, 
                        backgroundColor: backgroundColors, 
                        borderRadius: 5
                    }]
                },
                options: {
                    indexAxis: 'y', 
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let val = context.raw;
                                    let status = val > 0 ? "Bütçe Aşımı" : "Tasarruf";
                                    return `${status}: ${formatMoney(Math.abs(val))}`;
                                }
                            }
                        }
                    }
                }
            });
        } catch (e) {
            console.error("Error loading variance data", e);
        }
    }

    else if (type === 'breakeven') {
        analysisTitle.textContent = "Aylık Başa Baş Noktası";
        try {
            const res = await fetch(`${BACKEND_URL}/api/analysis/breakeven`);
            const data = await res.json();
            
            const fixedCost = parseFloat(data.fixed_cost) || 0;
            const variableCost = parseFloat(data.variable_cost) || 0;
            const totalRevenue = parseFloat(data.total_revenue) || 0;
            const totalCost = fixedCost + variableCost;
            const isProfitable = totalRevenue > totalCost;
            
            analysisChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Sabit Giderler', 'Değişken Giderler', 'Mevcut Gelir'],
                    datasets: [{
                        label: 'USD',
                        data: [fixedCost, variableCost, totalRevenue],
                        backgroundColor: ['#64748b', '#94a3b8', isProfitable ? '#10b981' : '#ef4444'], 
                        borderRadius: 10,
                        barThickness: 60
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, ticks: { callback: (v) => '$' + (v/1000000).toFixed(1) + 'M' } } },
                    plugins: { 
                        title: { display: true, text: isProfitable ? '✅ Kârlılık Bölgesindeyiz (Gelir > Gider)' : '⚠️ Zarar Bölgesindeyiz (Gider > Gelir)', font: { size: 14 } },
                        tooltip: { callbacks: { label: (ctx) => '$' + (ctx.raw / 1000000).toFixed(2) + 'M' } }
                    }
                }
            });
        } catch (e) { console.error('Breakeven error', e); }
    }

    else if (type === 'montecarlo') {
        analysisTitle.textContent = "Üretim Tahmini (Q1-Q3 Ort. → Q4)";
        try {
            const res = await fetch(`${BACKEND_URL}/api/analysis/montecarlo`);
            const data = await res.json();
            
            // Forecast logic: take average of first 9 months and project last 3
            const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim (Tahmin)', 'Kasım (Tahmin)', 'Aralık (Tahmin)'];
            const actual = [];
            const forecast = [];
            
            let sumProd = 0;
            let count = 0;
            
            data.forEach((d, i) => {
                if (i < 9) {
                    actual.push(parseFloat(d.prod));
                    forecast.push(null);
                    sumProd += parseFloat(d.prod);
                    count++;
                }
            });
            
            const avg = sumProd / count;
            
            // Last point of actual connects to first point of forecast
            forecast[8] = actual[8];
            forecast.push(avg * 0.95); // Minor decay simulation
            forecast.push(avg * 0.90);
            forecast.push(avg * 1.05); // End of year rush

            analysisChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [
                        {
                            label: 'Gerçekleşen (kg)',
                            data: actual,
                            borderColor: '#3b82f6', 
                            borderWidth: 3,
                            tension: 0.3
                        },
                        {
                            label: 'Tahmin (kg)',
                            data: forecast,
                            borderColor: '#eab308', 
                            borderDash: [5, 5],
                            borderWidth: 3,
                            tension: 0.3
                        }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        } catch (e) {}
    }

    else if (type === 'benchmark') {
        analysisTitle.textContent = "Verimlilik Kıyaslama";
        try {
            const res = await fetch(`${BACKEND_URL}/api/top-mines?priceChange=${pc}`);
            const mines = await res.json();
            const scatterData = mines.map(m => ({
                x: m.env_risk_level,
                y: calculateTacticalScore(m), 
                r: (parseFloat(m.reserve_ton) / 50000) + 5,
                mineName: m.name 
            }));

            analysisChartInstance = new Chart(ctx, {
                type: 'bubble',
                data: {
                    datasets: [{
                        label: 'Madenler',
                        data: scatterData,
                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                        borderColor: '#2563eb'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { title: { display: true, text: 'Operasyonel Risk (1-5)' }, min: 0, max: 6 },
                        y: { title: { display: true, text: 'Verimlilik Puanı (0-100)' } }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.raw.mineName + ` (Risk: ${context.raw.x}, Puan: ${context.raw.y})`;
                                }
                            }
                        }
                    }
                }
            });

        } catch (err) { console.error("Benchmark hatası:", err); }
    }
    
    if(analysisResultArea) analysisResultArea.scrollIntoView({ behavior: 'smooth' });
}

const btnTornado = document.getElementById("btn-analysis-tornado");
if(btnTornado) btnTornado.addEventListener("click", () => runAnalysis('tornado'));

const btnBreak = document.getElementById("btn-analysis-breakeven");
if(btnBreak) btnBreak.addEventListener("click", () => runAnalysis('breakeven'));

const btnMonte = document.getElementById("btn-analysis-montecarlo");
if(btnMonte) btnMonte.addEventListener("click", () => runAnalysis('montecarlo'));

const btnBench = document.getElementById("btn-analysis-benchmark");
if(btnBench) btnBench.addEventListener("click", () => runAnalysis('benchmark'));


// ============================================================
// 13. DETAY PANELİ
// ============================================================

async function openMineDetail(mineId) {
    if(!detailPanel) return;
    detailPanel.classList.remove("translate-x-full");
    
    try {
        const res = await fetch(`${BACKEND_URL}/api/mine-detail/${mineId}`);
        const data = await res.json(); 

        document.getElementById("detailMineName").textContent = data.name;
        document.getElementById("detailRegion").textContent = data.region;
        document.getElementById("detailRisk").textContent = (data.env_risk_level || data.envRiskLevel) + "/5";
        
        const score = calculateTacticalScore(data);
        document.getElementById("detailRoi").textContent = `${score}/100`;
        
        // Show mine-specific financial values
        if (data.metrics && data.metrics.length > 0) {
            const totalProd = data.metrics.reduce((s, m) => s + (m.production_kg || m.production || 0), 0);
            const totalRev = data.metrics.reduce((s, m) => s + (m.revenue_usd || m.revenue || 0), 0);
            const avgCost = data.metrics.reduce((s, m) => s + (m.cost_usd || m.cost || 0), 0) / data.metrics.length;
            const aisc = parseFloat(data.aisc_usd_oz || data.aiscUsdOz || 0);
            
            document.getElementById("detailCapex").innerHTML = `
                <div class="text-lg font-bold">$${aisc.toFixed(0)}/oz</div>
                <div class="text-[10px] text-gray-400 mt-1">AISC</div>
            `;
            
            // Update the ROI box to show production total
            document.getElementById("detailRoi").innerHTML = `
                <div>${score}/100</div>
                <div class="text-[10px] text-gray-400 font-normal mt-1">${totalProd.toFixed(1)} kg üretim</div>
            `;
        } else {
            const capex = (parseFloat(data.capex_required_usd || data.capexRequired || 0) / 1000000).toFixed(1);
            document.getElementById("detailCapex").textContent = `$${capex}M`;
        }

        if(data.metrics) {
            renderDetailCharts(data);
        }
        
        // Fetch and Render YoY Chart (Step 4)
        const yoyRes = await fetch(`${BACKEND_URL}/api/mines/${mineId}/yoy`);
        const yoyData = await yoyRes.json();
        renderDetailYoyChart(yoyData);

        renderDetailMap(data.latitude, data.longitude);

    } catch (err) { console.error("Detay Hatası:", err); }
}

// [DÜZELTME 2]: Veri okuma ve Scale (eksen) ayarları düzeltildi.
function renderDetailCharts(data) {
    const metrics = data.metrics || []; 
    const months = metrics.map(m => m.month);
    
    // Verileri sayıya çevirerek güvenli hale getirdik (parseFloat)
    const prod = metrics.map(m => parseFloat(m.production_kg || m.production || 0));
    
    // Kâr = Gelir - Maliyet
    const profit = metrics.map(m => (parseFloat(m.revenue_usd || m.revenue || 0) - parseFloat(m.cost_usd || m.cost || 0)));

    const averageProd = prod.reduce((a, b) => a + b, 0) / (prod.length || 1);
    const targetProd = prod.map(p => averageProd * 1.05); // DSS Target: 5% above historical average

    const ctx1 = document.getElementById("detailProductionChart").getContext("2d");
    if (chartProdInstance) chartProdInstance.destroy();
    
    chartProdInstance = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Aylık Bütçelenen Hedef',
                    data: targetProd,
                    borderColor: '#94a3b8',
                    borderDash: [5, 5], // Dashed line for target
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    tension: 0
                },
                {
                    label: 'Üretim (kg)',
                    data: prod,
                    borderColor: '#d97706',
                    backgroundColor: 'rgba(217, 119, 6, 0.1)',
                    fill: true,
                    borderWidth: 2,
                    tension: 0.3 // Çizgiyi yumuşatır
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                x: { 
                    ticks: { display: true, font: { size: 10 } }, // Ayları göster
                    grid: { display: false } 
                }, 
                y: { 
                    beginAtZero: true,
                    ticks: { display: true, font: { size: 10 } }, // Değerleri göster
                    grid: { color: '#f1f5f9' } // Hafif bir grid çizgisi
                } 
            } 
        }
    });

    const ctx2 = document.getElementById("detailProfitChart").getContext("2d");
    if (chartProfitInstance) chartProfitInstance.destroy();
    
    chartProfitInstance = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Nakit Akışı ($)',
                data: profit,
                backgroundColor: profit.map(p => p > 0 ? '#10B981' : '#EF4444'),
                borderRadius: 4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                x: { 
                    ticks: { display: true, font: { size: 10 } }, 
                    grid: { display: false } 
                }, 
                y: { 
                    ticks: { display: true, font: { size: 10 } },
                    grid: { color: '#f1f5f9' } 
                } 
            } 
        }
    });
}

// Step 4: Render YoY Chart using quarterly data
function renderDetailYoyChart(yoyData) {
    if (!yoyData || yoyData.length === 0) return;
    
    // Group data by Quarter
    const currentYear = Math.max(...yoyData.map(d => parseInt(d.year)));
    const previousYear = currentYear - 1;
    
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const currentYearCost = [];
    const previousYearCost = [];
    
    quarters.forEach(q => {
        const curr = yoyData.find(d => d.year == currentYear && d.quarter == q);
        const prev = yoyData.find(d => d.year == previousYear && d.quarter == q);
        
        // Show Total Cost comparison
        currentYearCost.push(curr ? parseFloat(curr.total_cost) : 0);
        previousYearCost.push(prev ? parseFloat(prev.total_cost) : 0);
    });
    
    const ctx = document.getElementById("detailYoyChart");
    if (!ctx) return;
    
    if (detailYoyChartInstance) detailYoyChartInstance.destroy();
    
    detailYoyChartInstance = new Chart(ctx.getContext("2d"), {
        type: 'bar',
        data: {
            labels: quarters,
            datasets: [
                {
                    label: `${previousYear} Gider ($)`,
                    data: previousYearCost,
                    backgroundColor: '#cbd5e1', // Gray for previous year
                    borderRadius: 4
                },
                {
                    label: `${currentYear} Gider ($)`,
                    data: currentYearCost,
                    backgroundColor: '#eab308', // Gold for current year
                    borderRadius: 4
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                tooltip: { mode: 'index', intersect: false }
            },
            scales: { 
                x: { grid: { display: false } }, 
                y: { grid: { color: '#f1f5f9' } } 
            } 
        }
    });
}

function renderDetailMap(lat, lon) {
    if (!lat || !lon) return;

    if (detailMapInstance) {
        detailMapInstance.remove();
        detailMapInstance = null;
    }

    const container = document.getElementById("detailMap");
    if(container) container.style.height = "250px"; 

    setTimeout(() => {
        detailMapInstance = L.map("detailMap", { 
            zoomControl: false,
            attributionControl: false 
        }).setView([lat, lon], 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(detailMapInstance);

        L.marker([lat, lon]).addTo(detailMapInstance);
        
        detailMapInstance.invalidateSize();
        
    }, 350); 
}

if(closeDetailBtn) {
    closeDetailBtn.addEventListener("click", () => {
        detailPanel.classList.add("translate-x-full");
    });
}

document.addEventListener('mine-selected', (e) => {
    openMineDetail(e.detail);
});

// Başlangıç Yüklemesi
window.addEventListener("DOMContentLoaded", () => {
    renderMap();
    loadStrategicKPIs();
    loadAlerts();
});