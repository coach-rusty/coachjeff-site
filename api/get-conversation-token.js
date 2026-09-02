// api/get-conversation-token.js
// The real gate. Called by the browser after email verification.
// Checks: email verified? trial time remaining?
// If yes → mints a short-lived ElevenLabs signed URL + a server-side session
//           nonce (stored in KV with a start timestamp).
// If no  → returns a clear refusal. Browser gets nothing it can use.
// Everything fails closed — any server error means no conversation.
//
// The session nonce is required by call-completed.js to record time used.
// This prevents clients from lying about how many seconds they used —
// the server computes elapsed time from its own clock, not the client's report.
//
// Required env vars:
//   KV_REST_API_URL, KV_REST_API_TOKEN
//   ELEVENLABS_API_KEY   — your ElevenLabs API key (XI API key)
//   ELEVENLABS_AGENT_ID  — your agent ID (server-only, never sent to browser)

const crypto = require('crypto');
const kv     = require('../lib/kv');

const SITE        = 'https://coachjeff.ai';
const SESSION_TTL = 3600; // session nonce expires in 1 hour

async function mintSignedUrl() {
  const apiKey  = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey)  throw new Error('ELEVENLABS_API_KEY not configured');
  if (!agentId) throw new Error('ELEVENLABS_AGENT_ID not configured');

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { headers: { 'xi-api-key': apiKey } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (!data.signed_url) throw new Error('ElevenLabs returned no signed_url');
  return data.signed_url;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  SITE);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ ok: false });

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ ok: false, reason: 'missing-email' });
  }

  const emailVal = email.trim().toLowerCase();

  // ── Look up user record ───────────────────────────────────────────────────
  let user;
  try {
    user = await kv.getJson(`trial:user:${emailVal}`);
  } catch (e) {
    console.error('KV error:', e.message);
    return res.status(503).json({ ok: false, reason: 'server-unavailable',
      message: 'Unable to verify your access. Please try again in a moment.' });
  }

  if (!user) {
    return res.status(403).json({ ok: false, reason: 'not-found',
      message: 'Email not found. Please complete the form first.' });
  }

  if (!user.verified) {
    return res.status(403).json({ ok: false, reason: 'unverified',
      message: 'Check your inbox and click the verification link first.' });
  }

  if (user.secsRemaining <= 0) {
    return res.status(403).json({ ok: false, reason: 'exhausted',
      secsRemaining: 0,
      message: 'Your free trial has been used. Launch is November 11 — stay tuned.' });
  }

  // ── Mint ElevenLabs signed URL ────────────────────────────────────────────
  let signedUrl;
  try {
    signedUrl = await mintSignedUrl();
  } catch (e) {
    console.error('ElevenLabs signed URL error:', e.message);
    return res.status(503).json({ ok: false, reason: 'server-unavailable',
      message: 'Unable to connect to Coach Jeff right now. Please try again.' });
  }

  // ── Create server-side session record ────────────────────────────────────
  // This nonce is required by call-completed.js. It lets the server compute
  // actual elapsed time instead of trusting the client's reported secsUsed.
  const sessionNonce = crypto.randomBytes(16).toString('hex');
  try {
    await kv.set(
      `trial:session:${sessionNonce}`,
      JSON.stringify({ email: emailVal, startedAt: Date.now() }),
      SESSION_TTL
    );
  } catch (e) {
    console.error('KV session write error:', e.message);
    // Fail closed — don't issue a token if we can't track the session
    return res.status(503).json({ ok: false, reason: 'server-unavailable',
      message: 'Unable to start session. Please try again.' });
  }

  // Mark trial as started (first time only)
  if (!user.trialStarted) {
    try {
      user.trialStarted   = true;
      user.trialStartedAt = new Date().toISOString();
      await kv.setJson(`trial:user:${emailVal}`, user);
    } catch (_) { /* non-fatal */ }
  }

  return res.status(200).json({
    ok:            true,
    signedUrl,
    sessionNonce,
    secsRemaining: user.secsRemaining,
    name:          user.name,
  });
};
