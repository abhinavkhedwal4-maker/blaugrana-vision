/**
 * @fileoverview Crowd Operations dashboard controller
 * @description Wires the crowd-model.js pure functions to a live,
 *              interactive dashboard for venue staff — zone selection,
 *              risk scoring, gate status, and AI-generated recommendations.
 * @module crowd-ops
 */

'use strict';

import { logError } from './errors.js';
import { STADIUMS } from './stadiums-data.js';
import {
  computeZoneRisk, classifyRiskLevel, estimateGateWaitMinutes,
  isGateOverCapacity, RECOMMENDED_MAX_EVACUATION_MIN,
} from './crowd-model.js';
import { formatPersons, formatMessage } from './shared.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Simulated zone definitions — in production these would stream from IoT sensors */
const ZONES = Object.freeze([
  { id: 'north-lower', label: 'North Stand — Lower', areaM2: 4200, gateWidthM: 18, exitWidthM: 22 },
  { id: 'south-lower', label: 'South Stand — Lower', areaM2: 4200, gateWidthM: 18, exitWidthM: 22 },
  { id: 'east-upper',  label: 'East Stand — Upper',  areaM2: 3100, gateWidthM: 12, exitWidthM: 16 },
  { id: 'west-upper',  label: 'West Stand — Upper',  areaM2: 3100, gateWidthM: 12, exitWidthM: 16 },
  { id: 'concourse',   label: 'Main Concourse',       areaM2: 5600, gateWidthM: 24, exitWidthM: 30 },
]);

/** Simulated gates for the gate-status list */
const GATES = Object.freeze([
  { id: 'gate-a', name: 'Gate A — North', widthM: 6, arrivalsPerMin: 95 },
  { id: 'gate-b', name: 'Gate B — South', widthM: 6, arrivalsPerMin: 140 },
  { id: 'gate-c', name: 'Gate C — East',  widthM: 4, arrivalsPerMin: 60 },
  { id: 'gate-d', name: 'Gate D — West',  widthM: 4, arrivalsPerMin: 210 },
  { id: 'gate-vip', name: 'Gate VIP',     widthM: 2, arrivalsPerMin: 20 },
]);

// ─── State ───────────────────────────────────────────────────────────────────

/** @type {string} Currently selected zone id */
let currentZoneId = ZONES[0].id;

/** @type {number} Simulated occupants for the selected zone */
let simOccupants = 8000;

/** @type {number} Simulated arrival rate for the selected zone */
let simArrivals = 120;

// ─── Summary cards ────────────────────────────────────────────────────────────

/** Renders the venue-wide summary cards at the top of the dashboard. */
function renderSummary() {
  const grid = document.getElementById('opsSummaryGrid');
  if (!grid) return;

  const totalOccupants = ZONES.length * simOccupants; // illustrative aggregate
  const overCapacityGates = GATES.filter((g) => isGateOverCapacity(g.arrivalsPerMin, g.widthM)).length;
  const worstEvac = Math.max(...ZONES.map((z) =>
    computeZoneRisk({ ...z, occupants: simOccupants, arrivalsPerMin: simArrivals }).evacuationMin));

  const cards = [
    { icon: '👥', label: 'Est. Total Fans Inside', value: formatPersons(totalOccupants), sub: `Across ${ZONES.length} monitored zones`, color: 'var(--green)' },
    { icon: '🚪', label: 'Gates Over Capacity', value: String(overCapacityGates), sub: `of ${GATES.length} monitored gates`, color: overCapacityGates > 0 ? 'var(--crimson-bright)' : 'var(--green)' },
    { icon: '⏱️', label: 'Worst-Case Evacuation', value: `${worstEvac.toFixed(1)} min`, sub: `Target: under ${RECOMMENDED_MAX_EVACUATION_MIN} min`, color: worstEvac > RECOMMENDED_MAX_EVACUATION_MIN ? 'var(--crimson-bright)' : 'var(--green)' },
    { icon: '🏟️', label: 'Venues Monitored', value: String(STADIUMS.length), sub: 'All FIFA World Cup 2026 host stadiums', color: 'var(--gold)' },
  ];

  grid.innerHTML = cards.map((c) => `
    <div class="ops-summary-card" style="--status-color:${c.color}">
      <div class="ops-summary-icon" aria-hidden="true">${c.icon}</div>
      <div class="ops-summary-label">${c.label}</div>
      <div class="ops-summary-value">${c.value}</div>
      <div class="ops-summary-sub">${c.sub}</div>
    </div>`).join('');
}

