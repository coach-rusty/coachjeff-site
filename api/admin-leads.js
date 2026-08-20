// api/admin-leads.js
// Returns all trial leads. Password protected via ADMIN_PASSWORD env var.
// Used by /admin.html — the live sortable dashboard.
//
// Security:
//   - Rate limited: 5 failed attempts per IP per 15 minutes → locked out
//   - Logs every access attempt (IP + timestamp) to KV
//   - noindex on admin.html, /admin disallowed in robots.txt
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN, ADMIN_PASSWORD

const kv = require('../lib/kv');

const MAX_ATTEMPTS  = 5;
const WINDOW_SECS   = 15 * 60; // 15 minutes

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

  const ip        = getIp(req);
  const rateKey   = `admin:attempts:${ip}`;

  // ── Rate limit check ──────────────────────────────────────────────────────
  let attempts = 0;
  try {
    const val = await kv.get(rateKey);
    attempts = val ? parseInt(val, 10) : 0;
  } catch (_) { /* KV unavailable — fail open on rate check only */ }

  if (attempts >= MAX_ATTEMPTS) {
    console.warn(`Admin rate limit hit for IP ${ip}`);
    return res.status(429).json({ ok: false, error: 'Too many failed attempts. Try again in 15 minutes.' });
  }

  // ── Password check — read from header, not URL (avoids logging in plaintext) ─
  const key = req.headers['x-admin-key'] || '';
  if (key !== adminPassword) {
    // Increment failure counter
    try {
      const newCount = attempts + 1;
      await kv.set(rateKey, String(newCount), WINDOW_SECS);
      console.warn(`Admin auth failure #${newCount} from IP ${ip}`);
    } catch (_) { /* non-fatal */ }
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  // ── Auth success — reset counter, log access ──────────────────────────────
  try {
    await kv.del(rateKey);
    // Log successful access
    const logEntry = JSON.stringify({ ip, at: new Date().toISOString() });
    await kv.lpush('admin:access:log', logEntry);
  } catch (_) { /* non-fatal */ }

  try {
    // Get all emails from the index list
    const emails = await kv.lrange('trial:emails', 0, -1);

    if (!emails || emails.length === 0) {
      return res.status(200).json({ ok: true, leads: [], total: 0 });
    }

    // Deduplicate (lpush can create duplicates if someone re-submits)
    const uniqueEmails = [...new Set(emails)];

    // Fetch each user record in parallel
    const leads = await Promise.all(
      uniqueEmails.map(async (email) => {
        try {
          const user = await kv.getJson(`trial:user:${email}`);
          return user || { email, _error: 'record not found in KV' };
        } catch {
          return { email, _error: 'KV lookup failed' };
        }
      })
    );

    // Sort by firstSeen descending (newest first)
    leads.sort((a, b) => {
      const ta = a.firstSeen ? new Date(a.firstSeen).getTime() : 0;
      const tb = b.firstSeen ? new Date(b.firstSeen).getTime() : 0;
      return tb - ta;
    });

    return res.status(200).json({ ok: true, leads, total: leads.length });
  } catch (e) {
    console.error('Admin error:', e.message);
    return res.status(500).json({ ok: false, error: 'Server error: ' + e.message });
  }
};
