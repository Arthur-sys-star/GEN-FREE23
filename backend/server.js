/* GEN-FREE Backend - Node.js (no external packages required)
   Academic/demo backend: authentication, profile, progress, quiz, feedback.

   Hardening in this version:
   - Only the website folders (index.html, css/, js/, pages/) are served; backend/, .git/ and dotfiles are blocked.
   - Malformed URLs and unexpected errors no longer crash the process.
   - Rate limiting only counts API calls, uses the real client IP behind a proxy, and login attempts are throttled.
   - Points, activities and quiz scores sent by the browser are validated and clamped before they are stored.
   - Sessions expire after 7 days.
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
// Comma-separated list of allowed website origins, e.g. "https://arthur-sys-star.github.io". "*" allows any origin.
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sessions = new Map();      // token -> { email, expires }
const requestCounts = new Map(); // ip -> { start, count }
const loginFailures = new Map(); // ip|email -> { start, count }

// Same catalogue as js/main.js. The server never trusts point values sent by the browser.
const ACTIVITY_POINTS = {
  home_scenario: 10, awareness_explored: 15, risks_explored: 10, myths_explored: 10,
  pressure_scenario: 10, choices_explored: 10, quiz_completed: 20, support_explored: 10,
  findings_explored: 5, feedback_submitted: 5
};
const QUIZ_REPEAT_POINTS = 5;
const PUBLIC_FILES = new Set(['/index.html']);
const PUBLIC_DIRS = ['/css/', '/js/', '/pages/'];

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');

process.on('uncaughtException', err => console.error('Uncaught exception:', err));
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));

function readUsers() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return {}; }
}
// Write to a temp file first so a crash mid-write cannot corrupt users.json.
function writeUsers(users) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}
function send(res, status, body, type = 'application/json', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}
function publicUser(user) {
  if (!user) return null;
  const copy = JSON.parse(JSON.stringify(user));
  delete copy.passwordHash;
  delete copy.passwordSalt;
  return copy;
}
function token() { return crypto.randomBytes(32).toString('hex'); }
function newSession(email) {
  const t = token();
  sessions.set(t, { email, expires: Date.now() + SESSION_TTL_MS });
  return t;
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err); else resolve({ salt, hash: derived.toString('hex') });
    });
  });
}
function verifyPassword(password, salt, expected) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) return reject(err);
      const actual = Buffer.from(derived.toString('hex'), 'utf8');
      const saved = Buffer.from(expected, 'utf8');
      resolve(actual.length === saved.length && crypto.timingSafeEqual(actual, saved));
    });
  });
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > -1) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore bad cookie */ }
    }
  });
  return out;
}
function sessionToken(req) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return bearer || parseCookies(req).genfree_session || '';
}
function authUser(req) {
  const t = sessionToken(req);
  const session = sessions.get(t);
  if (!session) return null;
  if (session.expires < Date.now()) { sessions.delete(t); return null; }
  const users = readUsers();
  return users[session.email] || null;
}
function body(req, limit = 1024 * 512) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (Buffer.byteLength(data) > limit) { reject(new Error('Request too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}
// Returns an absolute file path for public website files only, or null.
function safePath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const requested = decoded === '/' ? '/index.html' : decoded;
  const allowed = PUBLIC_FILES.has(requested) || PUBLIC_DIRS.some(dir => requested.startsWith(dir));
  if (!allowed) return null;
  if (requested.split('/').some(part => part.startsWith('.'))) return null; // no dotfiles anywhere
  const file = path.resolve(ROOT, '.' + requested);
  return file.startsWith(ROOT + path.sep) ? file : null;
}
function clientIp(req) {
  // Behind Render/other proxies the real address is the first entry of X-Forwarded-For.
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}
function hit(map, key, windowMs) {
  const now = Date.now();
  const item = map.get(key) || { start: now, count: 0 };
  if (now - item.start > windowMs) { item.start = now; item.count = 0; }
  item.count += 1;
  map.set(key, item);
  return item.count;
}
function rateLimited(req) { return hit(requestCounts, clientIp(req), 60000) > 240; }
function tooManyLoginFailures(req, email) {
  const item = loginFailures.get(clientIp(req) + '|' + email);
  return !!item && Date.now() - item.start <= 10 * 60000 && item.count >= 8;
}
// Keep the in-memory maps from growing forever.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of requestCounts) if (now - v.start > 120000) requestCounts.delete(k);
  for (const [k, v] of loginFailures) if (now - v.start > 10 * 60000) loginFailures.delete(k);
  for (const [k, v] of sessions) if (v.expires < now) sessions.delete(k);
}, 5 * 60000).unref();