// ─── Zone selector ────────────────────────────────────────────────────────────

/** Dot colours keyed by risk level — defined once, not recreated per render */
const RISK_DOT_COLORS = Object.freeze({
  normal  : 'var(--green)',
  watch   : 'var(--gold)',
  alert   : '#fb923c',
  critical: 'var(--crimson-bright)',
});

/**
 * Cached risk results for non-selected zones so renderZoneSelector doesn't
 * recompute all five zones on every button click.
 * @type {Map<string, ReturnType<typeof computeZoneRisk>>}
 */
const _zoneRiskCache = new Map();

/** Clears the zone risk cache — call when simOccupants/simArrivals change. */
function invalidateZoneCache() { _zoneRiskCache.clear(); }

/** Renders the zone selector buttons with live status dots. */
function renderZoneSelector() {
  const row = document.getElementById('zoneSelectRow');
  if (!row) return;

  row.innerHTML = ZONES.map((z) => {
    const isSelected = z.id === currentZoneId;
    // Always recompute the selected zone; use cache for the rest.
    let risk;
    if (isSelected) {
      risk = computeZoneRisk({ ...z, occupants: simOccupants, arrivalsPerMin: simArrivals });
    } else {
      if (!_zoneRiskCache.has(z.id)) {
        _zoneRiskCache.set(z.id, computeZoneRisk({
          ...z, occupants: Math.round(z.areaM2 * 1.4), arrivalsPerMin: 80,
        }));
      }
      risk = _zoneRiskCache.get(z.id);
    }
    const level = classifyRiskLevel(risk.score);
    const dotColor = RISK_DOT_COLORS[level];

    return `
      <button class="zone-select-btn${isSelected ? ' active' : ''}" data-zone="${z.id}"
              type="button" aria-pressed="${isSelected}">
        <span class="zone-status-dot" style="background:${dotColor}" aria-hidden="true"></span>
        ${z.label}
      </button>`;
  }).join('');

  row.querySelectorAll('.zone-select-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentZoneId = btn.dataset.zone;
      renderZoneSelector();
      renderRiskPanel();
    });
  });
}

// ─── Risk panel ───────────────────────────────────────────────────────────────

/** Renders the risk score, level badge and metrics for the current zone. */
function renderRiskPanel() {
  const zone = ZONES.find((z) => z.id === currentZoneId);
  if (!zone) return;

  const risk  = computeZoneRisk({ ...zone, occupants: simOccupants, arrivalsPerMin: simArrivals });
  const level = classifyRiskLevel(risk.score);

  const scoreEl = document.getElementById('riskScoreNum');
  const badgeEl = document.getElementById('riskLevelBadge');
  const metricsEl = document.getElementById('riskMetrics');

  if (scoreEl) scoreEl.textContent = String(risk.score);
  if (badgeEl) {
    badgeEl.textContent = level.charAt(0).toUpperCase() + level.slice(1);
    badgeEl.className = `risk-level-badge ${level}`;
  }

  if (metricsEl) {
    metricsEl.innerHTML = [
      { label: 'Crowd Density Level of Service', value: `Class ${risk.los.label} (${risk.los.risk})` },
      { label: 'Estimated Evacuation Time', value: `${risk.evacuationMin.toFixed(1)} min` },
      { label: 'Gate Congestion', value: risk.overCapacity ? '⚠️ Over capacity' : '✅ Within capacity' },
      { label: 'Zone Occupants (simulated)', value: formatPersons(simOccupants) },
    ].map((m) => `
      <div class="risk-metric-row">
        <span class="risk-metric-label">${m.label}</span>
        <span class="risk-metric-value">${m.value}</span>
      </div>`).join('');
  }
}

