// api/delete-lead.js
// Called by the Coach Jeff app when a veteran deletes their account.
// Removes all website-side data for that email: KV user record + email index entry.
//
// This closes the deletion gap: the app deletes its own data, then calls this
// endpoint to ensure the website lead database is also cleared. A veteran who
// deletes their account must not remain in the lead list or CSV exports.
//
// Authentication: shared secret in DELETION_SECRET env var.
// The app sends: POST /api/delete-lead { email, secret }
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN, DELETION_SECRET

const kv = require('../lib/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin',  'https://coachjeff.ai'); // server-to-server; secret auth is the real gate
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ ok: false });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const deletionSecret = process.env.DELETION_SECRET;
  if (!deletionSecret) {
    return res.status(500).json({ ok: false, error: 'DELETION_SECRET env var not set' });
  }

  const { email, secret } = req.body || {};

  // Accept secret in body OR Authorization: Bearer header
  const authHeader = (req.headers['authorization'] || '').replace('Bearer ', '');
  const providedSecret = secret || authHeader;

  if (providedSecret !== deletionSecret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ ok: false, error: 'email required' });
  }

  const emailVal = email.trim().toLowerCase();

  try {
    // 1. Delete the user record
    await kv.del(`trial:user:${emailVal}`);

    // 2. Remove from the emails index list
    // Redis LREM: remove all occurrences of this email from the list
    // kv.js doesn't have lrem — call directly via kvRun
    // We do this by filtering: get list, remove email, rewrite
    // (Safe for small lists. If list grows >10k, use a Set instead.)
    const allEmails = await kv.lrange('trial:emails', 0, -1);
    const filtered  = allEmails.filter(e => e !== emailVal);

    if (filtered.length !== allEmails.length) {
      // Rewrite the list without this email
      await kv.del('trial:emails');
      if (filtered.length > 0) {
        await kv.lpush('trial:emails', ...filtered.reverse()); // preserve order
      }
    }

    // 3. Log the deletion
    const logEntry = JSON.stringify({
      email:  emailVal,
      at:     new Date().toISOString(),
      action: 'account-deletion',
    });
    await kv.lpush('admin:deletions:log', logEntry);

    console.log(`Lead deleted per account deletion request: ${emailVal}`);
    return res.status(200).json({ ok: true, email: emailVal, deleted: true });

  } catch (e) {
    console.error('Delete lead error:', e.message);
    return res.status(500).json({ ok: false, error: 'Server error: ' + e.message });
  }
};
