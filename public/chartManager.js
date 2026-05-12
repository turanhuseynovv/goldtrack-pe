// === GoldTrack PE - Premium Chart Manager ===
// Profesyonel Peru finans temalı grafik düzeni

const BACKEND_URL = "http://localhost:3000";

async function fetchMetrics(period = "6m") {
  const res = await fetch(`${BACKEND_URL}/api/metrics?period=${period}`);
  return await res.json();
}

/* -----------------------------------------------------
   🎨 Premium Grafik Teması
------------------------------------------------------*/
const chartTheme = {
  barBackground: "rgba(177, 0, 36, 0.55)",
  barBorder: "#B10024",
  lineBorder: "#005FB3",
  lineBackground: "rgba(0, 95, 179, 0.10)",
  pointColor: "#005FB3",
  gridColor: "rgba(0,0,0,0.05)",
  textColor: "#333",
  titleFont: { size: 18, weight: "600" },
  legendFont: { size: 14 }
};

/* -----------------------------------------------------
   6 AYLIK GRAFİK
------------------------------------------------------*/
export async function renderSixMonthChart() {
  const ctx = document.getElementById("chartSixMonth").getContext("2d");

  // ESKİ GRAFİĞİ DOĞRU ŞEKİLDE YOK ET
  const existing = Chart.getChart(ctx.canvas);
  if (existing) existing.destroy();

  const data = await fetchMetrics("6m");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.months,
      datasets: [
        {
          label: "Üretim (kg)",
          data: data.production,
          backgroundColor: chartTheme.barBackground,
          borderColor: chartTheme.barBorder,
          borderWidth: 2,
          yAxisID: "y",
        },
        {
          label: "Net Kâr (bin $)",
          data: data.profit,
          type: "line",
          borderColor: chartTheme.lineBorder,
          backgroundColor: chartTheme.lineBackground,
          pointBackgroundColor: chartTheme.pointColor,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 5,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: chartTheme.textColor, font: chartTheme.legendFont },
        },
        title: {
          display: true,
          text: "6 Aylık Üretim ve Kârlılık Trendi",
          color: chartTheme.textColor,
          font: chartTheme.titleFont,
        },
      },
      scales: {
        x: { ticks: { color: chartTheme.textColor }, grid: { color: chartTheme.gridColor } },
        y: {
          beginAtZero: true,
          ticks: { color: chartTheme.textColor },
          grid: { color: chartTheme.gridColor },
        },
        y1: {
          position: "right",
          ticks: { color: chartTheme.textColor },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}

/* -----------------------------------------------------
   1 YILLIK GRAFİK
------------------------------------------------------*/
export async function renderOneYearChart() {
  const ctx = document.getElementById("chartOneYear").getContext("2d");

  // DOĞRU DESTROY
  const existing = Chart.getChart(ctx.canvas);
  if (existing) existing.destroy();

  const data = await fetchMetrics("1y");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.months,
      datasets: [
        {
          label: "Üretim (kg)",
          data: data.production,
          backgroundColor: chartTheme.barBackground,
          borderColor: chartTheme.barBorder,
          borderWidth: 2,
          yAxisID: "y",
        },
        {
          label: "Net Kâr (bin $)",
          data: data.profit,
          type: "line",
          borderColor: chartTheme.lineBorder,
          backgroundColor: chartTheme.lineBackground,
          pointBackgroundColor: chartTheme.pointColor,
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 5,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: chartTheme.textColor, font: chartTheme.legendFont },
        },
        title: {
          display: true,
          text: "1 Yıllık Üretim ve Kârlılık Trendi",
          color: chartTheme.textColor,
          font: chartTheme.titleFont,
        },
      },
      scales: {
        x: { ticks: { color: chartTheme.textColor }, grid: { color: chartTheme.gridColor } },
        y: {
          beginAtZero: true,
          ticks: { color: chartTheme.textColor },
          grid: { color: chartTheme.gridColor },
        },
        y1: {
          position: "right",
          ticks: { color: chartTheme.textColor },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}