// ─── Gate list ────────────────────────────────────────────────────────────────

/** Renders live gate status rows with wait-time estimates. */
function renderGateList() {
  const list = document.getElementById('gateList');
  if (!list) return;

  list.innerHTML = GATES.map((g) => {
    const wait = estimateGateWaitMinutes(g.arrivalsPerMin, g.widthM, Math.round(g.arrivalsPerMin * 1.5));
    const over = isGateOverCapacity(g.arrivalsPerMin, g.widthM);
    let badge;
    if (over)       badge = { cls: 'over', label: 'Over Capacity' };
    else if (wait > 4) badge = { cls: 'busy', label: 'Busy' };
    else            badge = { cls: 'ok',   label: 'Flowing' };

    return `
      <div class="gate-row" role="listitem">
        <span class="gate-icon" aria-hidden="true">🚪</span>
        <div class="gate-info">
          <div class="gate-name">${g.name}</div>
          <div class="gate-wait">${g.arrivalsPerMin} arrivals/min · ~${wait} min wait</div>
        </div>
        <span class="gate-badge ${badge.cls}">${badge.label}</span>
      </div>`;
  }).join('');
}

// ─── Simulation controls ──────────────────────────────────────────────────────

function wireSliders() {
  const occupantsSlider = document.getElementById('occupantsSlider');
  const arrivalsSlider  = document.getElementById('arrivalsSlider');
  const occupantsValue  = document.getElementById('occupantsValue');
  const arrivalsValue   = document.getElementById('arrivalsValue');

  occupantsSlider?.addEventListener('input', (e) => {
    simOccupants = parseInt(e.target.value, 10);
    if (occupantsValue) occupantsValue.textContent = formatPersons(simOccupants);
    invalidateZoneCache();
    renderRiskPanel();
    renderSummary();
  });

  arrivalsSlider?.addEventListener('input', (e) => {
    simArrivals = parseInt(e.target.value, 10);
    if (arrivalsValue) arrivalsValue.textContent = String(simArrivals);
    invalidateZoneCache();
    renderRiskPanel();
    renderSummary();
  });
}

// ─── AI recommendation ────────────────────────────────────────────────────────

/**
 * Requests a GenAI-authored operational recommendation based on the current
 * simulated zone conditions.
 * @returns {Promise<void>}
 */
window.requestAIRecommendation = async function requestAIRecommendation() {
  const zone = ZONES.find((z) => z.id === currentZoneId);
  const risk = computeZoneRisk({ ...zone, occupants: simOccupants, arrivalsPerMin: simArrivals });
  const level = classifyRiskLevel(risk.score);

  const panel   = document.getElementById('aiRecommendation');
  const content = document.getElementById('aiRecommendationContent');
  if (!panel || !content) return;

  panel.classList.remove('hidden');
  content.innerHTML = '<p class="text-muted">Analysing conditions...</p>';

  const prompt = `Zone: ${zone.label}
Simulated occupants: ${simOccupants}
Arrivals per minute: ${simArrivals}
Risk score: ${risk.score}/100 (${level})
Crowd density Level of Service: ${risk.los.label} (${risk.los.risk})
Estimated evacuation time: ${risk.evacuationMin} minutes
Gate congestion: ${risk.overCapacity ? 'over capacity' : 'within capacity'}

As a stadium operations advisor, give 3 short, specific, actionable recommendations for venue staff right now. Be direct and practical.`;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a stadium crowd safety operations advisor. Give short, direct, actionable guidance.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { reply } = await res.json();
    if (!reply) throw new Error('Empty response');

    content.innerHTML = formatMessage(reply);
  } catch (err) {
    logError('Crowd Ops', 'AI recommendation', err);
    content.innerHTML = '<p class="text-muted">⚠️ Could not reach Blaugrana AI. Make sure the server is running.</p>';
  }
};

// ─── Init ─────────────────────────────────────────────────────────────────────

renderSummary();
renderZoneSelector();
renderRiskPanel();
renderGateList();
wireSliders();