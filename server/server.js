// =============================================================
// GoldTrack PE — Tactical Decision Support System API
// =============================================================
// Version: 3.2 (Production)
// Purpose: Provides RESTful endpoints for the DSS dashboard.
//          Serves mine data, financial KPIs, scenario analysis,
//          and cost breakdowns for 6–12 month tactical planning.
// =============================================================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import { query, initializeDatabase } from "./data/db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend static files
app.use(express.static(join(__dirname, "..", "public")));

const PORT = process.env.PORT || 3000;

// =============================================================
// UTILITY FUNCTIONS
// =============================================================

/**
 * Apply a price-change scenario to revenue.
 * The scenario simulates gold price fluctuations affecting revenue
 * while keeping operational costs (OPEX) fixed — which is how
 * real mining economics work (costs are largely independent of
 * commodity price).
 */
function calculateProfitWithScenario(revenue, cost, priceChange) {
    const factor = 1 + priceChange / 100;
    return revenue * factor - cost;
}

/**
 * Format monetary values with appropriate suffixes.
 */
function formatMoney(amount) {
    if (Math.abs(amount) >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
    if (Math.abs(amount) >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
    if (Math.abs(amount) >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
}

// =============================================================
// DATABASE SEEDING
// =============================================================
// Generates 24 months of synthetic production/financial metrics
// for each mine using a deterministic mathematical model.
// Only runs when mine_metrics table is empty.
// =============================================================

async function seedDatabaseIfEmpty() {
    try {
        const check = await query(
            "SELECT COUNT(*) as count FROM mine_metrics"
        );
        if (check[0].count > 0) {
            console.log("✅ Financial metrics data already exists.");
            return;
        }

        console.log("🌱 mine_metrics is empty — generating production data...");

        const mines = await query(
            "SELECT id, reserve_ton, gold_grade_gpt, aisc_usd_oz, capex_required_usd FROM mines"
        );

        for (const mine of mines) {
            let totalProfit = 0;
            const reserve = parseFloat(mine.reserve_ton);
            const grade = parseFloat(mine.gold_grade_gpt);
            const aisc = parseFloat(mine.aisc_usd_oz);
            const capex = parseFloat(mine.capex_required_usd);

            // Generate 24 months of data
            for (let i = 0; i < 24; i++) {
                const date = new Date();
                date.setMonth(date.getMonth() - (23 - i));

                const year = date.getFullYear();
                const month = date.getMonth() + 1;

                const quarter = Math.ceil(month / 3);
                
                // DSS Expert Update: Realistic production model
                // 1. Phase Shift: Every mine has a different seasonal cycle
                const phaseShift = mine.id * 0.7; 
                const seasonalFactor = 1 + Math.sin(i + phaseShift) / 10;
                
                // 2. Volatility (Noise): Random fluctuations (±12%)
                const volatility = 1 + (Math.random() * 0.24 - 0.12);
                
                // 3. Anomaly Events: 5% chance of a major breakdown/weather delay causing production drop
                let anomalyFactor = 1;
                if (Math.random() < 0.05) {
                    anomalyFactor = 0.6 + Math.random() * 0.2; // Drops production to 60-80%
                }

                const monthlyProdOz =
                    (reserve / 300) * (grade / 31.1035) * seasonalFactor * volatility * anomalyFactor;
                const monthlyProdKg = (monthlyProdOz * 31.1035) / 1000;

                // Gold price simulation (base + cyclical + trend + market noise)
                const priceNoise = Math.random() * 60 - 30;
                const goldPrice = 1900 + Math.cos(i) * 80 + i * 2 + priceNoise;

                const revenue = monthlyProdOz * goldPrice;
                const totalCost = monthlyProdOz * aisc;
                
                // Split total cost into cost centers with monthly variance
                const c_exp = totalCost * (0.05 + (Math.random() * 0.02 - 0.01)); // Exploration ~5%
                const c_ext = totalCost * (0.35 + (Math.random() * 0.04 - 0.02)); // Extraction ~35%
                const c_pro = totalCost * (0.30 + (Math.random() * 0.04 - 0.02)); // Processing ~30%
                const c_log = totalCost * (0.15 + (Math.random() * 0.06 - 0.03)); // Logistics ~15%
                const c_adm = totalCost - (c_exp + c_ext + c_pro + c_log);        // Admin & Tax (remainder)

                await query(
                    `INSERT INTO mine_metrics 
                    (mine_id, year, quarter, month, production_kg, revenue_usd, 
                     cost_exploration, cost_extraction, cost_processing, cost_logistics, cost_admin) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [mine.id, year, quarter, month, monthlyProdKg, revenue, c_exp, c_ext, c_pro, c_log, c_adm]
                );

                // Accumulate last 12 months for ROI calculation
                if (i >= 12) totalProfit += revenue - totalCost;
            }

            // Calculate and persist ROI
            const roi = capex > 0 ? (totalProfit / capex) * 100 : 0;
            await query(
                "UPDATE mines SET estimated_roi_percent = ? WHERE id = ?",
                [roi.toFixed(2), mine.id]
            );
        }

        console.log("✅ Metric data generation complete.");
    } catch (e) {
        console.error("Seeding error:", e);
    }
}

// =============================================================
// API ENDPOINTS
// =============================================================

// ----- 1. Financial KPI Cards -----
// Returns aggregated revenue, cost, profit, margin, and growth
// for the selected period with scenario adjustments.

app.get("/api/financial/kpi", async (req, res) => {
    const period = req.query.period || "1y";
    const priceChange = parseFloat(req.query.priceChange) || 0;

    try {
        let limit = 12;
        if (period === "6m") limit = 6;
        if (period === "all") limit = 24;

        const metrics = await query(`
            SELECT year, month,
                   SUM(revenue_usd) as total_revenue,
                   SUM(cost_usd)    as total_cost
            FROM mine_metrics
            GROUP BY year, month
            ORDER BY year ASC, month ASC
        `);

        const currentPeriodData = metrics.slice(-limit);
        const factor = 1 + priceChange / 100;

        let totalRevenue = 0;
        let totalCost = 0;

        currentPeriodData.forEach((m) => {
            totalRevenue += parseFloat(m.total_revenue) * factor;
            totalCost += parseFloat(m.total_cost);
        });

        const netProfit = totalRevenue - totalCost;
        const profitMargin =
            totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // --- Growth Rate (month-over-month, scenario-adjusted) ---
        // FIX: Compare base revenues first, THEN apply scenario.
        // This prevents the factor from cancelling itself out.
        const lastMonth = metrics[metrics.length - 1];
        const prevMonth = metrics[metrics.length - 2];
        let growthRate = 0;

        if (lastMonth && prevMonth) {
            const lastRevBase = parseFloat(lastMonth.total_revenue);
            const prevRevBase = parseFloat(prevMonth.total_revenue);

            // Growth is an intrinsic metric — the scenario shifts
            // both months equally, so we calculate base growth first
            // and then report it. The scenario affects absolute values
            // but not the growth *rate*.
            if (prevRevBase > 0) {
                growthRate =
                    ((lastRevBase - prevRevBase) / prevRevBase) * 100;
            }
        }

        res.json({
            revenue: totalRevenue,
            expense: totalCost,
            profit: netProfit,
            margin: profitMargin.toFixed(2),
            growthRate: growthRate.toFixed(2),
            period
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----- 2. Financial History (Time-Series for Charts) -----

app.get("/api/financial/history", async (req, res) => {
    const period = req.query.period || "1y";
    const priceChange = parseFloat(req.query.priceChange) || 0;
    const limit = period === "6m" ? 6 : period === "all" ? 24 : 12;

    try {
        const metrics = await query(`
            SELECT year, month,
                   SUM(revenue_usd) as rev,
                   SUM(cost_usd)    as cost
            FROM mine_metrics
            GROUP BY year, month
            ORDER BY year ASC, month ASC
        `);

        const filtered = metrics.slice(-limit);
        const factor = 1 + priceChange / 100;

        const chartData = filtered.map((m) => {
            const actualRevenue = parseFloat(m.rev) * factor;
            const cost = parseFloat(m.cost);

            return {
                name: `${m.month}/${m.year}`,
                Gelir: actualRevenue,
                Gider: cost,
                NetKar: actualRevenue - cost,
                Marj:
                    actualRevenue > 0
                        ? ((actualRevenue - cost) / actualRevenue) * 100
                        : 0
            };
        });

        res.json(chartData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----- 3. Cost Breakdown (Donut Chart) -----
// Uses industry-standard OPEX distribution ratios for
// gold mining operations (source: World Gold Council benchmarks).

app.get("/api/financial/cost-breakdown", async (req, res) => {
    const period = req.query.period || "1y";
    let limit = 12;
    if (period === "6m") limit = 6;
    if (period === "all") limit = 24;

    try {
        const metrics = await query(`
            SELECT 
                year, month,
                SUM(cost_exploration) as c_exp,
                SUM(cost_extraction) as c_ext,
                SUM(cost_processing) as c_pro,
                SUM(cost_logistics) as c_log,
                SUM(cost_admin) as c_adm,
                SUM(cost_usd) as total_cost
            FROM mine_metrics
            GROUP BY year, month
            ORDER BY year ASC, month ASC
        `);

        const filtered = metrics.slice(-limit);
        const totals = filtered.reduce((acc, curr) => {
            acc.c_exp += parseFloat(curr.c_exp);
            acc.c_ext += parseFloat(curr.c_ext);
            acc.c_pro += parseFloat(curr.c_pro);
            acc.c_log += parseFloat(curr.c_log);
            acc.c_adm += parseFloat(curr.c_adm);
            acc.total += parseFloat(curr.total_cost);
            return acc;
        }, { c_exp: 0, c_ext: 0, c_pro: 0, c_log: 0, c_adm: 0, total: 0 });

        if (totals.total === 0) return res.json([]);

        const breakdown = [
            {
                name: `Çıkarma (${formatMoney(totals.c_ext)})`,
                value: Math.round(totals.c_ext),
                color: "#0088FE"
            },
            {
                name: `İşleme (${formatMoney(totals.c_pro)})`,
                value: Math.round(totals.c_pro),
                color: "#00C49F"
            },
            {
                name: `Lojistik (${formatMoney(totals.c_log)})`,
                value: Math.round(totals.c_log),
                color: "#FFBB28"
            },
            {
                name: `Arama (${formatMoney(totals.c_exp)})`,
                value: Math.round(totals.c_exp),
                color: "#FF8042"
            },
            {
                name: `İdari (${formatMoney(totals.c_adm)})`,
                value: Math.round(totals.c_adm),
                color: "#8884d8"
            }
        ];

        res.json(breakdown);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----- 4. Mine Detail (Single Mine + 12-Month Metrics) -----

app.get("/api/mine-detail/:id", async (req, res) => {
    const mineId = parseInt(req.params.id);
    const priceChange = parseFloat(req.query.priceChange) || 0;

    try {
        const sql = `
            SELECT m.*, c.name as company_name, r.name as region_name
            FROM mines m
            LEFT JOIN companies c ON m.company_id = c.id
            LEFT JOIN regions r ON m.region_id = r.id
            WHERE m.id = ?
        `;

        const minesFromDB = await query(sql, [mineId]);
        if (minesFromDB.length === 0)
            return res.status(404).json({ error: "Mine not found" });

        const mine = minesFromDB[0];

        // Fetch monthly metrics with cost breakdowns
        const metrics = await query(
            `
            SELECT year, month, production_kg, revenue_usd, cost_usd,
                   cost_exploration, cost_extraction, cost_processing, cost_logistics, cost_admin
            FROM mine_metrics
            WHERE mine_id = ?
            ORDER BY year ASC, month ASC
            LIMIT 24
        `,
            [mineId]
        );

        const last12Months = metrics.slice(-12);
        const metricsFormatted = last12Months.map((m) => ({
            month: `${m.month}/${m.year}`,
            production: parseFloat(m.production_kg),
            production_kg: parseFloat(m.production_kg),
            revenue: calculateProfitWithScenario(
                parseFloat(m.revenue_usd),
                0,
                priceChange
            ),
            revenue_usd: parseFloat(m.revenue_usd),
            cost: parseFloat(m.cost_usd),
            cost_usd: parseFloat(m.cost_usd),
            cost_exploration: parseFloat(m.cost_exploration),
            cost_extraction: parseFloat(m.cost_extraction),
            cost_processing: parseFloat(m.cost_processing),
            cost_logistics: parseFloat(m.cost_logistics),
            cost_admin: parseFloat(m.cost_admin)
        }));

        // FIX: ROI simulation uses multiplicative scaling
        // instead of additive — ensures proportional impact
        let simulatedRoi = parseFloat(mine.estimated_roi_percent || 0);
        const factor = 1 + priceChange / 100;
        simulatedRoi = simulatedRoi * factor;

        const detail = {
            ...mine,
            company: mine.company_name,
            region: mine.region_name,
            latitude: parseFloat(mine.latitude),
            longitude: parseFloat(mine.longitude),
            reserveTon: parseFloat(mine.reserve_ton),
            goldGradeGt: parseFloat(mine.gold_grade_gpt),
            capexRequired: parseFloat(mine.capex_required_usd),
            estimatedRoi: simulatedRoi.toFixed(2),
            aiscUsdOz: parseFloat(mine.aisc_usd_oz),
            metrics: metricsFormatted
        };

        res.json(detail);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ----- 5. All Mines (Portfolio Overview with Scenario) -----

app.get("/api/top-mines", async (req, res) => {
    const priceChange = parseFloat(req.query.priceChange) || 0;

    try {
        const sql = `
            SELECT m.*, c.name as company_name, r.name as region_name
            FROM mines m
            LEFT JOIN companies c ON m.company_id = c.id
            LEFT JOIN regions r ON m.region_id = r.id
        `;
        const minesDB = await query(sql);

        const enriched = minesDB.map((mine) => {
            // FIX: Multiplicative ROI adjustment (not additive)
            let roi = parseFloat(mine.estimated_roi_percent || 0);
            const factor = 1 + priceChange / 100;
            roi = roi * factor;

            return {
                ...mine,
                company: mine.company_name,
                region: mine.region_name,
                latitude: parseFloat(mine.latitude),
                longitude: parseFloat(mine.longitude),
                reserve_ton: parseFloat(mine.reserve_ton),
                capex_required_usd: parseFloat(mine.capex_required_usd),
                aisc_usd_oz: parseFloat(mine.aisc_usd_oz),
                estimated_roi_percent: roi.toFixed(2),
                score: roi
            };
        });

        // Sort by ROI descending (highest performing mines first)
        res.json(
            enriched.sort(
                (a, b) =>
                    parseFloat(b.estimated_roi_percent) -
                    parseFloat(a.estimated_roi_percent)
            )
        );
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================================
// 5. RULE-BASED ALERTING ENGINE (Prescriptive DSS)
// =============================================================
app.get("/api/alerts", async (req, res) => {
    try {
        const mines = await query("SELECT * FROM mines");
        const alerts = [];

        for (const mine of mines) {
            // Fetch last 3 months and same period last year for YoY
            const metrics = await query(
                `SELECT year, month, production_kg, revenue_usd, cost_usd, cost_logistics, cost_processing
                 FROM mine_metrics 
                 WHERE mine_id = ? 
                 ORDER BY year DESC, month DESC LIMIT 15`,
                 [mine.id]
            );

            if (metrics.length < 12) continue;

            const current = metrics[0];
            const lastYear = metrics[12]; // Same month last year
            
            // Baseline budgets (Normalized to Unit Cost)
            const prev3 = metrics.slice(1, 4);
            const sumProd = prev3.reduce((sum, m) => sum + parseFloat(m.production_kg), 0) || 1; // prevent div by zero
            
            const avgLogisticsUnitCost = prev3.reduce((sum, m) => sum + parseFloat(m.cost_logistics), 0) / sumProd;
            const avgTotalUnitCost = prev3.reduce((sum, m) => sum + parseFloat(m.cost_usd), 0) / sumProd;
            const avgProd = sumProd / 3;

            const currProd = parseFloat(current.production_kg) || 1;
            const currLogisticsUnitCost = parseFloat(current.cost_logistics) / currProd;
            const currTotalUnitCost = parseFloat(current.cost_usd) / currProd;
            
            const lastYearProd = parseFloat(lastYear.production_kg) || 1;
            const lastYearProcessingUnitCost = parseFloat(lastYear.cost_processing) / lastYearProd;
            const currProcessingUnitCost = parseFloat(current.cost_processing) / currProd;

            // K1: Logistics Unit Cost Overrun
            if (currLogisticsUnitCost > (avgLogisticsUnitCost * 1.15)) {
                alerts.push({
                    mineId: mine.id, mineName: mine.name, level: 'RED',
                    title: 'Lojistik Birim Maliyet Aşıldı',
                    message: "Ton başına lojistik maliyeti %15'ten fazla arttı. Kâr marjı tehlikede.",
                    action: 'Yakıt/Taşeron sözleşmelerini acil incelemeye alın.'
                });
            }

            // K2: Production Shortfall
            if (currProd < (avgProd * 0.80)) {
                alerts.push({
                    mineId: mine.id, mineName: mine.name, level: 'RED',
                    title: 'Üretim Hacmi Düşüşü',
                    message: 'Üretim hacmi hedefin %20 altında kaldı.',
                    action: 'Üretim raporunu talep edin, saha müdürüyle acil görüşün.'
                });
            }

            // K3: AISC Trend (Unit Cost trend instead of profit)
            const uc1 = parseFloat(metrics[0].cost_usd) / (parseFloat(metrics[0].production_kg) || 1);
            const uc2 = parseFloat(metrics[1].cost_usd) / (parseFloat(metrics[1].production_kg) || 1);
            const uc3 = parseFloat(metrics[2].cost_usd) / (parseFloat(metrics[2].production_kg) || 1);
            if (uc1 > uc2 && uc2 > uc3) {
                alerts.push({
                    mineId: mine.id, mineName: mine.name, level: 'YELLOW',
                    title: 'Birim Maliyet (AISC) Trendi Yükselişte',
                    message: 'Birim maliyet ardışık 3 aydır artış trendinde.',
                    action: 'Operasyonel gider (OPEX) artış kalemlerini analiz edin.'
                });
            }

            // K4: Energy (Processing proxy) YoY Increase (Unit Cost)
            if (currProcessingUnitCost > (lastYearProcessingUnitCost * 1.10)) {
                alerts.push({
                    mineId: mine.id, mineName: mine.name, level: 'YELLOW',
                    title: 'Enerji (İşleme) Birim Maliyet Artışı',
                    message: 'Ton başına enerji/işleme gideri geçen yılın aynı dönemine göre %10 arttı.',
                    action: 'Enerji verimliliği raporunu talep edin.'
                });
            }

            // K5: Budget Savings (Unit Cost)
            if (currTotalUnitCost < (avgTotalUnitCost * 0.95)) {
                alerts.push({
                    mineId: mine.id, mineName: mine.name, level: 'BLUE',
                    title: 'Birim Maliyet Tasarrufu',
                    message: 'Maden birim maliyet hedefinin %5 altında tasarruflu çalışıyor.',
                    action: 'Bütçe disiplini başarılı — tasarruf kaynağını bir sonraki planlama dönemine taşıyın.'
                });
            }

            // K6: Environmental Risk
            if (mine.env_risk_level === 5) {
                alerts.push({
                    mineId: mine.id, mineName: mine.name, level: 'RED',
                    title: 'Kritik Çevresel Risk',
                    message: 'Kritik çevresel risk seviyesi tespit edildi.',
                    action: 'Üretimi yavaşlatın, acil denetim ekibi yönlendirin.'
                });
            }
        }

        // Sort RED first, then YELLOW, then BLUE
        const order = { RED: 1, YELLOW: 2, BLUE: 3 };
        alerts.sort((a, b) => order[a.level] - order[b.level]);

        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================================
// 6. YoY & QUARTERLY ANALYSIS (Step 4)
// =============================================================
app.get("/api/mines/:id/yoy", async (req, res) => {
    try {
        const mineId = req.params.id;
        // Get quarterly sums for the selected mine
        const data = await query(`
            SELECT year, quarter, 
                   SUM(production_kg) as total_production,
                   SUM(revenue_usd) as total_revenue,
                   SUM(cost_usd) as total_cost,
                   SUM(cost_exploration) as cost_exploration,
                   SUM(cost_extraction) as cost_extraction,
                   SUM(cost_processing) as cost_processing,
                   SUM(cost_logistics) as cost_logistics,
                   SUM(cost_admin) as cost_admin
            FROM mine_metrics
            WHERE mine_id = ?
            GROUP BY year, quarter
            ORDER BY year DESC, quarter DESC
            LIMIT 8
        `, [mineId]);

        // To calculate YoY, we can simply return the grouped data to the frontend
        // and the frontend can plot Q1 2024 vs Q1 2023.
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================================
// 7. DECISION AUDIT TRAIL (Step 5 Feedback Loop)
// =============================================================
app.post("/api/decisions", async (req, res) => {
    try {
        const { mine_id, alert_level, trigger_reason, decision_text, action_category, success_metric, target_value } = req.body;
        
        // Take current snapshot for baseline
        const mine = await query("SELECT aisc_usd_oz, estimated_roi_percent FROM mines WHERE id = ?", [mine_id]);
        if (!mine.length) return res.status(404).json({ error: "Mine not found" });

        const snapshot_aisc = mine[0].aisc_usd_oz;
        const snapshot_roi = mine[0].estimated_roi_percent;

        const result = await query(`
            INSERT INTO decision_audit 
            (mine_id, alert_level, trigger_reason, decision_text, action_category, success_metric, target_value, snapshot_aisc, snapshot_roi)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            mine_id, alert_level, trigger_reason, decision_text, action_category, success_metric, 
            target_value, snapshot_aisc, snapshot_roi
        ]);

        res.json({ success: true, decision_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================================
// 8. TACTICAL ANALYSIS ENDPOINTS (Step 2 & 3)
// =============================================================
app.get("/api/analysis/:type", async (req, res) => {
    try {
        const type = req.params.type;
        
        if (type === 'tornado') {
            // Real budget variance analysis
            // Find the most recent year and quarter in the database
            const lastRecord = await query("SELECT year, quarter FROM mine_metrics ORDER BY year DESC, quarter DESC LIMIT 1");
            if (!lastRecord.length) return res.json([]);
            
            const currYear = lastRecord[0].year;
            const currQuarter = lastRecord[0].quarter;
            const prevYear = currYear - 1;

            const costData = await query(`
                SELECT 
                    SUM(cost_exploration) as expl,
                    SUM(cost_extraction) as extr,
                    SUM(cost_processing) as proc,
                    SUM(cost_logistics) as logi,
                    SUM(cost_admin) as adm
                FROM mine_metrics
                WHERE year = ? AND quarter = ?
            `, [currYear, currQuarter]);
            
            const prevCostData = await query(`
                SELECT 
                    SUM(cost_exploration) as expl,
                    SUM(cost_extraction) as extr,
                    SUM(cost_processing) as proc,
                    SUM(cost_logistics) as logi,
                    SUM(cost_admin) as adm
                FROM mine_metrics
                WHERE year = ? AND quarter = ?
            `, [prevYear, currQuarter]);
            
            if (!costData.length || !prevCostData.length) return res.json([]);
            
            const curr = costData[0];
            const prev = prevCostData[0];
            
            // Variance = Current - Previous (Positive means Over budget/Bad)
            const result = [
                { name: "Arama (Exploration)", value: curr.expl - prev.expl },
                { name: "Kazı (Extraction)", value: curr.extr - prev.extr },
                { name: "İşleme (Processing)", value: curr.proc - prev.proc },
                { name: "Lojistik (Logistics)", value: curr.logi - prev.logi },
                { name: "Yönetim (Admin)", value: curr.adm - prev.adm }
            ];
            
            return res.json(result);
        }
        
        else if (type === 'breakeven') {
            const lastRecord = await query("SELECT year, month FROM mine_metrics ORDER BY year DESC, month DESC LIMIT 1");
            if (!lastRecord.length) return res.json({ fixed_cost: 0, variable_cost: 0, total_revenue: 0 });
            
            const currYear = lastRecord[0].year;
            const currMonth = lastRecord[0].month;

            // Basic breakeven: Fixed (Admin + 50% Exploration) vs Variable
            const data = await query(`
                SELECT 
                    SUM(cost_admin + cost_exploration * 0.5) as fixed_cost,
                    SUM(cost_extraction + cost_processing + cost_logistics + cost_exploration * 0.5) as variable_cost,
                    SUM(revenue_usd) as total_revenue
                FROM mine_metrics
                WHERE year = ? AND month = ?
            `, [currYear, currMonth]);
            return res.json(data[0] || { fixed_cost: 0, variable_cost: 0, total_revenue: 0 });
        }

        else if (type === 'montecarlo') {
            const lastRecord = await query("SELECT year FROM mine_metrics ORDER BY year DESC LIMIT 1");
            if (!lastRecord.length) return res.json([]);
            
            const prevYear = lastRecord[0].year - 1;

            // Forecast based on previous year's 12 months (since current year might not be full)
            const data = await query(`
                SELECT month, SUM(production_kg) as prod
                FROM mine_metrics
                WHERE year = ?
                GROUP BY month
                ORDER BY month ASC
            `, [prevYear]);
            return res.json(data);
        }

        res.status(400).json({ error: "Unknown analysis type" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================================
// 9. DECISION EVALUATION (Step 4 & 5)
// =============================================================
app.get("/api/decisions/evaluate", async (req, res) => {
    try {
        // Fetch all pending decisions
        const pending = await query("SELECT * FROM decision_audit WHERE resolution_status = 'PENDING'");
        const evaluations = [];

        for (const dec of pending) {
            // Get current metrics for this mine
            const mine = await query("SELECT aisc_usd_oz, estimated_roi_percent FROM mines WHERE id = ?", [dec.mine_id]);
            if (!mine.length) continue;

            let isSuccess = false;
            let metricName = "";
            let currentValue = 0;

            if (dec.success_metric === 'AISC') {
                currentValue = mine[0].aisc_usd_oz;
                isSuccess = currentValue <= dec.target_value;
                metricName = "AISC";
            } else if (dec.success_metric === 'ROI') {
                currentValue = mine[0].estimated_roi_percent;
                isSuccess = currentValue >= dec.target_value;
                metricName = "ROI";
            }

            // Update record
            const status = isSuccess ? 'SUCCESS' : 'FAILED';
            await query("UPDATE decision_audit SET resolution_status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?", [status, dec.id]);
            
            evaluations.push({
                decision_id: dec.id,
                mine_id: dec.mine_id,
                metric: metricName,
                target: dec.target_value,
                actual: currentValue,
                status: status
            });
        }

        // Return all resolved decisions for AI reporting
        const allResolved = await query("SELECT d.*, m.name as mineName FROM decision_audit d JOIN mines m ON d.mine_id = m.id WHERE d.resolution_status != 'PENDING' ORDER BY d.resolved_at DESC LIMIT 5");

        res.json({ newly_evaluated: evaluations.length, history: allResolved });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================================
// SERVER INITIALIZATION
// =============================================================

async function loadSchemaAndInitialize(pathsToTry) {
    for (const schemaPath of pathsToTry) {
        try {
            if (fs.existsSync(schemaPath)) {
                const schemaSqlContent = fs.readFileSync(schemaPath, "utf8");
                await initializeDatabase(schemaSqlContent);
                return true;
            }
        } catch (error) {
            console.error(`Schema load failed from ${schemaPath}:`, error.message);
        }
    }
    return false;
}

(async () => {
    console.log("⏳ Starting GoldTrack PE API...");

    const possiblePaths = [
        join(__dirname, "schema.sql"),
        join(__dirname, "..", "schema.sql"),
        join(__dirname, "data", "schema.sql")
    ];

    try {
        const loaded = await loadSchemaAndInitialize(possiblePaths);
        if (!loaded) {
            console.error("❌ Could not find schema.sql in any expected path.");
            process.exit(1);
        }

        await seedDatabaseIfEmpty();

        app.listen(PORT, () =>
            console.log(
                `✅ GoldTrack PE API running at http://localhost:${PORT}`
            )
        );
    } catch (err) {
        console.error("❌ Server startup failed:", err);
        process.exit(1);
    }
})();