-- ==========================================
-- GOLDTRACK PE — Relational Database Schema
-- Architecture: 3NF | Engine: InnoDB
-- ==========================================
-- Tables use IF NOT EXISTS so the schema can
-- run safely on every server startup without
-- destroying existing data.
-- ==========================================

-- 1. COMPANIES (Şirketler)
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. REGIONS (Bölgeler)
CREATE TABLE IF NOT EXISTS regions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    risk_factor DECIMAL(3,2) DEFAULT 1.0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. MINES (Madenler — Ana Tablo)
CREATE TABLE IF NOT EXISTS mines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,

    -- Relational Foreign Keys
    company_id INT,
    region_id INT,

    -- Geospatial
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),

    -- Operational Parameters
    reserve_ton DECIMAL(12,2),
    gold_grade_gpt DECIMAL(5,2),
    env_risk_level INT,

    -- Financial Parameters
    aisc_usd_oz DECIMAL(10,2) DEFAULT 1100.00,
    capex_required_usd DECIMAL(15,2) DEFAULT 50000000.00,
    estimated_roi_percent DECIMAL(5,2) DEFAULT 0.00,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_mines_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    CONSTRAINT fk_mines_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. MINE METRICS (Aylık Üretim & Finansal Veriler - Prescriptive DSS Upgrade)
