import { useEffect, useState } from 'react';
import { api } from '../api.js';

const STATUS_CONFIG = {
  critical_low:  { label: 'CRITICAL ↓', color: '#E74C3C', bg: 'rgba(231, 76, 60, 0.12)', icon: '🔴' },
  critical_high: { label: 'CRITICAL ↑', color: '#E74C3C', bg: 'rgba(231, 76, 60, 0.12)', icon: '🔴' },
  low:           { label: 'LOW',        color: '#E67E22', bg: 'rgba(230, 126, 34, 0.12)', icon: '🟠' },
  high:          { label: 'HIGH',       color: '#E67E22', bg: 'rgba(230, 126, 34, 0.12)', icon: '🟠' },
  normal:        { label: 'NORMAL',     color: '#27AE60', bg: 'rgba(39, 174, 96, 0.12)',  icon: '🟢' }
};

const CATEGORY_LABELS = {
  vitamin: '🧬 Vitamins',
  renal: '🫘 Kidney & Minerals',
  liver: '🏥 Liver Function',
  lipid: '🫀 Lipid Panel',
  blood: '🩸 Blood Count',
  hormone: '⚡ Hormones',
  diabetes: '🍬 Diabetes',
  thyroid: '🦋 Thyroid'
};

const DEFICIENCY_TAGS = {
  vitamin_d: { label: 'Vit D', color: '#F39C12' },
  uric_acid: { label: 'Uric Acid', color: '#E74C3C' },
  hdl: { label: 'HDL', color: '#3498DB' },
  calcium: { label: 'Calcium', color: '#9B59B6' },
  liver: { label: 'Liver', color: '#E67E22' },
  b12: { label: 'B12', color: '#1ABC9C' },
  iron: { label: 'Iron', color: '#95A5A6' },
  protein: { label: 'Protein', color: '#2ECC71' },
  general: { label: 'General', color: '#7F8C8D' }
};

function MarkerCard({ marker }) {
  const config = STATUS_CONFIG[marker.status] || STATUS_CONFIG.normal;
  const pct = marker.reference_high > 0
    ? Math.min(((marker.value / marker.reference_high) * 100), 150)
    : 50;

  return (
    <div className="health-marker-card" style={{ '--marker-color': config.color }}>
      <div className="health-marker-header">
        <span className="health-marker-icon">{config.icon}</span>
        <span className="health-marker-name">{marker.marker_name}</span>
        <span className="health-marker-badge" style={{ background: config.bg, color: config.color }}>
          {config.label}
        </span>
      </div>
      <div className="health-marker-value-row">
        <span className="health-marker-value" style={{ color: config.color }}>
          {Number(marker.value).toFixed(marker.value % 1 === 0 ? 0 : 1)}
        </span>
        <span className="health-marker-unit">{marker.unit}</span>
        <span className="health-marker-range">
          (ref: {marker.reference_low}–{marker.reference_high})
        </span>
      </div>
      <div className="health-marker-bar">
        <div className="health-marker-bar-track">
          <div
            className="health-marker-bar-fill"
            style={{
              width: `${Math.min(pct, 100)}%`,
              background: config.color,
              opacity: 0.7
            }}
          />
          {/* Reference range indicator */}
          {marker.reference_low > 0 && marker.reference_high > 0 && (
            <div
              className="health-marker-ref-zone"
              style={{
                left: `${(marker.reference_low / (marker.reference_high * 1.5)) * 100}%`,
                width: `${((marker.reference_high - marker.reference_low) / (marker.reference_high * 1.5)) * 100}%`
              }}
            />
          )}
        </div>
      </div>
      {marker.dietary_action && (
        <div className="health-marker-action">
          <strong>Action:</strong> {marker.dietary_action}
        </div>
      )}
    </div>
  );
}

