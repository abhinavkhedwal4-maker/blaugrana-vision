/**
 * @fileoverview AI Navigator page controller
 * @description Multilingual wayfinding assistant — surfaces points of
 *              interest per venue, generates simple step-by-step routes,
 *              and hands off natural-language questions to the AI chat.
 * @module navigator
 */

'use strict';

import { STADIUMS, getStadiumById } from './stadiums-data.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Supported UI languages for the navigator quick-select */
const LANGUAGES = Object.freeze([
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'zh', label: '中文' },
  { code: 'ar', label: 'العربية' },
]);

/**
 * Generic point-of-interest categories present at every venue.
 * In production these would be venue-specific coordinates from a facilities
 * database; here they model the wayfinding experience realistically.
 */
const POI_TEMPLATE = Object.freeze([
  { id: 'gate-a',      icon: '🚪', name: 'Gate A — Main Entrance', desc: 'Primary fan entrance, bag check', etaMin: 3 },
  { id: 'seat-finder', icon: '💺', name: 'Find My Seat',            desc: 'Section, row and seat wayfinding', etaMin: 5 },
  { id: 'concessions', icon: '🌭', name: 'Nearest Concessions',     desc: 'Food, drinks and merchandise',     etaMin: 2 },
  { id: 'restroom',    icon: '🚻', name: 'Nearest Restroom',        desc: 'Including accessible facilities',  etaMin: 1 },
  { id: 'medical',     icon: '⛑️', name: 'First Aid Station',       desc: 'Medical assistance point',          etaMin: 4 },
  { id: 'family',      icon: '👨‍👩‍👧', name: 'Family Zone',            desc: 'Quiet area with baby-care facilities', etaMin: 3 },
  { id: 'transit',     icon: '🚆', name: 'Transit Connection',      desc: 'Shuttle & public transit pickup',   etaMin: 6 },
  { id: 'lost-found',  icon: '🔍', name: 'Lost & Found',            desc: 'Report or claim lost items',         etaMin: 4 },
]);

// ─── State ───────────────────────────────────────────────────────────────────

/** @type {string} Currently selected stadium id */
let currentStadiumId = STADIUMS[0].id;

/** @type {string} Currently selected UI language code */
let currentLang = 'en';

// ─── Stadium selector ─────────────────────────────────────────────────────────

/** Populates the stadium dropdown with all 16 venues. */
function renderStadiumSelect() {
  const select = document.getElementById('stadiumSelect');
  if (!select) return;

  select.innerHTML = STADIUMS.map((s) =>
    `<option value="${s.id}" ${s.id === currentStadiumId ? 'selected' : ''}>${s.commonName} — ${s.city}</option>`,
  ).join('');

  select.addEventListener('change', (e) => {
    currentStadiumId = e.target.value;
    renderPOIGrid();
  });
}

// ─── Language selector ────────────────────────────────────────────────────────

/** Renders the language quick-select pills. */
function renderLanguagePills() {
  const row = document.getElementById('langPillRow');
  if (!row) return;

  row.innerHTML = LANGUAGES.map((l) =>
    `<button class="lang-pill${l.code === currentLang ? ' active' : ''}" data-lang="${l.code}" aria-pressed="${l.code === currentLang}">${l.label}</button>`,
  ).join('');

  row.querySelectorAll('.lang-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentLang = btn.dataset.lang;
      renderLanguagePills();
      const hint = document.getElementById('langHint');
      if (hint) {
        hint.textContent = currentLang === 'en'
          ? 'Ask Blaugrana AI anything — responses default to English.'
          : `Ask Blaugrana AI in ${LANGUAGES.find((l) => l.code === currentLang)?.label} — it will respond in the same language.`;
      }
    });
  });
}

// ─── Points of interest ───────────────────────────────────────────────────────

/** Renders the point-of-interest grid for the selected stadium. */
function renderPOIGrid() {
  const grid = document.getElementById('poiGrid');
  const stadium = getStadiumById(currentStadiumId);
  if (!grid || !stadium) return;

  grid.innerHTML = POI_TEMPLATE.map((poi) => `
    <div class="poi-card" data-poi="${poi.id}" role="button" tabindex="0" aria-label="Navigate to ${poi.name}">
      <span class="poi-icon" aria-hidden="true">${poi.icon}</span>
      <div>
        <div class="poi-name">${poi.name}</div>
        <div class="poi-desc">${poi.desc}</div>
        <div class="poi-eta">~${poi.etaMin} min walk from your seat</div>
      </div>
    </div>`).join('');

  grid.querySelectorAll('.poi-card').forEach((card) => {
    card.addEventListener('click',   () => generateRoute(card.dataset.poi, stadium));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); generateRoute(card.dataset.poi, stadium); }
    });
  });
}

// ─── Route generation ─────────────────────────────────────────────────────────

/**
 * Generates a simple illustrative step-by-step route to a point of interest.
 * @param {string} poiId
 * @param {import('./stadiums-data.js').Stadium} stadium
 */
function generateRoute(poiId, stadium) {
  const poi = POI_TEMPLATE.find((p) => p.id === poiId);
  if (!poi) return;

  const resultEl = document.getElementById('routeResult');
  if (!resultEl) return;

  const steps = [
    `Exit your section via the nearest concourse stairway.`,
    `Follow the ${poi.icon} ${poi.name} signage along the main concourse.`,
    `Arrive at ${poi.name} — approximately ${poi.etaMin} minute${poi.etaMin === 1 ? '' : 's'} away.`,
  ];

  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `
    <h3 style="margin-bottom:1rem;">Route to ${poi.name}</h3>
    ${steps.map((step, i) => `
      <div class="route-step">
        <span class="route-step-num">${i + 1}</span>
        <span class="route-step-text">${step}</span>
      </div>`).join('')}
    <p style="margin-top:1rem;font-size:0.8rem;color:var(--text-muted)">
      📍 At ${stadium.commonName} — ask Blaugrana AI for turn-by-turn help anytime.
    </p>`;

  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── Free-text search handoff ─────────────────────────────────────────────────

/** Wires the free-text search box to open the chat with a pre-filled question. */
function wireSearchBox() {
  const input  = document.getElementById('navSearchInput');
  const button = document.getElementById('navSearchBtn');

  const submit = () => {
    const query = input?.value.trim();
    if (!query) return;
    window.toggleChat?.();
    setTimeout(() => window.sendSuggestion?.(query), 400);
  };

  button?.addEventListener('click', submit);
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

renderStadiumSelect();
renderLanguagePills();
renderPOIGrid();
wireSearchBox();