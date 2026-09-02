// api/admin-early-access.js
// Returns all early access signups stored in KV.
// Password protected via ADMIN_PASSWORD env var.
// Rate limited: 5 failed attempts per IP per 15 minutes.
// Used by /admin.html — the early access tab.
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN, ADMIN_PASSWORD

const kv = require('../lib/kv');

const MAX_ATTEMPTS = 5;
const WINDOW_SECS  = 15 * 60;

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress
      || 'unknown';
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin',  'https://coachjeff.ai');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ ok: false });

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD env var not set' });
  }

  const ip      = getIp(req);
  const rateKey = `admin:attempts:ea:${ip}`;

  // ── Rate limit check ──────────────────────────────────────────────────────
  let attempts = 0;
  try {
    const val = await kv.get(rateKey);
    attempts = val ? parseInt(val, 10) : 0;
  } catch (_) {}

  if (attempts >= MAX_ATTEMPTS) {
    return res.status(429).json({ ok: false, error: 'Too many failed attempts. Try again in 15 minutes.' });
  }

  // ── Password check — read from header, not URL (avoids logging in plaintext) ─
  const key = req.headers['x-admin-key'] || '';
  if (key !== adminPassword) {
    try { await kv.set(rateKey, String(attempts + 1), WINDOW_SECS); } catch (_) {}
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  // ── Auth success ──────────────────────────────────────────────────────────
  try { await kv.del(rateKey); } catch (_) {}

  try {
    const emails = await kv.lrange('ea:emails', 0, -1);

    if (!emails || emails.length === 0) {
      return res.status(200).json({ ok: true, leads: [], total: 0 });
    }

    const uniqueEmails = [...new Set(emails)];

    const leads = await Promise.all(
      uniqueEmails.map(async (email) => {
        try {
          const record = await kv.getJson(`ea:user:${email}`);
          return record || { email, signedUpAt: null, _error: 'record not found' };
        } catch {
          return { email, _error: 'KV lookup failed' };
        }
      })
    );

    leads.sort((a, b) => {
      const ta = a.signedUpAt ? new Date(a.signedUpAt).getTime() : 0;
      const tb = b.signedUpAt ? new Date(b.signedUpAt).getTime() : 0;
      return tb - ta;
    });

    return res.status(200).json({ ok: true, leads, total: leads.length });
  } catch (e) {
    console.error('Admin early access error:', e.message);
    return res.status(500).json({ ok: false, error: 'Server error: ' + e.message });
  }
};
