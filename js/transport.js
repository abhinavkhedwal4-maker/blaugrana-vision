/**
 * @fileoverview Transport Intelligence page controller
 * @description Compares travel modes, plans departure times against kickoff,
 *              and surfaces simulated real-time transit line status for the
 *              selected venue.
 * @module transport
 */

'use strict';

import { STADIUMS } from './stadiums-data.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Travel mode options with illustrative ETA and per-fan CO₂ figures (kg) */
const TRAVEL_MODES = Object.freeze([
  { id: 'transit', icon: '🚇', name: 'Public Transit', etaMin: 35, co2Kg: 1.2 },
  { id: 'shuttle',  icon: '🚌', name: 'Event Shuttle',  etaMin: 25, co2Kg: 1.8 },
  { id: 'rideshare',icon: '🚗', name: 'Rideshare',      etaMin: 20, co2Kg: 4.6 },
  { id: 'walk',     icon: '🚶', name: 'Walk / Cycle',   etaMin: 15, co2Kg: 0 },
  { id: 'drive',    icon: '🚙', name: 'Personal Vehicle', etaMin: 18, co2Kg: 6.2 },
]);

/** Minutes before kickoff recommended for security screening and entry */
const ARRIVAL_BUFFER_MIN = 60;

/** Simulated transit lines serving a venue on match day */
const TRANSIT_LINES = Object.freeze([
  { id: 'l1', name: 'Metro Green Line', color: '#22c55e', detail: 'Direct to Stadium Station', status: 'normal' },
  { id: 'l2', name: 'Express Shuttle Route 4', color: '#a31d31', detail: 'From Downtown Transit Hub', status: 'crowded' },
  { id: 'l3', name: 'Regional Rail', color: '#3b82f6', detail: 'Connects to Airport Terminal', status: 'delayed' },
  { id: 'l4', name: 'Fan Zone Shuttle', color: '#f5b700', detail: 'Free shuttle from Fan Zone', status: 'normal' },
]);

// ─── State ───────────────────────────────────────────────────────────────────

/** @type {string} Currently selected stadium id (reserved for future venue-specific transit filtering) */
// eslint-disable-next-line no-unused-vars
let currentStadiumId = STADIUMS[0].id;

/** @type {string} Currently selected travel mode id */
let currentModeId = 'transit';

// ─── Stadium selector ─────────────────────────────────────────────────────────

/** Populates the stadium dropdown. */
function renderStadiumSelect() {
  const select = document.getElementById('transportStadiumSelect');
  if (!select) return;
  select.innerHTML = STADIUMS.map((s) =>
    `<option value="${s.id}">${s.commonName} — ${s.city}</option>`,
  ).join('');
  select.addEventListener('change', (e) => {
    currentStadiumId = e.target.value;
    renderTransitLines();
  });
}

// ─── Travel mode comparison ───────────────────────────────────────────────────

/** Renders the travel mode comparison cards. */
function renderModes() {
  const grid = document.getElementById('modeGrid');
  if (!grid) return;

  grid.innerHTML = TRAVEL_MODES.map((m) => `
    <div class="mode-card${m.id === currentModeId ? ' selected' : ''}" data-mode="${m.id}"
         role="radio" tabindex="0" aria-checked="${m.id === currentModeId}" aria-label="${m.name}">
      <div class="mode-icon" aria-hidden="true">${m.icon}</div>
      <div class="mode-name">${m.name}</div>
      <div class="mode-eta">~${m.etaMin} min</div>
      <div class="mode-co2">${m.co2Kg > 0 ? `${m.co2Kg} kg CO₂/fan` : 'Zero emissions'}</div>
    </div>`).join('');

  grid.querySelectorAll('.mode-card').forEach((card) => {
    const select = () => { currentModeId = card.dataset.mode; renderModes(); calculateDeparture(); };
    card.addEventListener('click', select);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
  });
}

// ─── Departure planner ────────────────────────────────────────────────────────

/** Calculates and renders the recommended departure time based on kickoff. */
function calculateDeparture() {
  const kickoffInput = document.getElementById('kickoffTime');
  const resultEl      = document.getElementById('departureResult');
  if (!kickoffInput || !resultEl) return;

  const mode = TRAVEL_MODES.find((m) => m.id === currentModeId);
  const kickoffValue = kickoffInput.value;
  if (!kickoffValue) { resultEl.classList.add('hidden'); return; }

  const [hours, minutes] = kickoffValue.split(':').map(Number);
  const kickoff = new Date();
  kickoff.setHours(hours, minutes, 0, 0);

  const departure = new Date(kickoff.getTime() - (mode.etaMin + ARRIVAL_BUFFER_MIN) * 60_000);
  const timeStr = departure.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `
    <div>
      <div class="departure-time">${timeStr}</div>
      <div class="departure-label">Recommended departure via ${mode.name}</div>
    </div>
    <div style="font-size:0.85rem;color:var(--text-muted);flex:1;">
      Includes ~${mode.etaMin} min travel time plus ${ARRIVAL_BUFFER_MIN} min for security screening and entry, so you're seated well before kickoff.
    </div>`;
}

// ─── Transit line status ──────────────────────────────────────────────────────

/** Renders simulated live transit line status for the selected venue. */
function renderTransitLines() {
  const list = document.getElementById('transitLineList');
  if (!list) return;

  list.innerHTML = TRANSIT_LINES.map((line) => `
    <div class="transit-line-row" role="listitem">
      <div class="transit-line-badge" style="background:${line.color}">${line.name.charAt(0)}</div>
      <div class="transit-line-info">
        <div class="transit-line-name">${line.name}</div>
        <div class="transit-line-detail">${line.detail}</div>
      </div>
      <span class="transit-status ${line.status}">${line.status}</span>
    </div>`).join('');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

renderStadiumSelect();
renderModes();
renderTransitLines();
document.getElementById('kickoffTime')?.addEventListener('change', calculateDeparture);
document.getElementById('kickoffTime')?.addEventListener('input', calculateDeparture);