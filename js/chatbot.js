/**
 * @fileoverview Blaugrana Vision AI Chatbot
 * @description Multilingual GenAI assistant covering navigation, crowd
 *              conditions, transport, accessibility and stadium facts —
 *              proxied securely through /api/chat (Groq).
 * @module chatbot
 */

'use strict';

import { logError } from './errors.js';
import { sanitizeString, formatMessage, sanitizePromptInjection } from './shared.js';

const ENDPOINT       = '/api/chat';
const MAX_MSG_LENGTH = 500;
const RATE_LIMIT     = 10;
const RATE_WINDOW_MS = 60_000;

/** Maps BCP-47 language codes to full language names for AI instruction */
const LANGUAGE_NAMES = Object.freeze({
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
  zh: 'Mandarin Chinese',
  ar: 'Arabic',
});

const SYSTEM_PROMPT = `You are Blaugrana AI, the official GenAI assistant for Blaugrana Vision at the FIFA World Cup 2026. Help fans, volunteers and organisers with:
- Navigation to seats, gates, concessions and accessible routes
- Real-time crowd conditions and safety guidance
- Transport and arrival planning around match schedules
- Accessibility services (wheelchair routing, sensory-friendly zones, assistance requests)
- Sustainability and green-travel tips
- Facts about all 16 FIFA World Cup 2026 host stadiums

Guidelines:
- Be concise, warm, and immediately useful — assume the fan may be in a crowded stadium right now
- Use simple language accessible to non-native English speakers
- Offer to translate or respond in other languages if asked
- Keep responses to 3-4 short paragraphs maximum
- End with one clear, actionable next step`;

/** @type {ChatMessage[]} */
let conversationHistory = [];

/** @type {Array<number>} */
const messageTimes = [];

/** @type {boolean} */
let isProcessing = false;

/** @type {AbortController|null} — cancels any in-flight AI request */
let activeController = null;

/**
 * Checks the client-side rate limit.
 * @returns {boolean}
 */
function checkClientRateLimit() {
  const now    = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  while (messageTimes.length > 0 && messageTimes[0] < cutoff) messageTimes.shift();
  if (messageTimes.length >= RATE_LIMIT) return false;
  messageTimes.push(now);
  return true;
}

/**
 * Validates a message before sending.
 * @param {string} message
 * @returns {{valid:boolean, error?:string}}
 */
function validateMessage(message) {
  if (!message || typeof message !== 'string')  return { valid: false, error: 'Please enter a message.' };
  if (message.trim().length === 0)              return { valid: false, error: 'Message cannot be empty.' };
  if (message.length > MAX_MSG_LENGTH)          return { valid: false, error: `Maximum ${MAX_MSG_LENGTH} characters.` };
  return { valid: true };
}

/**
 * Appends a chat bubble to the messages container.
 * @param {'user'|'ai'} role
 * @param {string} text
 */
function appendMessage(role, text) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.setAttribute('role', 'article');
  bubble.setAttribute('aria-label', `${role === 'ai' ? 'Blaugrana AI' : 'You'}: ${text.slice(0, 50)}`);

  const avatar = document.createElement('div');
  avatar.className = 'bubble-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = role === 'ai' ? '⚽' : 'YOU';

  const content = document.createElement('div');
  content.className = 'bubble-content';
  if (role === 'user') {
    const p = document.createElement('p');
    p.textContent = text;
    content.appendChild(p);
  } else {
    // WCAG 3.1.2 — mark AI response with the correct language and direction
    const langAttr = window.blaugranaLang && window.blaugranaLang !== 'en'
      ? window.blaugranaLang
      : 'en';
    const dirAttr = langAttr === 'ar' ? 'rtl' : 'ltr';
    content.setAttribute('lang', langAttr);
    content.setAttribute('dir', dirAttr);
    content.innerHTML = formatMessage(text);
  }

  bubble.appendChild(avatar);
  bubble.appendChild(content);
  container.appendChild(bubble);
  requestAnimationFrame(() => bubble.scrollIntoView({ behavior: 'smooth', block: 'end' }));
}

/**
 * Shows a typing indicator bubble.
 * @returns {string|null} The bubble's element ID, or null if container missing
 */
