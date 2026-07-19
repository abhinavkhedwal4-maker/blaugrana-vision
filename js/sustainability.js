/**
 * @fileoverview Sustainability Tracker page controller
 * @description Ranks all 16 venues by a computed sustainability score,
 *              models fan travel modal-shift emissions savings, and
 *              surfaces practical green-travel tips.
 * @module sustainability
 */

'use strict';

import { STADIUMS } from './stadiums-data.js';
import { computeSustainabilityScore, estimateModalShiftSavings } from './carbon.js';
import { formatPersons } from './shared.js';

/** Illustrative fan attendance figure used for modal-shift modelling */
const DEFAULT_TOTAL_FANS = 65000;

/** Illustrative average one-way travel distance in km, for modal-shift modelling */
const DEFAULT_AVG_DISTANCE_KM = 12;

/** Practical green-travel tips shown on every visit */
const GREEN_TIPS = Object.freeze([
  { icon: '🚇', text: 'Public transit produces roughly a quarter of the emissions of driving alone to the same venue.' },
  { icon: '🚌', text: 'Free event shuttles are available from most designated Fan Zones — check the Transport page for routes.' },
  { icon: '🚲', text: 'Several venues have dedicated bike valet parking near the main gates.' },
  { icon: '🤝', text: 'Carpooling with fellow fans cuts your personal share of trip emissions significantly.' },
]);

// ─── Leaderboard ──────────────────────────────────────────────────────────────

/** Renders all 16 venues ranked by computed sustainability score. */
function renderLeaderboard() {
  const list = document.getElementById('sustainLeaderboard');
  if (!list) return;

  const ranked = STADIUMS
    .map((s) => ({ stadium: s, score: computeSustainabilityScore(s) }))
    .sort((a, b) => b.score - a.score);

  list.innerHTML = ranked.map((r, i) => `
    <div class="sustain-row" role="listitem">
      <div class="sustain-rank">${i + 1}</div>
      <div class="sustain-info">
        <div class="sustain-name">${r.stadium.commonName}</div>
        <div class="sustain-city">${r.stadium.city}</div>
      </div>
      <div class="sustain-bar-wrap">
        <div class="sustain-bar-track">
          <div class="sustain-bar-fill" style="width:${r.score}%"></div>
        </div>
      </div>
      <div class="sustain-score">${r.score}</div>
    </div>`).join('');
}

// ─── Modal shift calculator ───────────────────────────────────────────────────

/** Calculates and renders estimated emissions saved from a modal shift scenario. */
function calculateModalShift() {
  const switchSlider = document.getElementById('switchRateSlider');
  const switchValue  = document.getElementById('switchRateValue');
  const resultEl     = document.getElementById('modalShiftResult');
  if (!switchSlider || !resultEl) return;

  const switchRate = parseInt(switchSlider.value, 10);
  if (switchValue) switchValue.textContent = `${switchRate}%`;

  const savedKg = estimateModalShiftSavings(DEFAULT_TOTAL_FANS, DEFAULT_AVG_DISTANCE_KM, switchRate);
  const savedTonnes = savedKg / 1000;

  resultEl.innerHTML = `
    <div>
      <div class="modal-shift-num">${savedTonnes.toFixed(1)}t</div>
      <div class="modal-shift-label">CO₂e saved per match</div>
    </div>
    <div class="modal-shift-detail">
      If ${switchRate}% of an estimated ${formatPersons(DEFAULT_TOTAL_FANS)} attending fans switch from driving to public transit for an average ${DEFAULT_AVG_DISTANCE_KM} km journey.
    </div>`;
}

// ─── Green tips ───────────────────────────────────────────────────────────────

/** Renders the static green-travel tip cards. */
function renderGreenTips() {
  const grid = document.getElementById('greenTipsGrid');
  if (!grid) return;
  grid.innerHTML = GREEN_TIPS.map((t) => `
    <div class="green-tip-card">
      <span class="green-tip-icon" aria-hidden="true">${t.icon}</span>
      <span class="green-tip-text">${t.text}</span>
    </div>`).join('');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

renderLeaderboard();
renderGreenTips();
calculateModalShift();
document.getElementById('switchRateSlider')?.addEventListener('input', calculateModalShift);