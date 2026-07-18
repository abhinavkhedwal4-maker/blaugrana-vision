/**
 * @fileoverview Blaugrana Vision — Local Development Server
 * @description Secure Node.js server with rate limiting, security headers,
 *              input validation and a Groq API proxy. Mirrors the
 *              behaviour of api/chat.js so `npm start` works identically
 *              to the Vercel production deployment.
 * @version 1.0.0
 *
 * NOTE: Code duplication between server.js and api/chat.js is intentional.
 * They use different module systems (CommonJS vs ES modules) and run in
 * different environments (Node.js vs Vercel serverless). Sharing code would
 * require a build pipeline — this keeps deployment simple and dependency-free.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PORT        = parseInt(process.env.PORT, 10) || 3000;
const MAX_BODY    = 1024 * 50;
const RATE_WINDOW = 60 * 1000;
const RATE_LIMIT  = 30;

/** @type {Map<string, {count:number, reset:number}>} */
const rateLimitStore = new Map();

const MIME_TYPES = Object.freeze({
  '.html' : 'text/html; charset=utf-8',
  '.css'  : 'text/css; charset=utf-8',
  '.js'   : 'application/javascript; charset=utf-8',
  '.json' : 'application/json; charset=utf-8',
  '.png'  : 'image/png',
  '.jpg'  : 'image/jpeg',
  '.jpeg' : 'image/jpeg',
  '.svg'  : 'image/svg+xml',
  '.ico'  : 'image/x-icon',
  '.webp' : 'image/webp',
});

/**
 * Applies security headers to every response.
 * @param {http.ServerResponse} res
 */
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Checks and updates the rate limit counter for a given IP.
 * @param {string} ip
 * @returns {boolean} True if the request is allowed
 */
function checkRateLimit(ip) {
  const now    = Date.now();
  const record = rateLimitStore.get(ip);
  if (!record || now > record.reset) {
    rateLimitStore.set(ip, { count: 1, reset: now + RATE_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.reset) rateLimitStore.delete(ip);
  }
}, 5 * 60 * 1000);

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
    .slice(0, 2000);
}

/**
 * Validates the messages array sent to the chat endpoint.
 * @param {Array} messages
 * @returns {{valid:boolean, sanitized?:Array, error?:string}}
 */
function validateMessages(messages) {
  if (!Array.isArray(messages))      return { valid: false, error: 'Messages must be an array' };
  if (messages.length === 0)         return { valid: false, error: 'Messages array is empty' };
  if (messages.length > 50)          return { valid: false, error: 'Too many messages' };

  const validRoles = new Set(['user', 'assistant', 'system']);
  const sanitized  = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') return { valid: false, error: 'Invalid message object' };
    if (!validRoles.has(msg.role))       return { valid: false, error: `Invalid role: ${msg.role}` };
    if (typeof msg.content !== 'string') return { valid: false, error: 'Content must be string' };
    if (!msg.content.trim())             return { valid: false, error: 'Content cannot be empty' };
    sanitized.push({ role: msg.role, content: sanitizeString(msg.content) });
  }

  return { valid: true, sanitized };
}

/**
 * Handles POST /api/chat — proxies validated requests to the Groq API.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @returns {Promise<void>}
 */
async function handleChatAPI(req, res) {
  const body = await readRequestBody(req);

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    respondJSON(res, 400, { error: 'Invalid JSON in request body' });
    return;
  }

  const validation = validateMessages(parsed.messages);
  if (!validation.valid) {
    console.error('[Validation Error]', validation.error);
    respondJSON(res, 400, { error: validation.error });
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    console.error('[Config Error] GROQ_API_KEY not set');
    respondJSON(res, 503, { error: 'AI service not configured' });
    return;
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
      console.error('[Groq Error]', data.error?.message);
      respondJSON(res, groqRes.status, { error: data.error?.message || 'Groq API error' });
      return;
    }

    const reply = data.choices?.[0]?.message?.content;
    if (!reply) {
      respondJSON(res, 500, { error: 'Empty AI response' });
      return;
    }

    respondJSON(res, 200, { reply });
  } catch (err) {
    console.error('[Groq Fetch Error]', err.message);
    respondJSON(res, 502, { error: 'Failed to reach AI service' });
  }
}

/**
 * Reads and size-limits the incoming request body.
 * @param {http.IncomingMessage} req
 * @returns {Promise<string>}
 */
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new Error('Request body too large')); return; }
      data += chunk.toString();
    });
    req.on('end',   () => resolve(data));
    req.on('error', (err) => reject(err));
  });
}

/**
 * Sends a JSON response with the given status code.
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {Object} payload
 */
function respondJSON(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

/** @type {Map<string, Buffer>} */
const fileCache = new Map();

/**
 * Serves a static file with path-traversal protection and caching.
 * @param {string} filePath
 * @param {http.ServerResponse} res
 */
function serveStaticFile(filePath, res) {
  const resolved = path.resolve(filePath);
  const cwd      = path.resolve('.');
  if (!resolved.startsWith(cwd)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext         = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  if (fileCache.has(filePath)) {
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' });
    res.end(fileCache.get(filePath));
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
      res.end(err.code === 'ENOENT' ? '404 Not Found' : 'Internal Server Error');
      return;
    }
    fileCache.set(filePath, content);
    res.writeHead(200, {
      'Content-Type' : contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  applySecurityHeaders(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const ip = req.socket.remoteAddress || 'unknown';
  if (req.url.startsWith('/api/') && !checkRateLimit(ip)) {
    respondJSON(res, 429, { error: 'Too many requests. Please slow down.' });
    return;
  }

  if (req.url === '/api/chat' && req.method === 'POST') {
    try {
      await handleChatAPI(req, res);
    } catch (err) {
      console.error('[Server Error]', err);
      if (!res.headersSent) respondJSON(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = `.${path.normalize(`/${urlPath}`)}`;
  serveStaticFile(filePath, res);
});

server.listen(PORT, () => {
  const groq  = process.env.GROQ_API_KEY ? '✅ Loaded' : '❌ Missing — check .env';
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const lines = [
    '⚽ Blaugrana Vision v1.0',
    `URL:   http://localhost:${PORT}`,
    `Groq:  ${groq}`,
    `Model: ${model}`,
  ];

  const width = Math.max(...lines.map((l) => [...l].length)) + 4;
  const pad   = (str) => `║  ${str}${' '.repeat(width - [...str].length - 2)}║`;
  const bar   = '═'.repeat(width);

  console.log(`\n╔${bar}╗`);
  lines.forEach((l, i) => {
    console.log(pad(l));
    if (i === 0) console.log(`╠${bar}╣`);
  });
  console.log(`╚${bar}╝\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} in use.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

module.exports = { validateMessages, sanitizeString, checkRateLimit };