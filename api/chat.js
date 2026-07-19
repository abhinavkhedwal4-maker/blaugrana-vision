/**
 * @fileoverview Blaugrana Vision — Vercel Serverless Function
 * @description Secure Groq API proxy with input validation. Deployed at
 *              /api/chat via vercel.json rewrite — the only backend
 *              component running in production.
 */

'use strict';

const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_MESSAGES = 50;
const MAX_CONTENT  = 2000;

/**
 * Neutralizes common prompt-injection patterns before the content
 * reaches the AI model. Defense-in-depth layer — the same filter
 * also runs client-side in js/shared.js.
 * @param {string} str - Raw message content
 * @returns {string} Content with injection patterns replaced by [filtered]
 */
function sanitizePromptInjection(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/ignore (all |previous |prior )?instructions/gi, '[filtered]')
    .replace(/disregard (all |previous |your )?(prompts|instructions)/gi, '[filtered]')
    .replace(/new instructions\s*:/gi, '[filtered]')
    .replace(/system\s*:/gi, '[filtered]')
    .replace(/you are now/gi, '[filtered]')
    .replace(/\[INST\]|<\|im_start\|>/gi, '[filtered]')
    .replace(/act as (a |an )?(different|new|unrestricted|jailbreak)/gi, '[filtered]')
    .replace(/pretend (you are|to be)/gi, '[filtered]')
    .replace(/forget (all |your |previous )?instructions/gi, '[filtered]')
    .replace(/override (your )?(system|safety|guidelines)/gi, '[filtered]')
    .replace(/developer mode/gi, '[filtered]')
    .replace(/jailbreak/gi, '[filtered]');
}

/**
 * Sanitises a string to prevent XSS injection.
 * @param {string} str
 * @returns {string}
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, MAX_CONTENT);
}

/**
 * Validates the incoming messages array.
 * @param {*} messages
 * @returns {{valid:boolean, sanitized?:Array, error?:string}}
 */
function validateMessages(messages) {
  if (!Array.isArray(messages))       return { valid: false, error: 'messages must be an array' };
  if (messages.length === 0)          return { valid: false, error: 'messages array is empty' };
  if (messages.length > MAX_MESSAGES) return { valid: false, error: 'too many messages' };

  const validRoles = new Set(['user', 'assistant', 'system']);
  const sanitized  = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') return { valid: false, error: 'invalid message object' };
    if (!validRoles.has(msg.role))       return { valid: false, error: `invalid role: ${msg.role}` };
    if (typeof msg.content !== 'string') return { valid: false, error: 'content must be string' };
    if (!msg.content.trim())             return { valid: false, error: 'content cannot be empty' };
    sanitized.push({ role: msg.role, content: sanitizeString(sanitizePromptInjection(msg.content)) });
  }

  return { valid: true, sanitized };
}

/**
 * Vercel serverless handler for the /api/chat endpoint.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.gstatic.com https://apis.google.com; " +
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; " +
    "font-src https://fonts.gstatic.com; " +
    "connect-src 'self' https://api.groq.com https://*.googleapis.com https://*.firebaseio.com https://www.gstatic.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; " +
    "frame-src https://blaugrana-vision.firebaseapp.com https://accounts.google.com; " +
    "img-src 'self' data: https://*.googleusercontent.com;");
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    res.status(415).json({ error: 'Content-Type must be application/json' });
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    res.status(503).json({ error: 'AI service not configured' });
    return;
  }

  const validation = validateMessages(req.body?.messages);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  try {
    const groqRes = await fetch(GROQ_URL, {
      method : 'POST',
      headers: {
        Authorization : `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model      : process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages   : validation.sanitized,
        temperature: 0.6,
        max_tokens : 800,
        stream     : false,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      res.status(groqRes.status).json({ error: data.error?.message || 'Groq API error' });
      return;
    }

    const reply = data.choices?.[0]?.message?.content;
    if (!reply) { res.status(500).json({ error: 'Empty AI response' }); return; }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ reply });
  } catch (err) {
    console.error('[Groq Proxy Error]', err.message);
    res.status(502).json({ error: 'Failed to reach AI service. Please try again.' });
  }
}