function cleanActivities(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 500).filter(a => a && typeof a === 'object').map(a => ({
    type: String(a.type || '').slice(0, 40),
    label: String(a.label || '').slice(0, 120),
    detail: String(a.detail || '').slice(0, 200),
    points: Math.max(0, Number(a.points) || 0),
    timestamp: String(a.timestamp || new Date().toISOString()).slice(0, 40)
  }));
}
// Recompute points from the activity log with catalogue caps, so a browser cannot simply send points: 999999.
function computePoints(activities) {
  const seen = {};
  let total = 0;
  [...activities].reverse().forEach(a => { // activities are stored newest-first
    const max = ACTIVITY_POINTS[a.type];
    if (!max) return;
    const first = !seen[a.type];
    seen[a.type] = true;
    if (a.type === 'quiz_completed') total += Math.min(a.points, first ? max : QUIZ_REPEAT_POINTS);
    else if (first) total += Math.min(a.points, max);
  });
  return total;
}
function cleanAttempt(a) {
  if (!a || typeof a !== 'object') return null;
  const total = Number(a.total), score = Number(a.score);
  if (!Number.isFinite(total) || !Number.isFinite(score) || total < 1 || total > 50 || score < 0 || score > total) return null;
  return {
    setName: String(a.setName || '').slice(0, 60),
    score: Math.round(score),
    total: Math.round(total),
    percentage: Math.round((score / total) * 100),
    answers: Array.isArray(a.answers) ? a.answers.slice(0, 50) : [],
    timestamp: String(a.timestamp || new Date().toISOString()).slice(0, 40)
  };
}
function bestAttempt(attempts) {
  return attempts.reduce((best, a) => (!best || a.score > best.score || (a.score === best.score && a.timestamp > best.timestamp)) ? a : best, null);
}
function cleanList(value, fallback, max = 200) { return Array.isArray(value) ? value.slice(-max) : (fallback || []); }
function cleanFeedback(list, fallback) {
  if (!Array.isArray(list)) return fallback || [];
  return list.slice(-100).filter(f => f && typeof f === 'object').map(f => ({
    rating: String(f.rating || '').slice(0, 80),
    comment: String(f.comment || '').slice(0, 2000),
    date: String(f.date || new Date().toISOString()).slice(0, 40)
  }));
}
function normalizedUser(input, existing = {}) {
  const activities = Array.isArray(input.activities) ? cleanActivities(input.activities) : (existing.activities || []);
  const quizAttempts = Array.isArray(input.quizAttempts)
    ? input.quizAttempts.slice(-200).map(cleanAttempt).filter(Boolean)
    : (existing.quizAttempts || []);
  const completed = {};
  activities.forEach(a => { if (ACTIVITY_POINTS[a.type]) completed[a.type] = true; });
  return {
    ...existing,
    name: String(input.name ?? existing.name ?? '').trim().slice(0, 40),
    email: String(input.email ?? existing.email ?? '').trim().toLowerCase(),
    profile: String(input.profile ?? existing.profile ?? 'General').slice(0, 60),
    points: computePoints(activities),
    completed,
    activities,
    quizAttempts,
    quizBest: bestAttempt(quizAttempts),
    pageVisits: input.pageVisits && typeof input.pageVisits === 'object' && !Array.isArray(input.pageVisits) ? input.pageVisits : (existing.pageVisits || {}),
    scenarioAnswers: cleanList(input.scenarioAnswers, existing.scenarioAnswers),
    mythInteractions: cleanList(input.mythInteractions, existing.mythInteractions),
    pressureAnswers: cleanList(input.pressureAnswers, existing.pressureAnswers),
    riskCards: cleanList(input.riskCards, existing.riskCards),
    supportItems: cleanList(input.supportItems, existing.supportItems),
    findingsViewed: cleanList(input.findingsViewed, existing.findingsViewed),
    feedback: cleanFeedback(input.feedback, existing.feedback)
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const origin = req.headers.origin || '';
    const allowedOrigin = FRONTEND_ORIGINS.includes('*') ? '*' : (FRONTEND_ORIGINS.includes(origin) ? origin : '');
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const url = req.url.split('?')[0];

    if (url.startsWith('/api/')) {
      if (rateLimited(req)) return send(res, 429, { ok: false, message: 'Too many requests. Try again shortly.' });
      try {
        if (req.method === 'GET' && url === '/api/health') return send(res, 200, { ok: true, app: 'GEN-FREE', service: 'backend' });

        if (req.method === 'POST' && url === '/api/auth/register') {
          const input = await body(req);
          const name = String(input.name || '').trim();
          const email = String(input.email || '').trim().toLowerCase();
          const password = String(input.password || '');
          if (name.length < 2) return send(res, 400, { ok: false, message: 'Name must contain at least 2 characters.' });
          if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 120) return send(res, 400, { ok: false, message: 'Enter a valid email address.' });
          if (password.length < 6) return send(res, 400, { ok: false, message: 'Password must contain at least 6 characters.' });
          if (password.length > 200) return send(res, 400, { ok: false, message: 'Password is too long.' });
          const users = readUsers();
          if (Object.prototype.hasOwnProperty.call(users, email)) return send(res, 409, { ok: false, message: 'A profile with this email already exists.' });
          const { salt, hash } = await hashPassword(password);
          const now = new Date().toISOString();
          const user = normalizedUser({ name, email, profile: input.profile || 'General' }, {
            email, createdAt: now, lastLogin: now, passwordSalt: salt, passwordHash: hash
          });
          users[email] = user; writeUsers(users);
          return send(res, 201, { ok: true, user: publicUser(user), token: newSession(email) });
        }

        if (req.method === 'POST' && url === '/api/auth/login') {
          const input = await body(req);
          const email = String(input.email || '').trim().toLowerCase();
          const password = String(input.password || '');
          if (tooManyLoginFailures(req, email)) return send(res, 429, { ok: false, message: 'Too many failed attempts. Please wait a few minutes and try again.' });
          const users = readUsers();
          const user = Object.prototype.hasOwnProperty.call(users, email) ? users[email] : null;
          if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
            hit(loginFailures, clientIp(req) + '|' + email, 10 * 60000);
            return send(res, 401, { ok: false, message: 'Email or password is incorrect.' });
          }
          loginFailures.delete(clientIp(req) + '|' + email);
          user.lastLogin = new Date().toISOString(); users[email] = user; writeUsers(users);
          return send(res, 200, { ok: true, user: publicUser(user), token: newSession(email) });
        }

        if (req.method === 'POST' && url === '/api/auth/logout') {
          const t = sessionToken(req);
          if (t) sessions.delete(t);
          return send(res, 200, { ok: true });
        }

        if (req.method === 'GET' && url === '/api/auth/me') {
          const user = authUser(req); if (!user) return send(res, 401, { ok: false, message: 'Not authenticated.' });
          return send(res, 200, { ok: true, user: publicUser(user) });
        }

        const user = authUser(req);
        if (!user) return send(res, 401, { ok: false, message: 'Login required.' });
        const users = readUsers();

        if (req.method === 'PUT' && url === '/api/users/me') {
          const input = await body(req);
          const updated = normalizedUser(input, user);
          updated.email = user.email; updated.createdAt = user.createdAt; updated.lastLogin = user.lastLogin;
          users[user.email] = updated; writeUsers(users);
          return send(res, 200, { ok: true, user: publicUser(updated) });
        }

        if (req.method === 'POST' && url === '/api/progress/activity') {
          const input = await body(req);
          const activity = input.activity;
          if (!activity || typeof activity !== 'object') return send(res, 400, { ok: false, message: 'Activity is required.' });
          const type = String(input.type || activity.type || '');
          const catalogPoints = ACTIVITY_POINTS[type] || 0;
          const already = !!(user.completed && user.completed[type]);
          const award = catalogPoints && (type === 'quiz_completed' || !already) ? (already ? QUIZ_REPEAT_POINTS : catalogPoints) : 0;
          user.activities = Array.isArray(user.activities) ? user.activities : [];
          user.activities.unshift({ ...cleanActivities([{ ...activity, type, points: award }])[0] });
          user.points = computePoints(user.activities);
          if (catalogPoints) { user.completed = user.completed || {}; user.completed[type] = true; }
          users[user.email] = user; writeUsers(users);
          return send(res, 200, { ok: true, user: publicUser(user) });
        }

        if (req.method === 'POST' && url === '/api/quiz/attempt') {
          const attempt = cleanAttempt(await body(req));
          if (!attempt || !attempt.setName) return send(res, 400, { ok: false, message: 'Invalid quiz attempt.' });
          user.quizAttempts = Array.isArray(user.quizAttempts) ? user.quizAttempts : [];
          user.quizAttempts.push(attempt);
          user.quizBest = bestAttempt(user.quizAttempts);
          users[user.email] = user; writeUsers(users);
          return send(res, 200, { ok: true, user: publicUser(user) });
        }

        if (req.method === 'POST' && url === '/api/feedback') {
          const feedback = await body(req);
          user.feedback = Array.isArray(user.feedback) ? user.feedback : [];
          user.feedback.push({ rating: String(feedback.rating || '').slice(0, 80), comment: String(feedback.comment || '').slice(0, 2000), date: new Date().toISOString() });
          users[user.email] = user; writeUsers(users);
          return send(res, 201, { ok: true, message: 'Feedback saved.' });
        }

        if (req.method === 'GET' && url === '/api/progress') return send(res, 200, { ok: true, user: publicUser(user) });
        return send(res, 404, { ok: false, message: 'API route not found.' });
      } catch (error) {
        return send(res, error.message === 'Request too large' ? 413 : 400, { ok: false, message: error.message || 'Request failed.' });
      }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
    const file = safePath(req.url);
    if (!file) return send(res, 404, 'Not found', 'text/plain');
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) return send(res, 404, 'Not found', 'text/plain');
      const ext = path.extname(file).toLowerCase();
      const types = {
        '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
        '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8'
      };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).on('error', () => res.end()).pipe(res);
    });
  } catch (error) {
    console.error('Request error:', error);
    if (!res.headersSent) send(res, 500, { ok: false, message: 'Server error.' });
    else res.end();
  }
});

server.listen(PORT, HOST, () => console.log(`GEN-FREE backend running on http://localhost:${PORT}`));
