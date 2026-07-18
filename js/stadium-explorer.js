/**
 * @fileoverview Stadium Explorer page controller
 * @description Renders the stadium list sidebar, wires stadium selection to
 *              the Three.js 3D viewer (stadium-3d.js), and displays live
 *              venue facts. Manages scene disposal when switching stadiums
 *              to prevent WebGL context leaks.
 * @module stadium-explorer
 */

'use strict';

import { STADIUMS, getStadiumById } from './stadiums-data.js';
import { createStadiumScene, resizeStadiumScene } from './stadium-3d.js';
import { formatPersons, throttleRaf } from './shared.js';

/** @type {ReturnType<typeof createStadiumScene>|null} */
let activeScene = null;

/** @type {number|null} rAF handle for the render loop */
let renderLoopHandle = null;

/** @type {string} Currently displayed stadium id */
let currentStadiumId = STADIUMS[0].id;

// ─── Sidebar list ─────────────────────────────────────────────────────────────

const FLAGS = Object.freeze({ 'United States': '🇺🇸', Mexico: '🇲🇽', Canada: '🇨🇦' });

/**
 * Builds the HTML string for one sidebar item.
 * @param {import('./stadiums-data.js').Stadium} s
 * @param {boolean} selected
 * @returns {string}
 */
function stadiumItemHTML(s, selected) {
  return `
    <div class="stadium-list-item${selected ? ' selected' : ''}"
         role="option" tabindex="0" data-id="${s.id}"
         aria-selected="${selected}"
         aria-label="${s.commonName}, ${s.city}">
      <span class="stadium-list-flag" aria-hidden="true">${FLAGS[s.country] ?? '🏟️'}</span>
      <div class="stadium-list-info">
        <div class="stadium-list-name">${s.commonName}</div>
        <div class="stadium-list-city">${s.city}</div>
      </div>
      <span class="stadium-list-tier ${s.tier}" aria-label="${s.tier} venue">${s.tier}</span>
    </div>`;
}

/**
 * Initial render of the full stadium list.
 * Subsequent selection changes use updateStadiumListSelection() for efficiency.
 */
function renderStadiumList() {
  const list = document.getElementById('stadiumList');
  if (!list) return;

  // `role="listbox"` with `aria-multiselectable="false"` is correct for a
  // single-selection list of `role="option"` items.
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-multiselectable', 'false');

  list.innerHTML = STADIUMS.map((s) => stadiumItemHTML(s, s.id === currentStadiumId)).join('');

  list.querySelectorAll('.stadium-list-item').forEach((item) => {
    item.addEventListener('click', () => selectStadium(item.dataset.id));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectStadium(item.dataset.id); }
    });
  });
}

/**
 * Updates only the two affected items' selected state without re-rendering
 * the full list — avoids detaching/re-attaching all 16 DOM nodes on every click.
 * @param {string} prevId - Previously selected stadium id
 * @param {string} nextId - Newly selected stadium id
 */
function updateStadiumListSelection(prevId, nextId) {
  const list = document.getElementById('stadiumList');
  if (!list) return;

  [prevId, nextId].forEach((id) => {
    const el = list.querySelector(`[data-id="${id}"]`);
    if (!el) return;
    const isSelected = id === nextId;
    el.classList.toggle('selected', isSelected);
    el.setAttribute('aria-selected', String(isSelected));
  });
}

// ─── Stadium selection & 3D scene lifecycle ──────────────────────────────────

/**
 * Selects a stadium: updates the sidebar highlight, rebuilds the 3D scene,
 * and refreshes the facts panel.
 * @param {string} id - Stadium slug
 */
function selectStadium(id) {
  const stadium = getStadiumById(id);
  if (!stadium) return;

  const prevId = currentStadiumId;
  currentStadiumId = id;
  updateStadiumListSelection(prevId, id);
  renderFacts(stadium);
  buildScene(stadium);
}

/**
 * Tears down any existing 3D scene and builds a fresh one for the given
 * stadium. Disposal prevents WebGL context accumulation when switching
 * between venues repeatedly.
 * @param {import('./stadiums-data.js').Stadium} stadium
 */
function buildScene(stadium) {
  const wrap = document.getElementById('stadium3dWrap');
  if (!wrap) return;

  if (renderLoopHandle) cancelAnimationFrame(renderLoopHandle);
  if (activeScene) activeScene.dispose();

  wrap.innerHTML = `
    <div class="stadium-3d-loading" id="viewerLoading">
      <div class="loading-spinner" role="status" aria-label="Loading 3D model"></div>
      <p>Building ${stadium.commonName}...</p>
    </div>`;

  // Defer scene creation one frame so the loading state paints first.
  requestAnimationFrame(() => {
    wrap.innerHTML = '';
    activeScene = createStadiumScene(wrap, stadium);
    startRenderLoop();
    wireTierButtons();
  });
}

/** Starts the continuous render loop for the active scene. */
function startRenderLoop() {
  function loop() {
    activeScene?.tick();
    renderLoopHandle = requestAnimationFrame(loop);
  }
  loop();
}

/** Wires the Lower/Club/Upper tier camera buttons to the active scene. */
function wireTierButtons() {
  document.querySelectorAll('.viewer-control-btn[data-tier]').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.viewer-control-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeScene?.flyToZone(parseInt(btn.dataset.tier, 10));
    };
  });
}

// ─── Facts panel ──────────────────────────────────────────────────────────────

/**
 * Renders the venue name, meta line, fact cards and highlight blurb.
 * @param {import('./stadiums-data.js').Stadium} stadium
 */
function renderFacts(stadium) {
  const nameEl = document.getElementById('viewerStadiumName');
  const metaEl = document.getElementById('viewerStadiumMeta');
  const factsEl = document.getElementById('stadiumFacts');
  const highlightEl = document.getElementById('stadiumHighlight');

  if (nameEl) nameEl.textContent = stadium.commonName;
  if (metaEl) metaEl.textContent = `${stadium.fifaName} · ${stadium.city}, ${stadium.country}`;

  if (factsEl) {
    factsEl.innerHTML = [
      { label: 'Capacity', value: formatPersons(stadium.capacity) },
      { label: 'Tournament Role', value: capitalize(stadium.tier) },
      { label: 'Roof', value: capitalize(stadium.roofType) },
      { label: 'Surface', value: capitalize(stadium.surface) },
      { label: 'Elevation', value: `${stadium.elevationM} m` },
    ].map((f) => `
      <div class="fact-card">
        <div class="fact-label">${f.label}</div>
        <div class="fact-value">${f.value}</div>
      </div>`).join('');
  }

  if (highlightEl) {
    highlightEl.innerHTML = `<strong>Did you know?</strong> ${stadium.highlight}`;
  }
}

/**
 * Capitalises the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Resize handling ──────────────────────────────────────────────────────────

const handleResize = throttleRaf(() => {
  if (!activeScene) return;
  const wrap = document.getElementById('stadium3dWrap');
  if (wrap) resizeStadiumScene(activeScene.camera, activeScene.renderer, wrap);
});
window.addEventListener('resize', handleResize);

// ─── Init ─────────────────────────────────────────────────────────────────────

renderStadiumList();
selectStadium(currentStadiumId);