// api/call-completed.js
// Called by the browser when a conversation ends.
// Requires a sessionNonce issued by get-conversation-token.js.
//
// SECURITY: Does NOT trust client-reported time. Computes actual elapsed
// seconds from the server-side session record (start timestamp stored in KV
// when the signed URL was minted). Client cannot lie about duration.
// The sessionNonce is single-use — deleted after redemption.
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN

const kv = require('../lib/kv');

const SITE      = 'https://coachjeff.ai';
const MAX_TRIAL = 300; // 5 minutes in seconds

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  SITE);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ ok: false });

  const { email, sessionNonce } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing email' });
  }
  if (!sessionNonce || typeof sessionNonce !== 'string' || sessionNonce.length < 16) {
    return res.status(400).json({ ok: false, error: 'Missing or invalid sessionNonce' });
  }

  const emailVal = email.trim().toLowerCase();

  // ── Look up session record (authoritative start time) ─────────────────────
  let session;
  try {
    const raw = await kv.get(`trial:session:${sessionNonce}`);
    if (!raw) {
      return res.status(400).json({ ok: false, error: 'Session not found or already recorded.' });
    }
    session = JSON.parse(raw);
  } catch (e) {
    console.error('KV session lookup error:', e.message);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }

  // ── Verify session belongs to this email ─────────────────────────────────
  if (session.email !== emailVal) {
    return res.status(403).json({ ok: false, error: 'Session mismatch.' });
  }

  // ── Compute actual elapsed time ───────────────────────────────────────────
  const elapsedMs   = Date.now() - session.startedAt;
  const elapsedSecs = Math.max(0, Math.floor(elapsedMs / 1000));
  // Cap at MAX_TRIAL in case of clock issues
  const secsUsed    = Math.min(elapsedSecs, MAX_TRIAL);

  // ── Delete session nonce (single-use) ─────────────────────────────────────
  try {
    await kv.del(`trial:session:${sessionNonce}`);
  } catch (_) { /* non-fatal */ }

  // ── Update user record ────────────────────────────────────────────────────
  try {
    const user = await kv.getJson(`trial:user:${emailVal}`);
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    user.secsUsed      = Math.min(MAX_TRIAL, (user.secsUsed || 0) + secsUsed);
    user.secsRemaining = Math.max(0, MAX_TRIAL - user.secsUsed);
    user.lastConvAt    = new Date().toISOString();

    await kv.setJson(`trial:user:${emailVal}`, user);

    return res.status(200).json({
      ok:            true,
      secsUsed,
      secsRemaining: user.secsRemaining,
    });
  } catch (e) {
    console.error('KV user update error:', e.message);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};
