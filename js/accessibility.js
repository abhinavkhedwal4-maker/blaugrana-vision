/**
 * @fileoverview Accessibility Services page controller
 * @description Wheelchair routing preferences, sensory-friendly zone info,
 *              accessible amenity locator, and an assistance-request form
 *              that hands off to the AI assistant for real-time guidance.
 * @module accessibility
 */

'use strict';

import { STADIUMS, getStadiumById } from './stadiums-data.js';
import { sanitizeString, renderStadiumDropdown } from './shared.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Accessibility service categories offered at every venue */
const ACCESS_OPTIONS = Object.freeze([
  { id: 'wheelchair', icon: '♿', title: 'Wheelchair Routing', desc: 'Step-free paths to your seat, avoiding stairs and crowded pinch points.' },
  { id: 'sensory',     icon: '🔇', title: 'Sensory-Friendly Zones', desc: 'Low-noise, low-light quiet rooms away from crowd noise.' },
  { id: 'visual',      icon: '👁️', title: 'Visual Assistance', desc: 'Audio-described commentary and high-contrast wayfinding.' },
  { id: 'hearing',     icon: '👂', title: 'Hearing Assistance', desc: 'Assistive listening devices and sign-language interpreter zones.' },
  { id: 'companion',   icon: '🤝', title: 'Companion Support', desc: 'Personal care attendant seating and companion ticket guidance.' },
  { id: 'mobility',    icon: '🦽', title: 'Mobility Equipment', desc: 'Wheelchair loan, scooter charging points and equipment repair.' },
]);

/** Example accessible amenities — illustrative per-venue facility data */
const AMENITIES = Object.freeze([
  { icon: '🚻', name: 'Accessible Restroom', loc: 'Concourse Level, near Gate A', status: 'Available' },
  { icon: '🛗', name: 'Elevator to Upper Tier', loc: 'North Stairwell', status: 'Available' },
  { icon: '🔇', name: 'Sensory Room', loc: 'Family Zone, Section 112', status: 'Available' },
  { icon: '🦽', name: 'Wheelchair Loan Point', loc: 'Guest Services, Main Gate', status: 'Available' },
  { icon: '🅿️', name: 'Accessible Parking', loc: 'Lot C, closest to Gate D', status: 'Available' },
]);

// ─── State ───────────────────────────────────────────────────────────────────

/** @type {Set<string>} Currently selected access option ids */
const selectedOptions = new Set();

// ─── Access options grid ──────────────────────────────────────────────────────

/** Renders the accessibility service selector cards. */
function renderAccessOptions() {
  const grid = document.getElementById('accessOptionsGrid');
  if (!grid) return;

  grid.innerHTML = ACCESS_OPTIONS.map((opt) => `
    <div class="access-option-card${selectedOptions.has(opt.id) ? ' selected' : ''}"
         data-id="${opt.id}" role="checkbox" tabindex="0"
         aria-checked="${selectedOptions.has(opt.id)}" aria-label="${opt.title}">
      <div class="access-option-icon" aria-hidden="true">${opt.icon}</div>
      <div class="access-option-title">${opt.title}</div>
      <div class="access-option-desc">${opt.desc}</div>
    </div>`).join('');

  grid.querySelectorAll('.access-option-card').forEach((card) => {
    const toggle = () => {
      const id = card.dataset.id;
      if (selectedOptions.has(id)) selectedOptions.delete(id); else selectedOptions.add(id);
      renderAccessOptions();
    };
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
}

// ─── Stadium selector for amenities ───────────────────────────────────────────

/** Populates the stadium dropdown used by the amenity locator. */
function renderStadiumSelect() {
  renderStadiumDropdown('accessStadiumSelect', () => renderAmenities());
  renderAmenities();
}

/** Renders the accessible amenity list for the selected stadium. */
function renderAmenities() {
  const select = document.getElementById('accessStadiumSelect');
  const list   = document.getElementById('amenityList');
  const stadium = getStadiumById(select?.value ?? STADIUMS[0].id);
  if (!list || !stadium) return;

  list.innerHTML = `
    <h3 class="amenities-heading">Accessible Amenities — ${stadium.commonName}</h3>
    ${AMENITIES.map((a) => `
      <div class="amenity-row" role="listitem">
        <span class="amenity-icon" aria-hidden="true">${a.icon}</span>
        <div class="amenity-info">
          <div class="amenity-name">${a.name}</div>
          <div class="amenity-loc">${a.loc}</div>
        </div>
        <span class="amenity-badge">${a.status}</span>
      </div>`).join('')}`;
}

// ─── Assistance request form ──────────────────────────────────────────────────

/** Wires the assistance-request form submission. */
function wireAssistForm() {
  const form = document.getElementById('assistForm');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const stadiumSel = document.getElementById('assistStadium');
    const detailsEl   = document.getElementById('assistDetails');
    const stadium     = getStadiumById(stadiumSel?.value ?? STADIUMS[0].id);
    const details     = sanitizeString(detailsEl?.value ?? '', 500);

    showConfirmation(stadium, details);
    form.reset();
  });
}

/**
 * Shows an on-screen confirmation after an assistance request is submitted.
 * @param {import('./stadiums-data.js').Stadium} stadium
 * @param {string} details
 */
function showConfirmation(stadium, details) {
  const toast = document.getElementById('confirmationToast');
  if (!toast) return;

  const selectedLabels = [...selectedOptions]
    .map((id) => ACCESS_OPTIONS.find((o) => o.id === id)?.title)
    .filter(Boolean)
    .join(', ') || 'General assistance';

  toast.classList.remove('hidden');
  toast.innerHTML = `
    <span class="toast-check-icon" aria-hidden="true">✅</span>
    <div>
      <strong>Request received for ${stadium.commonName}</strong>
      <p class="toast-detail-text">
        Services: ${selectedLabels}${details ? ` — Note: "${details}"` : ''}. Guest Services has been notified and will meet you at your nearest gate.
      </p>
    </div>`;
  toast.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/** Populates the assistance form's stadium dropdown. */
function renderAssistStadiumSelect() {
  renderStadiumDropdown('assistStadium');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

renderAccessOptions();
renderStadiumSelect();
renderAssistStadiumSelect();
wireAssistForm();