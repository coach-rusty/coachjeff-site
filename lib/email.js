// lib/email.js — Resend email helper (native fetch, no npm)
// Requires env var: RESEND_API_KEY
// Domain coachjeff.ai must be verified in your Resend dashboard (resend.com)

const FROM   = 'Coach Jeff <noreply@coachjeff.ai>';
const NOTIFY = 'rusty@mybffcoach.com';

/**
 * Send an email via Resend.
 * @param {object} opts
 * @param {string|string[]} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 */
async function send({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('RESEND_API_KEY not set — email skipped');
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        from:    FROM,
        to:      Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    console.error('Resend error:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { send, FROM, NOTIFY };
