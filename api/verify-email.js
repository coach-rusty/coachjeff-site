// api/verify-email.js — GET handler
// User arrives here by clicking the link in their verification email.
// Validates the one-time token → marks the email as verified in KV →
// redirects to the site so the client can request a conversation token.
//
// Required env vars:
//   KV_REST_API_URL, KV_REST_API_TOKEN

const kv = require('../lib/kv');
const { send, NOTIFY } = require('../lib/email');

const SITE = 'https://coachjeff.ai';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Works as both GET (email link) and OPTIONS
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { token } = req.query || {};

  if (!token || typeof token !== 'string' || token.length < 16) {
    return res.redirect(302, `${SITE}/?error=invalid-token#talk-to-jeff`);
  }

  // ── Look up token ─────────────────────────────────────────────────────────
  let emailVal;
  try {
    emailVal = await kv.get(`trial:token:${token}`);
  } catch (e) {
    console.error('KV error (token lookup):', e.message);
    return res.redirect(302, `${SITE}/?error=server-error#talk-to-jeff`);
  }

  if (!emailVal) {
    // Expired or already used
    return res.redirect(302, `${SITE}/?error=expired-token#talk-to-jeff`);
  }

  // ── Mark verified ─────────────────────────────────────────────────────────
  let user;
  try {
    user = await kv.getJson(`trial:user:${emailVal}`);
    if (!user) return res.redirect(302, `${SITE}/?error=not-found#talk-to-jeff`);

    user.verified   = true;
    user.verifiedAt = new Date().toISOString();

    await Promise.all([
      kv.setJson(`trial:user:${emailVal}`, user),
      kv.del(`trial:token:${token}`),   // single-use token — delete it
    ]);
  } catch (e) {
    console.error('KV error (mark verified):', e.message);
    return res.redirect(302, `${SITE}/?error=server-error#talk-to-jeff`);
  }

  // ── Notify Rusty ──────────────────────────────────────────────────────────
  const azTime = new Date().toLocaleString('en-US', {
    timeZone: 'America/Phoenix', dateStyle: 'medium', timeStyle: 'short'
  });
  send({
    to:      NOTIFY,
    subject: `Coach Jeff verified: ${user.name}`,
    html: `
      <div style="font-family:sans-serif;font-size:14px;">
        <p><strong>${user.name}</strong> (${emailVal}) just verified their email.</p>
        <p style="color:#555;">${azTime} AZ — they can now start a conversation.</p>
      </div>
    `,
  }).catch(() => {});

  // ── Redirect to site ──────────────────────────────────────────────────────
  // Client JS will detect the ?email= param and request a signed conversation URL.
  return res.redirect(302, `${SITE}/?email=${encodeURIComponent(emailVal)}#talk-to-jeff`);
};
