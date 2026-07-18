/**
 * @fileoverview Operations Command Centre page controller
 * @description Unified real-time-style venue status table for organisers,
 *              a lightweight incident logging tool (Firestore-backed when
 *              signed in), and an AI-generated operations briefing.
 * @module operations
 */

'use strict';

import { STADIUMS, VENUE_STATS } from './stadiums-data.js';
import { db, auth } from './firebase.js';
import { initAuth } from './auth.js';
import { sanitizeString } from './shared.js';
import {
  collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/** Firestore collection name for logged incidents */
const INCIDENTS_COLLECTION = 'incidents';

/** Maximum incidents shown in the log at once */
const MAX_INCIDENTS_DISPLAYED = 15;

/** Simulated venue operational status — illustrative for the demo */
const STATUS_LEVELS = Object.freeze(['normal', 'watch', 'alert']);

// ─── State ───────────────────────────────────────────────────────────────────

/** @type {Array<{stadiumId:string, status:string}>} */
const venueStatuses = STADIUMS.map((s, i) => ({
  stadiumId: s.id,
  status: STATUS_LEVELS[i % STATUS_LEVELS.length === 2 && i % 5 !== 0 ? 0 : i % STATUS_LEVELS.length],
}));

// ─── Venue status table ───────────────────────────────────────────────────────

/** Renders the organiser-facing venue status table across all 16 venues. */
function renderVenueTable() {
  const table = document.getElementById('venueStatusTable');
  if (!table) return;

  const statusColor = { normal: 'var(--green)', watch: 'var(--gold)', alert: 'var(--crimson-bright)' };

  const rows = STADIUMS.map((s) => {
    const status = venueStatuses.find((v) => v.stadiumId === s.id)?.status ?? 'normal';
    return `
      <div class="venue-status-row" role="row">
        <span><span class="venue-status-dot" style="background:${statusColor[status]}"></span>${s.commonName}</span>
        <span>${s.city}</span>
        <span>${s.capacity.toLocaleString('en-US')}</span>
        <span style="color:${statusColor[status]};font-weight:700;text-transform:capitalize;">${status}</span>
      </div>`;
  }).join('');

  table.innerHTML = `
    <div class="venue-status-row header" role="row">
      <span>Venue</span><span>City</span><span>Capacity</span><span>Status</span>
    </div>
    ${rows}`;
}

/** Renders the aggregate tournament-wide summary strip as icon-led stat cards. */
function renderSummaryStrip() {
  const el = document.getElementById('opsCommandSummary');
  if (!el) return;

  const stats = [
    { icon: '🏟️', label: 'Total Venues',      value: STADIUMS.length },
    { icon: '👥', label: 'Combined Capacity',  value: VENUE_STATS.totalCapacity.toLocaleString('en-US') },
    { icon: '🌎', label: 'Host Nations',        value: VENUE_STATS.countries },
    { icon: '🏆', label: 'Largest Venue',       value: VENUE_STATS.largest.commonName },
  ];

  el.innerHTML = stats.map((s) => `
    <div class="ops-stat-card">
      <div class="ops-stat-icon" aria-hidden="true">${s.icon}</div>
      <div class="ops-stat-label">${s.label}</div>
      <div class="ops-stat-value">${s.value}</div>
    </div>`).join('');
}

// ─── Incident logging ─────────────────────────────────────────────────────────

/** Populates the incident form's stadium dropdown. */
function renderIncidentStadiumSelect() {
  const select = document.getElementById('incidentStadium');
  if (!select) return;
  select.innerHTML = STADIUMS.map((s) => `<option value="${s.id}">${s.commonName}</option>`).join('');
}

/** Wires the incident logging form. */
function wireIncidentForm() {
  const form = document.getElementById('incidentForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const stadiumSelect = document.getElementById('incidentStadium');
    const detailsEl      = document.getElementById('incidentDetails');
    const details         = sanitizeString(detailsEl?.value ?? '', 300);
    if (!details) return;

    const stadium = STADIUMS.find((s) => s.id === stadiumSelect?.value) ?? STADIUMS[0];
    await logIncident(stadium.commonName, details);
    form.reset();
    await renderIncidentLog();
  });
}

/**
 * Logs an incident to Firestore if authenticated; always appends locally.
 * @param {string} venueName
 * @param {string} details
 * @returns {Promise<void>}
 */
async function logIncident(venueName, details) {
  appendLocalIncident(venueName, details);

  if (!auth.currentUser) return;
  try {
    await addDoc(collection(db, INCIDENTS_COLLECTION), {
      venueName, details, reportedBy: auth.currentUser.uid, createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[Operations] Incident log error:', err.message);
  }
}

/**
 * Appends an incident to the on-screen log immediately (optimistic UI).
 * @param {string} venueName
 * @param {string} details
 */
function appendLocalIncident(venueName, details) {
  const log = document.getElementById('incidentLog');
  if (!log) return;

  const item = document.createElement('div');
  item.className = 'incident-item';
  item.innerHTML = `
    <div class="incident-time">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} — ${venueName}</div>
    <div>${details}</div>`;
  log.prepend(item);

  while (log.children.length > MAX_INCIDENTS_DISPLAYED) log.removeChild(log.lastChild);
}

/** Loads recent incidents from Firestore, if available. */
async function renderIncidentLog() {
  const log = document.getElementById('incidentLog');
  if (!log || !auth.currentUser) return;

  try {
    const q = query(collection(db, INCIDENTS_COLLECTION), orderBy('createdAt', 'desc'), limit(MAX_INCIDENTS_DISPLAYED));
    const snap = await getDocs(q);
    log.innerHTML = snap.docs.map((doc) => {
      const d = doc.data();
      return `
        <div class="incident-item">
          <div class="incident-time">${d.venueName}</div>
          <div>${d.details}</div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('[Operations] Incident fetch error:', err.message);
  }
}

// ─── AI briefing ──────────────────────────────────────────────────────────────

/** Requests a GenAI-authored operations briefing summarising current status. */
window.requestBriefing = async function requestBriefing() {
  const panel = document.getElementById('briefingContent');
  if (!panel) return;

  panel.innerHTML = '<p style="color:var(--text-muted)">Generating briefing...</p>';

  const alertVenues = venueStatuses.filter((v) => v.status === 'alert')
    .map((v) => STADIUMS.find((s) => s.id === v.stadiumId)?.commonName).filter(Boolean);
  const watchVenues = venueStatuses.filter((v) => v.status === 'watch')
    .map((v) => STADIUMS.find((s) => s.id === v.stadiumId)?.commonName).filter(Boolean);

  const prompt = `Tournament-wide status: ${STADIUMS.length} venues monitored.
Venues at ALERT level: ${alertVenues.join(', ') || 'none'}.
Venues at WATCH level: ${watchVenues.join(', ') || 'none'}.

As a tournament operations director, write a 3-sentence executive briefing for organisers summarising the current state and top priority.`;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a FIFA World Cup 2026 tournament operations director. Be concise and direct.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { reply } = await res.json();
    panel.innerHTML = `<p>${reply}</p>`;
  } catch (err) {
    console.error('[Operations] Briefing error:', err.message);
    panel.innerHTML = '<p style="color:var(--text-muted)">⚠️ Could not generate briefing. Make sure the server is running.</p>';
  }
};

// ─── Init ─────────────────────────────────────────────────────────────────────

renderVenueTable();
renderSummaryStrip();
renderIncidentStadiumSelect();
wireIncidentForm();
initAuth(() => renderIncidentLog(), () => {});