function showTyping() {
  const container = document.getElementById('chatMessages');
  if (!container) return null;

  const id = `typing-${Date.now()}`;
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ai';
  bubble.id = id;
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-label', 'Blaugrana AI is thinking...');
  bubble.innerHTML = `
    <div class="bubble-avatar" aria-hidden="true">⚽</div>
    <div class="bubble-content bubble-content--typing">
      <div class="typing-indicator" aria-hidden="true">
        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
      </div>
    </div>`;
  container.appendChild(bubble);
  requestAnimationFrame(() => bubble.scrollIntoView({ behavior: 'smooth', block: 'end' }));
  return id;
}

/**
 * Removes a typing indicator bubble.
 * @param {string|null} id
 */
function removeTyping(id) {
  if (id) document.getElementById(id)?.remove();
}

/**
 * Sets the send button's disabled/busy state.
 * @param {boolean} disabled
 */
function setSendButtonState(disabled) {
  const btn = document.getElementById('sendBtn');
  if (!btn) return;
  btn.disabled = disabled;
  btn.setAttribute('aria-busy', String(disabled));
  btn.setAttribute('aria-label', disabled ? 'Sending...' : 'Send message');
}

/**
 * Announces a message to screen readers via a live region.
 * @param {string} message
 */
function announceToScreenReader(message) {
  let el = document.getElementById('sr-announcer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sr-announcer';
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('aria-atomic', 'true');
    el.className = 'sr-only';
    document.body.appendChild(el);
  }
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = message; });
}

/**
 * Sends the current chat input to Blaugrana AI and renders the response.
 * @returns {Promise<void>}
 */
async function sendMessage() {
  if (isProcessing) return;

  const input = document.getElementById('chatInput');
  if (!input) return;

  const rawText    = input.value;
  const validation = validateMessage(rawText);
  if (!validation.valid) { announceToScreenReader(validation.error); return; }

  if (!checkClientRateLimit()) {
    appendMessage('ai', "⚠️ You're sending messages too quickly. Please wait a moment.");
    return;
  }

  const message = sanitizeString(sanitizePromptInjection(rawText), MAX_MSG_LENGTH);
  isProcessing  = true;

  appendMessage('user', rawText.trim());
  input.value = '';
  autoResize(input);
  setSendButtonState(true);

  conversationHistory.push({ role: 'user', content: message });
  const typingId = showTyping();

  // Cancel any prior request that was still in flight
  activeController?.abort();
  activeController = new AbortController();

  try {
    const langNote = window.blaugranaLang && window.blaugranaLang !== 'en'
      ? ` Respond in ${LANGUAGE_NAMES[window.blaugranaLang]} unless the user writes in English.`
      : '';

    const response = await fetch(ENDPOINT, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal : activeController.signal,
      body   : JSON.stringify({
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}${langNote}` },
          ...conversationHistory,
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${response.status}`);
    }

    const data  = await response.json();
    const reply = data.reply;
    if (!reply || typeof reply !== 'string') throw new Error('Empty response from Blaugrana AI.');

    conversationHistory.push({ role: 'assistant', content: reply });
    removeTyping(typingId);
    appendMessage('ai', reply);
    announceToScreenReader('Blaugrana AI responded.');
  } catch (error) {
    removeTyping(typingId);
    appendMessage('ai', `⚠️ ${error.message} Make sure the server is running.`);
    conversationHistory.pop();
    logError('Blaugrana AI', 'Message send', error);
  } finally {
    isProcessing = false;
    setSendButtonState(false);
    input.focus();
  }
}

window.sendSuggestion = function sendSuggestion(text) {
  const input = document.getElementById('chatInput');
  if (!input || isProcessing) return;
  input.value = text;
  autoResize(input);
  sendMessage();
};

window.sendMessage = sendMessage;

window.handleChatKey = function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
};

window.autoResize = function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
};

window.clearChat = function clearChat() {
  conversationHistory = [];
  const container = document.getElementById('chatMessages');
  if (!container) return;
  container.innerHTML = `
    <div class="chat-bubble ai" role="article">
      <div class="bubble-avatar" aria-hidden="true">⚽</div>
      <div class="bubble-content"><p>Chat cleared! How can I help you at the World Cup today?</p></div>
    </div>`;
  announceToScreenReader('Chat cleared.');
};