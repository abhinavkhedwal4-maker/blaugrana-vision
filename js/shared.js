/**
 * @fileoverview Blaugrana Vision — Shared Frontend Utilities
 * @description Common functions used across the navigator, crowd-ops,
 *              transport, accessibility, sustainability and operations
 *              modules. Centralising these avoids duplication and keeps
 *              behaviour consistent app-wide.
 * @module shared
 */

'use strict';

/** Maximum length allowed for any sanitised user-facing string */
const DEFAULT_MAX_LENGTH = 2000;

/**
 * Sanitises a string to prevent XSS injection by escaping HTML special
 * characters. Iterates character-by-character rather than chained
 * `.replace()` calls to avoid double-escaping edge cases.
 *
 * @param {string} str          - Raw input string
 * @param {number} [maxLength]  - Maximum allowed output length
 * @returns {string} Sanitised string, truncated to maxLength
 */
export function sanitizeString(str, maxLength = DEFAULT_MAX_LENGTH) {
  if (typeof str !== 'string') return '';

  const ESCAPE_MAP = Object.freeze({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  });

  let result = '';
  for (const ch of str) {
    result += ESCAPE_MAP[ch] || ch;
  }
  return result.slice(0, maxLength);
}

/**
 * Formats AI-generated message text with markdown-lite rendering.
 * Supports bold, italic, inline code, and paragraph breaks.
 *
 * @param {string} text - Raw message text
 * @returns {string} HTML-formatted string, safe for innerHTML
 */
export function formatMessage(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, (_, code) =>
      `<code style="background:rgba(0,102,204,0.15);padding:0.1em 0.4em;border-radius:4px;font-family:monospace;">${sanitizeString(code)}</code>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

/**
 * Debounces a function — delays invocation until `delay` ms have elapsed
 * since the last call. Useful for search inputs and resize handlers.
 *
 * @template {(...args: any[]) => void} F
 * @param {F} fn      - Function to debounce
 * @param {number} [delay] - Delay in milliseconds
 * @returns {F} Debounced function
 */
export function debounce(fn, delay = 300) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttles a function to at most once per animation frame — ideal for
 * scroll and resize handlers that would otherwise fire excessively.
 *
 * @template {(...args: any[]) => void} F
 * @param {F} fn - Function to throttle
 * @returns {F} RAF-throttled function
 */
export function throttleRaf(fn) {
  let frameId = null;
  return function throttled(...args) {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(() => {
      fn(...args);
      frameId = null;
    });
  };
}

/**
 * Returns today's date as a YYYY-MM-DD key, used for daily aggregation
 * across crowd-ops and sustainability dashboards.
 * @returns {string}
 */
export function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Toggles the AI assistant chat panel open/closed and manages ARIA state.
 * Shared across all pages that include the chat panel markup.
 *
 * @returns {boolean} True if the panel is now open, false if closed
 */
export function toggleChat() {
  const panel   = document.getElementById('chatPanel');
  const overlay = document.getElementById('chatOverlay');
  const btn     = document.getElementById('chatToggleBtn');
  if (!panel) return false;

  const isOpen = panel.classList.toggle('active');

  if (overlay) {
    overlay.classList.toggle('active', isOpen);
    overlay.setAttribute('aria-hidden', String(!isOpen));
  }
  if (btn) btn.setAttribute('aria-expanded', String(isOpen));

  document.body.style.overflow = isOpen ? 'hidden' : '';

  if (isOpen) {
    const input = panel.querySelector('#chatInput');
    if (input) setTimeout(() => input.focus(), 50);
  }

  return isOpen;
}

/**
 * Shows a temporary toast notification at the bottom of the screen.
 * Creates the toast element on first call and reuses it thereafter.
 *
 * @param {string} message   - Text to display
 * @param {number} [duration]- Visible duration in milliseconds
 * @param {string} [id]      - DOM id for the toast element (allows multiple distinct toasts)
 */
export function showToast(message, duration = 3000, id = 'bvToast') {
  let toast = document.getElementById(id);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = id;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = [
      'position:fixed', 'bottom:2rem', 'left:50%',
      'transform:translateX(-50%) translateY(80px)',
      'background:var(--blau)', 'color:#fff',
      'padding:0.6rem 1.4rem', 'border-radius:50px',
      'font-weight:600', 'font-size:0.85rem', 'z-index:3000',
      'transition:transform 0.3s ease', 'pointer-events:none',
    ].join(';');
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.transform = 'translateX(-50%) translateY(0)';
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(80px)';
  }, duration);
}

/**
 * Formats a number as a locale-aware person count string (e.g. 80,824).
 * Used across crowd-ops, sustainability and stadium-explorer dashboards.
 *
 * @param {number} n - Count to format
 * @returns {string} Locale-formatted string
 */
export function formatPersons(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '0';
  return n.toLocaleString();
}

// ─── Mobile nav ───────────────────────────────────────────────────────────────

/**
 * Initialises the responsive hamburger menu by injecting the toggle button
 * into the navbar and wiring its click handler. Safe to call on every page
 * because it no-ops if the navbar is not present.
 */
function initMobileNav() {
  const navbar = document.querySelector('.navbar');
  const navLinks = document.querySelector('.nav-links');
  if (!navbar || !navLinks) return;

  const btn = document.createElement('button');
  btn.className = 'nav-hamburger';
  btn.setAttribute('aria-label', 'Toggle navigation menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'primaryNav');
  btn.setAttribute('type', 'button');
  btn.textContent = '☰';
  navLinks.id = 'primaryNav';

  const navRight = navbar.querySelector('.nav-right');
  if (navRight) navbar.insertBefore(btn, navRight);
  else navbar.appendChild(btn);

  btn.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
    btn.textContent = isOpen ? '✕' : '☰';
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!navbar.contains(e.target) && navLinks.classList.contains('open')) {
      navLinks.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = '☰';
    }
  });
}

// Expose globals so inline onclick handlers in HTML work with ES modules.
if (typeof window !== 'undefined') {
  window.toggleChat = toggleChat;
  // Auto-init mobile nav on DOMContentLoaded across every page.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
}