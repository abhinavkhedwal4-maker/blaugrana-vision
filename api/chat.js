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
    sanitized.push({ role: msg.role, content: sanitizeString(msg.content) });
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
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

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

    res.status(200).json({ reply });
  } catch (err) {
    console.error('[Groq Proxy Error]', err.message);
    res.status(502).json({ error: 'Failed to reach AI service. Please try again.' });
  }
}