function MealCard({ item }) {
  const tags = (item.targets_deficiency || '').split(',').filter(Boolean);
  return (
    <div className="diet-meal-card">
      <div className="diet-meal-header">
        <div className="diet-meal-slot">{item.meal_slot}</div>
        {item.meal_time && <div className="diet-meal-time">🕐 {item.meal_time}</div>}
      </div>
      <div className="diet-meal-foods">{item.foods}</div>
      {item.purpose && <div className="diet-meal-purpose">{item.purpose}</div>}
      {tags.length > 0 && (
        <div className="diet-meal-tags">
          {tags.map(tag => {
            const t = DEFICIENCY_TAGS[tag.trim()] || { label: tag.trim(), color: '#7F8C8D' };
            return (
              <span key={tag} className="diet-meal-tag" style={{ background: `${t.color}20`, color: t.color, borderColor: `${t.color}40` }}>
                {t.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CurrentDiet() {
  const [plan, setPlan] = useState([]);
  const [health, setHealth] = useState({ flagged: [], normal: [], all: [] });
  const [loading, setLoading] = useState(true);
  const [showNormal, setShowNormal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [planData, healthData] = await Promise.all([
        api.get('/diet-plan/current'),
        api.get('/diet-plan/health-summary')
      ]);
      setPlan(planData);
      setHealth(healthData);
    } catch (err) {
      console.error('Failed to load diet plan:', err);
    }
    setLoading(false);
  }

  if (loading) {
    return <div className="empty-state" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading diet plan…</div>;
  }

  // Group markers by category
  const groupedFlagged = {};
  health.flagged.forEach(m => {
    const cat = m.category || 'other';
    if (!groupedFlagged[cat]) groupedFlagged[cat] = [];
    groupedFlagged[cat].push(m);
  });

  const groupedNormal = {};
  health.normal.forEach(m => {
    const cat = m.category || 'other';
    if (!groupedNormal[cat]) groupedNormal[cat] = [];
    groupedNormal[cat].push(m);
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Blood Report Analysis → Personalized Diet</div>
        <h1 className="page-title">Current Diet Plan</h1>
        <p className="page-sub">
          Based on your Thyrocare report (Jun 2026) and InBody scan (Aug 2026). Diet tailored for: Vitamin D recovery, uric acid control, liver enzyme monitoring, HDL improvement, and calcium restoration.
        </p>
      </div>

      {/* ── Disclaimer Banner ── */}
      <div className="diet-plan-disclaimer">
        <span className="diet-plan-disclaimer-icon">⚕️</span>
        <div>
          <strong>Not medical advice.</strong> These suggestions are based on general nutrition guidelines for your specific blood markers.
          Please consult your doctor — especially about the elevated liver enzymes (SGOT/SGPT) and Vitamin D supplementation dosage.
        </div>
      </div>

      {/* ── Section 1: Flagged Health Markers ── */}
      <div className="diet-plan-section">
        <h2 className="diet-plan-section-title">
          <span>🚨</span> Flagged Markers — Needs Dietary Action
        </h2>
        <p className="diet-plan-section-sub">{health.flagged.length} marker{health.flagged.length !== 1 ? 's' : ''} outside normal range</p>

        {Object.entries(groupedFlagged).map(([cat, markers]) => (
          <div key={cat} className="health-marker-group">
            <div className="health-marker-group-label">{CATEGORY_LABELS[cat] || cat}</div>
            <div className="health-marker-grid">
              {markers.map(m => <MarkerCard key={m.id} marker={m} />)}
            </div>
          </div>
        ))}
      </div>

      {/* ── Section 2: Suggested Daily Meal Plan ── */}
      <div className="diet-plan-section">
        <h2 className="diet-plan-section-title">
          <span>🥗</span> Your Daily Meal Plan
        </h2>
        <p className="diet-plan-section-sub">
          Eggs OK, no meat. Each meal targets specific deficiencies from your report. Tags show which issues each meal addresses.
        </p>

        <div className="diet-meal-grid">
          {plan.map(item => <MealCard key={item.id} item={item} />)}
        </div>
      </div>

      {/* ── Section 3: Key Rules ── */}
      <div className="diet-plan-section">
        <h2 className="diet-plan-section-title">
          <span>📋</span> Key Dietary Rules
        </h2>

        <div className="diet-rules-grid">
          <div className="diet-rule-card diet-rule-avoid">
            <div className="diet-rule-header">🚫 AVOID</div>
            <ul className="diet-rule-list">
              <li><strong>Rajma / kidney beans</strong> — very high purines, raises uric acid</li>
              <li><strong>Alcohol</strong> — liver is already stressed (SGOT 88)</li>
              <li><strong>Excess whey</strong> — max 1 scoop/day, liver can't handle more right now</li>
              <li><strong>Mushrooms, organ meats</strong> — high purines</li>
              <li><strong>Fried/processed food</strong> — worsens HDL ratio</li>
              <li><strong>Excess salt</strong> — raises blood pressure, stresses kidneys</li>
            </ul>
          </div>

          <div className="diet-rule-card diet-rule-add">
            <div className="diet-rule-header">✅ ADD / INCREASE</div>
            <ul className="diet-rule-list">
              <li><strong>Morning sunlight 15-20 min</strong> — critical for Vitamin D synthesis</li>
              <li><strong>Flaxseed + walnuts daily</strong> — omega-3 raises HDL</li>
              <li><strong>Curd/dahi every meal</strong> — calcium + probiotics</li>
              <li><strong>Green tea 2x/day</strong> — liver detox + antioxidants</li>
              <li><strong>Lemon water</strong> — alkalizes, helps flush uric acid</li>
              <li><strong>2 eggs daily</strong> — best natural Vit D source (vegetarian)</li>
              <li><strong>Amla / gooseberry</strong> — Vit C + liver support</li>
              <li><strong>Water 3.5-4L/day</strong> — uric acid, kidneys, everything</li>
            </ul>
          </div>

          <div className="diet-rule-card diet-rule-supplement">
            <div className="diet-rule-header">💊 Supplements (Doctor Prescribed)</div>
            <ul className="diet-rule-list">
              <li><strong>Vitamin D3 60,000 IU</strong> — 1 sachet/week for 8 weeks, then retest</li>
              <li><strong>Calcium + D3 tablet</strong> — daily with lunch (not with iron foods)</li>
              <li><strong>Fish oil / Omega-3</strong> — 1 capsule/day for HDL (if comfortable, not meat)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Section 4: Normal Markers (collapsible) ── */}
      <div className="diet-plan-section">
        <button
          className="diet-plan-toggle-btn"
          onClick={() => setShowNormal(!showNormal)}
        >
          <span>{showNormal ? '▼' : '▶'}</span>
          <span>✅ Normal Markers ({health.normal.length})</span>
          <span className="diet-plan-toggle-hint">{showNormal ? 'Hide' : 'Show all passing markers'}</span>
        </button>

        {showNormal && (
          <div style={{ marginTop: 16 }}>
            {Object.entries(groupedNormal).map(([cat, markers]) => (
              <div key={cat} className="health-marker-group">
                <div className="health-marker-group-label">{CATEGORY_LABELS[cat] || cat}</div>
                <div className="health-marker-grid normal">
                  {markers.map(m => (
                    <div key={m.id} className="health-marker-card compact">
                      <div className="health-marker-header">
                        <span className="health-marker-icon">🟢</span>
                        <span className="health-marker-name">{m.marker_name}</span>
                      </div>
                      <div className="health-marker-value-row">
                        <span className="health-marker-value" style={{ color: 'var(--green)' }}>
                          {Number(m.value).toFixed(m.value % 1 === 0 ? 0 : 1)}
                        </span>
                        <span className="health-marker-unit">{m.unit}</span>
                        <span className="health-marker-range">(ref: {m.reference_low}–{m.reference_high})</span>
                      </div>
                      {m.dietary_action && (
                        <div className="health-marker-action">{m.dietary_action}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── InBody Composition Summary ── */}
      <div className="diet-plan-section">
        <h2 className="diet-plan-section-title">
          <span>📊</span> Body Composition (InBody Aug 2026)
        </h2>
        <div className="inbody-stats-grid">
          <div className="stat-card compact">
            <div className="stat-label">Weight</div>
            <div className="stat-value" style={{ fontSize: 22 }}>63 kg</div>
            <div className="stat-note">Target: 62.4 kg</div>
          </div>
          <div className="stat-card compact">
            <div className="stat-label">Muscle Mass</div>
            <div className="stat-value positive" style={{ fontSize: 22 }}>29.9 kg</div>
            <div className="stat-note">47.5% of body weight</div>
          </div>
          <div className="stat-card compact">
            <div className="stat-label">Body Fat</div>
            <div className="stat-value" style={{ fontSize: 22 }}>10 kg</div>
            <div className="stat-note">15.8% — athletic range</div>
          </div>
          <div className="stat-card compact">
            <div className="stat-label">BMR</div>
            <div className="stat-value" style={{ fontSize: 22 }}>1,515 kcal</div>
            <div className="stat-note">Base metabolic rate</div>
          </div>
          <div className="stat-card compact">
            <div className="stat-label">Daily Intake Target</div>
            <div className="stat-value positive" style={{ fontSize: 22 }}>~2,562 kcal</div>
            <div className="stat-note">For gym + active lifestyle</div>
          </div>
          <div className="stat-card compact">
            <div className="stat-label">BMI</div>
            <div className="stat-value positive" style={{ fontSize: 22 }}>22.3</div>
            <div className="stat-note">Normal range</div>
          </div>
        </div>
      </div>
    </div>
  );
}
