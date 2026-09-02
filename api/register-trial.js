// api/register-trial.js
// Phase 1 of the verified trial gate.
// Validates name + email + phone → stores pending record in Vercel KV →
// sends a verification email to the user → notifies Rusty.
//
// Does NOT grant widget access. Returns { ok: true, pending: true }.
// The user must click the link in their email to get a conversation token.
//
// Required env vars (set in Vercel dashboard → Settings → Environment Variables):
//   RESEND_API_KEY       — free at resend.com (verify coachjeff.ai domain there)
//   KV_REST_API_URL      — auto-added when you create a KV store in Vercel
//   KV_REST_API_TOKEN    — auto-added when you create a KV store in Vercel

const dns    = require('dns').promises;
const crypto = require('crypto');
const kv     = require('../lib/kv');
const { send, NOTIFY } = require('../lib/email');

const SITE            = 'https://coachjeff.ai';
const MAX_TRIAL       = 300; // 5 minutes in seconds
const REG_RATE_LIMIT  = 5;   // max registrations per IP per hour
const REG_WINDOW_SECS = 3600;

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress
      || 'unknown';
}

function validEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || '').trim().toLowerCase());
}

async function domainHasMX(email) {
  const domain = (email || '').split('@')[1];
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch { return false; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  SITE);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ ok: false });

  // ── IP rate limit ─────────────────────────────────────────────────────────
  const ip      = getIp(req);
  const rateKey = `reg:attempts:${ip}`;
  try {
    const count = await kv.get(rateKey);
    const n = count ? parseInt(count, 10) : 0;
    if (n >= REG_RATE_LIMIT) {
      return res.status(429).json({ ok: false, error: 'Too many signups from this connection. Try again in an hour.' });
    }
    await kv.set(rateKey, String(n + 1), REG_WINDOW_SECS);
  } catch (_) { /* non-fatal — proceed if KV unavailable for rate check */ }

  const { name, email, phone } = req.body || {};

  // ── Validate ──────────────────────────────────────────────────────────────
  if (!name || name.trim().length < 2)
    return res.status(400).json({ ok: false, field: 'name', error: 'Please enter your name.' });
  if (!phone || phone.replace(/\D/g, '').length < 10)
    return res.status(400).json({ ok: false, field: 'phone', error: 'Please enter a valid phone number.' });
  if (!email || !validEmailFormat(email))
    return res.status(400).json({ ok: false, field: 'email', error: 'Please enter a valid email address.' });

  // MX check — blocks throwaway domains with no mail server
  const mxOk = await domainHasMX(email);
  if (!mxOk)
    return res.status(400).json({ ok: false, field: 'email', error: "That email domain doesn't look right. Please use a real email address." });

  const nameVal  = name.trim();
  const emailVal = email.trim().toLowerCase();
  const phoneVal = phone.trim();
  const now      = new Date().toISOString();

  // ── Check if already verified ─────────────────────────────────────────────
  let existing = null;
  try { existing = await kv.getJson(`trial:user:${emailVal}`); } catch (e) {
    console.error('KV read error:', e.message);
    return res.status(503).json({ ok: false, error: 'Server unavailable. Please try again.' });
  }

  if (existing && existing.verified) {
    // Already verified — client can go straight to get-conversation-token
    return res.status(200).json({ ok: true, pending: false, alreadyVerified: true });
  }

  // ── Generate verification token ───────────────────────────────────────────
  const token = crypto.randomUUID().replace(/-/g, '');

  // ── Store user record ─────────────────────────────────────────────────────
  const userRecord = {
    name:          nameVal,
    email:         emailVal,
    phone:         phoneVal,
    verified:      false,
    pendingSince:  now,
    verifiedAt:    null,
    secsUsed:      existing ? (existing.secsUsed || 0) : 0,
    secsRemaining: existing ? (existing.secsRemaining || MAX_TRIAL) : MAX_TRIAL,
    firstSeen:     existing ? (existing.firstSeen || now) : now,
    lastConvAt:    existing ? (existing.lastConvAt || null) : null,
  };

  try {
    await kv.setJson(`trial:user:${emailVal}`, userRecord);
    // Token expires in 24h
    await kv.set(`trial:token:${token}`, emailVal, 86400);
    // Add to email index (only on first signup)
    if (!existing) {
      await kv.lpush('trial:emails', emailVal);
    }
  } catch (e) {
    console.error('KV write error:', e.message);
    return res.status(503).json({ ok: false, error: 'Server unavailable. Please try again.' });
  }

  // ── Send verification email to user ───────────────────────────────────────
  const verifyUrl = `${SITE}/api/verify-email?token=${token}`;
  const emailResult = await send({
    to:      emailVal,
    subject: 'Start your conversation with Coach Jeff',
    html: `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#f4f0e8;">
        <div style="background:#08101f;border-radius:12px;padding:32px;color:#f4f0e8;">
          <img src="https://coachjeff.ai/coach-jeff-icon.png" alt="Coach Jeff" style="width:64px;height:64px;border-radius:50%;margin-bottom:20px;display:block;">
          <h2 style="color:#c9a875;margin:0 0 16px;font-size:22px;">Hey ${nameVal},</h2>
          <p style="margin:0 0 20px;line-height:1.6;color:#ccc;">Coach Jeff is ready for you. Click the button below to verify your email and start your free 5-minute conversation.</p>
          <p style="margin:28px 0;">
            <a href="${verifyUrl}"
               style="background:#c9a875;color:#08101f;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">
              Start talking to Coach Jeff →
            </a>
          </p>
          <p style="margin:0;color:#666;font-size:12px;line-height:1.5;">
            This link expires in 24 hours. One free 5-minute conversation — no credit card.<br>
            If you didn't request this, just ignore it.
          </p>
        </div>
      </div>
    `,
  });

  // If the verification email couldn't be sent, tell the user — don't leave them waiting.
  if (emailResult.skipped) {
    // RESEND_API_KEY not yet configured. User is saved in KV but can't verify yet.
    console.warn('⚠️  Verification email SKIPPED — RESEND_API_KEY not set. User stored as pending:', emailVal);
    return res.status(503).json({ ok: false, error: "We're finishing setup and can't send email right now. Your spot is saved — try again in a few minutes." });
  }
  if (!emailResult.ok) {
    console.error('Verification email failed:', emailResult.error || emailResult.status);
    return res.status(503).json({ ok: false, error: 'We had trouble sending your verification email. Please try again in a moment.' });
  }

  // ── Notify Rusty ──────────────────────────────────────────────────────────
  const azTime = new Date().toLocaleString('en-US', {
    timeZone: 'America/Phoenix', dateStyle: 'medium', timeStyle: 'short'
  });
  send({
    to:      NOTIFY,
    subject: `Coach Jeff signup: ${nameVal} — pending verification`,
    html: `
      <div style="font-family:sans-serif;font-size:14px;">
        <h3 style="margin:0 0 16px;">New trial signup</h3>
        <table style="border-collapse:collapse;">
          <tr><td style="padding:4px 20px 4px 0;font-weight:bold;color:#555;">Name</td><td>${nameVal}</td></tr>
          <tr><td style="padding:4px 20px 4px 0;font-weight:bold;color:#555;">Email</td><td>${emailVal}</td></tr>
          <tr><td style="padding:4px 20px 4px 0;font-weight:bold;color:#555;">Phone</td><td>${phoneVal}</td></tr>
          <tr><td style="padding:4px 20px 4px 0;font-weight:bold;color:#555;">Time</td><td>${azTime} AZ</td></tr>
          <tr><td style="padding:4px 20px 4px 0;font-weight:bold;color:#555;">Status</td><td style="color:#f59e0b;">Pending verification</td></tr>
        </table>
        <p style="color:#888;font-size:12px;margin-top:16px;">They'll get access once they click the link in their email.</p>
      </div>
    `,
  }).catch(() => {});

  return res.status(200).json({ ok: true, pending: true });
};