CREATE TABLE IF NOT EXISTS mine_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mine_id INT NOT NULL,
    year INT NOT NULL,
    quarter INT NOT NULL, -- YoY and Quarter lookups
    month INT NOT NULL,
    production_kg DECIMAL(10,2),
    revenue_usd DECIMAL(15,2),
    
    -- Cost Centers (Maliyet Merkezleri)
    cost_exploration DECIMAL(15,2) DEFAULT 0.00,
    cost_extraction DECIMAL(15,2) DEFAULT 0.00,
    cost_processing DECIMAL(15,2) DEFAULT 0.00,
    cost_logistics DECIMAL(15,2) DEFAULT 0.00,
    cost_admin DECIMAL(15,2) DEFAULT 0.00,
    
    -- Total cost is now a generated column or just maintained by application
    cost_usd DECIMAL(15,2) AS (cost_exploration + cost_extraction + cost_processing + cost_logistics + cost_admin) STORED,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_metrics_mine FOREIGN KEY (mine_id) REFERENCES mines(id) ON DELETE CASCADE,
    INDEX idx_date (year, quarter, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. DECISION AUDIT TRAIL (Karar Günlüğü - 90 Days Feedback Loop)
CREATE TABLE IF NOT EXISTS decision_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mine_id INT NOT NULL,
    alert_level VARCHAR(10) DEFAULT 'YELLOW',
    trigger_reason TEXT,
    decision_text TEXT NOT NULL,
    action_category VARCHAR(50) DEFAULT 'OTHER',
    
    -- Snapshots (Karar anındaki veriler)
    snapshot_aisc DECIMAL(10,2),
    snapshot_roi DECIMAL(5,2),
    
    -- Success Criteria (Başarı Kriteri ve Takip)
    success_metric VARCHAR(50) NOT NULL DEFAULT 'AISC',
    target_value DECIMAL(10,2),
    
    -- Resolution (90 gün sonrası değerlendirme)
    resolution_status VARCHAR(20) DEFAULT 'PENDING',
    resolved_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_mine FOREIGN KEY (mine_id) REFERENCES mines(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- SEED DATA (INSERT IGNORE — idempotent)
-- ==========================================

-- A. Companies
INSERT IGNORE INTO companies (name) VALUES
('Newmont Mining'), ('Barrick Gold'), ('Pan American Silver'), ('Hochschild Mining'),
('Compañía Minera Aurífera'), ('Gold Fields'), ('Compañía de Minas Buenaventura'),
('Buenaventura'), ('Ares Mining'), ('Volcan Compañía Minera'), ('Southern Peaks Mining'),
('Compañía Minera La Virgen'), ('Anglo American'), ('Minsur'), ('Minera Andina'),
('Minera Aurifera'), ('CVN Mining'), ('Aruntani SAC'), ('Poderosa Mining'),
('IRL Ltd'), ('Silver Mountain'), ('Bear Creek Mining'), ('Southern Peaks'),
('Milpo'), ('Aruntani'), ('Sierra Metals');

-- B. Regions
INSERT IGNORE INTO regions (name) VALUES
('Cajamarca'), ('La Libertad'), ('Ayacucho'), ('Puno'), ('Pasco'),
('Moquegua'), ('Tacna'), ('Huancavelica'), ('Piura'), ('Arequipa'),
('Junin'), ('Lima'), ('Ica'), ('Ancash');

-- C. Mines (only insert if table is empty — checked by server.js seeder)
INSERT IGNORE INTO mines (name, company_id, region_id, latitude, longitude, reserve_ton, gold_grade_gpt, env_risk_level) VALUES
('Yanacocha', (SELECT id FROM companies WHERE name='Newmont Mining'), (SELECT id FROM regions WHERE name='Cajamarca'), -7.3500, -78.5000, 450000, 2.5, 3),
('Lagunas Norte', (SELECT id FROM companies WHERE name='Barrick Gold'), (SELECT id FROM regions WHERE name='La Libertad'), -7.2000, -78.2500, 380000, 2.3, 2),
('La Arena', (SELECT id FROM companies WHERE name='Pan American Silver'), (SELECT id FROM regions WHERE name='La Libertad'), -7.9500, -78.8000, 320000, 1.9, 3),
('Shahuindo', (SELECT id FROM companies WHERE name='Pan American Silver'), (SELECT id FROM regions WHERE name='Cajamarca'), -7.5000, -78.4500, 280000, 1.8, 3),
('Inmaculada', (SELECT id FROM companies WHERE name='Hochschild Mining'), (SELECT id FROM regions WHERE name='Ayacucho'), -14.0500, -74.1000, 220000, 2.1, 2),
('Parcoy', (SELECT id FROM companies WHERE name='Compañía Minera Aurífera'), (SELECT id FROM regions WHERE name='La Libertad'), -8.0500, -77.6500, 210000, 2.0, 4),
('Cerro Corona', (SELECT id FROM companies WHERE name='Gold Fields'), (SELECT id FROM regions WHERE name='Cajamarca'), -6.8500, -78.5500, 400000, 2.7, 2),
('La Zanja', (SELECT id FROM companies WHERE name='Compañía de Minas Buenaventura'), (SELECT id FROM regions WHERE name='Cajamarca'), -7.1500, -78.6500, 240000, 2.3, 3),
('Tantahuatay', (SELECT id FROM companies WHERE name='Buenaventura'), (SELECT id FROM regions WHERE name='Cajamarca'), -7.2000, -78.5500, 180000, 1.7, 3),
('Breapampa', (SELECT id FROM companies WHERE name='Ares Mining'), (SELECT id FROM regions WHERE name='Ayacucho'), -14.2000, -74.2000, 160000, 2.0, 2),
('Santa Rosa', (SELECT id FROM companies WHERE name='Compañía Minera Aurífera'), (SELECT id FROM regions WHERE name='Puno'), -15.0000, -70.0000, 190000, 2.1, 3),
('Cerro de Pasco', (SELECT id FROM companies WHERE name='Volcan Compañía Minera'), (SELECT id FROM regions WHERE name='Pasco'), -10.6800, -76.2600, 500000, 1.5, 4),
('Quiruvilca', (SELECT id FROM companies WHERE name='Southern Peaks Mining'), (SELECT id FROM regions WHERE name='La Libertad'), -8.0000, -78.2000, 150000, 1.6, 3),
('La Virgen', (SELECT id FROM companies WHERE name='Compañía Minera La Virgen'), (SELECT id FROM regions WHERE name='Puno'), -14.8500, -70.2000, 130000, 2.0, 4),
('Quellaveco', (SELECT id FROM companies WHERE name='Anglo American'), (SELECT id FROM regions WHERE name='Moquegua'), -17.2500, -70.8000, 600000, 1.2, 2),
('Pucamarca', (SELECT id FROM companies WHERE name='Minsur'), (SELECT id FROM regions WHERE name='Tacna'), -17.9000, -69.8000, 260000, 2.4, 2),
('Hualgayoc', (SELECT id FROM companies WHERE name='Buenaventura'), (SELECT id FROM regions WHERE name='Cajamarca'), -6.7600, -78.5700, 210000, 1.9, 3),
('Antapite', (SELECT id FROM companies WHERE name='Minera Andina'), (SELECT id FROM regions WHERE name='Huancavelica'), -12.7500, -74.9800, 175000, 2.2, 2),
('El Cofre', (SELECT id FROM companies WHERE name='Minera Aurifera'), (SELECT id FROM regions WHERE name='Piura'), -4.6700, -79.7000, 130000, 1.8, 2),
('Chapi', (SELECT id FROM companies WHERE name='CVN Mining'), (SELECT id FROM regions WHERE name='Arequipa'), -16.4200, -72.3500, 280000, 1.7, 3),
('Arasi', (SELECT id FROM companies WHERE name='Aruntani SAC'), (SELECT id FROM regions WHERE name='Puno'), -15.4400, -70.6200, 300000, 2.4, 4),
('Pataz', (SELECT id FROM companies WHERE name='Poderosa Mining'), (SELECT id FROM regions WHERE name='La Libertad'), -7.6200, -77.5200, 420000, 2.8, 3),
('Poderosa', (SELECT id FROM companies WHERE name='Poderosa Mining'), (SELECT id FROM regions WHERE name='La Libertad'), -7.6400, -77.5400, 410000, 2.7, 3),
('Ollachea', (SELECT id FROM companies WHERE name='IRL Ltd'), (SELECT id FROM regions WHERE name='Puno'), -13.9000, -70.5200, 350000, 2.5, 2),
('Tambomayo', (SELECT id FROM companies WHERE name='Buenaventura'), (SELECT id FROM regions WHERE name='Arequipa'), -15.4500, -71.1000, 340000, 2.3, 3),
('Shila-Paula', (SELECT id FROM companies WHERE name='Buenaventura'), (SELECT id FROM regions WHERE name='Arequipa'), -15.2400, -71.0500, 180000, 1.9, 3),
('Selene', (SELECT id FROM companies WHERE name='Hochschild Mining'), (SELECT id FROM regions WHERE name='Ayacucho'), -14.2100, -74.1500, 200000, 2.2, 2),
('Pucayacu', (SELECT id FROM companies WHERE name='Hochschild Mining'), (SELECT id FROM regions WHERE name='Ayacucho'), -14.1500, -74.1200, 160000, 2.5, 2),
('Ventana', (SELECT id FROM companies WHERE name='Silver Mountain'), (SELECT id FROM regions WHERE name='Junin'), -11.9700, -75.2600, 210000, 2.1, 3),
('San Rafael', (SELECT id FROM companies WHERE name='Minsur'), (SELECT id FROM regions WHERE name='Puno'), -14.4400, -69.5900, 380000, 1.7, 2),
('Corani', (SELECT id FROM companies WHERE name='Bear Creek Mining'), (SELECT id FROM regions WHERE name='Puno'), -15.0600, -70.3800, 300000, 1.9, 3),
('Mallay', (SELECT id FROM companies WHERE name='Buenaventura'), (SELECT id FROM regions WHERE name='Lima'), -11.2700, -76.8200, 200000, 2.2, 3),
('Ariana', (SELECT id FROM companies WHERE name='Southern Peaks'), (SELECT id FROM regions WHERE name='Junin'), -11.8500, -75.3200, 210000, 1.8, 3),
('Mina Justa', (SELECT id FROM companies WHERE name='Minsur'), (SELECT id FROM regions WHERE name='Ica'), -14.5200, -75.6200, 550000, 1.3, 2),
('San Gabriel', (SELECT id FROM companies WHERE name='Buenaventura'), (SELECT id FROM regions WHERE name='Moquegua'), -17.1500, -70.6900, 430000, 2.4, 2),
('Pachapaqui', (SELECT id FROM companies WHERE name='Milpo'), (SELECT id FROM regions WHERE name='Ancash'), -10.4000, -77.1200, 250000, 1.6, 3),
('El Toro', (SELECT id FROM companies WHERE name='Aruntani'), (SELECT id FROM regions WHERE name='Ayacucho'), -15.2800, -74.2100, 270000, 2.1, 4),
('Huampar', (SELECT id FROM companies WHERE name='Sierra Metals'), (SELECT id FROM regions WHERE name='Lima'), -11.5900, -76.4800, 160000, 1.9, 3),
('Arcata', (SELECT id FROM companies WHERE name='Ares Mining'), (SELECT id FROM regions WHERE name='Arequipa'), -15.2300, -71.3600, 140000, 2.0, 3);

-- D. Financial Parameters (AISC & CAPEX overrides for key mines)
UPDATE mines SET aisc_usd_oz = 900, capex_required_usd = 120000000 WHERE name IN ('Yanacocha', 'Cerro Corona', 'Pataz', 'Poderosa');
UPDATE mines SET aisc_usd_oz = 1250, capex_required_usd = 80000000 WHERE name IN ('Lagunas Norte', 'Inmaculada', 'Quellaveco');
UPDATE mines SET aisc_usd_oz = 1600, capex_required_usd = 45000000 WHERE name IN ('Cerro de Pasco', 'Arasi', 'El Toro');

-- E. Regional Risk Overrides
UPDATE mines SET env_risk_level = 5 WHERE region_id IN (SELECT id FROM regions WHERE name IN ('Puno', 'Ayacucho'));
UPDATE mines SET env_risk_level = 1 WHERE region_id IN (SELECT id FROM regions WHERE name IN ('Moquegua', 'Tacna'));