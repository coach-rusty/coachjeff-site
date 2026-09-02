// api/early-access.js — Vercel serverless function
// Collects name + email, emails Rusty at rusty@mybffcoach.com via Resend,
// saves to Airtable (if configured), and saves to KV as primary backup.
//
// Required env vars in Vercel dashboard (Settings → Environment Variables):
//   RESEND_API_KEY  — get free at resend.com — then verify coachjeff.ai domain there
//   AIRTABLE_PAT    — Airtable Personal Access Token (optional, data.records:write scope)
//   KV_REST_API_URL / UPSTASH_REDIS_REST_URL — for KV backup storage

const https = require('https');
const kv    = require('../lib/kv');

const AIRTABLE_BASE  = 'appmIu1Dg5kaE7WOb';
const AIRTABLE_TABLE = 'tblRdbl8CMqfzXdKn';
const NOTIFY_EMAIL   = 'rusty@mybffcoach.com';
const FROM_EMAIL     = 'Coach Jeff <noreply@coachjeff.ai>';

const EA_RATE_LIMIT  = 5;    // max early-access signups per IP per hour
const EA_WINDOW_SECS = 3600;

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress
      || 'unknown';
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || '').trim().toLowerCase());
}

/* ── Resend email ─────────────────────────────────────────────────────────── */
function sendEmail(apiKey, subject, html) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      from: FROM_EMAIL,
      to:   [NOTIFY_EMAIL],
      subject,
      html,
    });
    const options = {
      hostname: 'api.resend.com',
      path:     '/emails',
      method:   'POST',
      headers:  {
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', () => resolve({ status: 0 })); // silent fail
    req.write(body);
    req.end();
  });
}

/* ── Airtable save ────────────────────────────────────────────────────────── */
function saveToAirtable(token, name, email) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      records: [{
        fields: {
          'Name':          name,
          'Email':         email.trim().toLowerCase(),
          'Phone':         '',
          'Registered At': new Date().toISOString(),
          'Source':        'coachjeff.ai/early-access-cta',
          'Status':        'Pending',
          'Days Used':     0,
        }
      }]
    });
    const options = {
      hostname: 'api.airtable.com',
      path:     `/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`,
      method:   'POST',
      headers:  {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () =>
        res.statusCode >= 200 && res.statusCode < 300
          ? resolve(JSON.parse(data))
          : reject(new Error(`Airtable ${res.statusCode}: ${data}`))
      );
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* ── Handler ──────────────────────────────────────────────────────────────── */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  'https://coachjeff.ai');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ ok: false });

  // ── Honeypot — bots fill hidden fields; humans never touch this ───────────
  const { name, email, hp, tsToken } = req.body || {};
  if (hp) return res.status(200).json({ ok: true }); // silent swallow

  // ── Cloudflare Turnstile verification ─────────────────────────────────────
  const tsSecret = process.env.CF_TURNSTILE_SECRET;
  if (tsSecret && tsToken) {
    try {
      const tsBody = `secret=${encodeURIComponent(tsSecret)}&response=${encodeURIComponent(tsToken)}`;
      const tsResult = await new Promise((resolve) => {
        const options = {
          hostname: 'challenges.cloudflare.com',
          path:     '/turnstile/v0/siteverify',
          method:   'POST',
          headers:  { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(tsBody) }
        };
        const r = https.request(options, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
        r.on('error', () => resolve({ success: true })); // fail open if CF is down
        r.write(tsBody); r.end();
      });
      if (!tsResult.success) {
        return res.status(400).json({ ok: false, error: 'Bot check failed. Please try again.' });
      }
    } catch (_) { /* fail open */ }
  }

  // ── IP rate limit ─────────────────────────────────────────────────────────
  const ip      = getIp(req);
  const rateKey = `ea:attempts:${ip}`;
  try {
    const count = await kv.get(rateKey);
    const n = count ? parseInt(count, 10) : 0;
    if (n >= EA_RATE_LIMIT) {
      return res.status(429).json({ ok: false, error: 'Too many signups from this connection. Try again in an hour.' });
    }
    await kv.set(rateKey, String(n + 1), EA_WINDOW_SECS);
  } catch (_) { /* non-fatal */ }

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ ok: false, error: 'Please enter your name.' });
  }
  if (!validEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }

  const nameVal  = name.trim();
  const emailVal = email.trim().toLowerCase();
  const now      = new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix', dateStyle: 'medium', timeStyle: 'short' });

  // 1. Save to KV (primary backup — works even if Airtable/email not configured)
  try {
    const record = { name: nameVal, email: emailVal, signedUpAt: new Date().toISOString(), source: 'early-access-cta' };
    const isNew = !(await kv.exists(`ea:user:${emailVal}`));
    await kv.setJson(`ea:user:${emailVal}`, record);
    if (isNew) await kv.lpush('ea:emails', emailVal);
  } catch (e) {
    console.error('KV early-access error:', e.message);
    // non-fatal — continue
  }

  // 2. Email Rusty directly
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    await sendEmail(resendKey,
      `Coach Jeff Early Access: ${nameVal}`,
      `<h2 style="font-family:sans-serif;">New Early Access Signup</h2>
       <table style="font-family:sans-serif;font-size:15px;border-collapse:collapse;">
         <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Name</td><td>${nameVal}</td></tr>
         <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Email</td><td>${emailVal}</td></tr>
         <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Time</td><td>${now} AZ</td></tr>
         <tr><td style="padding:6px 16px 6px 0;font-weight:bold;">Source</td><td>coachjeff.ai early access CTA</td></tr>
       </table>`
    );
  }

  // 3. Save to Airtable (optional)
  const airtableToken = process.env.AIRTABLE_PAT;
  if (airtableToken) {
    try { await saveToAirtable(airtableToken, nameVal, emailVal); }
    catch (e) { console.error('Airtable error:', e.message); }
  }

  return res.status(200).json({ ok: true });
};
