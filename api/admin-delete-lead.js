// api/admin-delete-lead.js
// Admin-authenticated endpoint to delete a single lead or purge all unverified leads.
// POST { email }          → delete one lead by email
// POST { purgeUnverified: true } → delete all unverified/pending leads
// Auth: X-Admin-Key header (ADMIN_PASSWORD env var)

const kv = require('../lib/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin',  'https://coachjeff.ai');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ ok: false });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const adminPwd = process.env.ADMIN_PASSWORD;
  if (!adminPwd) return res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD not set' });
  if ((req.headers['x-admin-key'] || '') !== adminPwd) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const { email, purgeUnverified } = req.body || {};

  try {
    // ── Purge all unverified ──────────────────────────────────────────────
    if (purgeUnverified) {
      const allEmails = await kv.lrange('trial:emails', 0, -1);
      const kept = [];
      let deleted = 0;

      for (const e of allEmails) {
        const record = await kv.getJson(`trial:user:${e}`);
        if (record && record.verified) {
          kept.push(e);
        } else {
          await kv.del(`trial:user:${e}`);
          deleted++;
        }
      }

      // Rewrite the emails index with only verified users
      await kv.del('trial:emails');
      if (kept.length > 0) {
        await kv.lpush('trial:emails', ...kept.reverse());
      }

      console.log(`Admin purged ${deleted} unverified leads, kept ${kept.length} verified`);
      return res.status(200).json({ ok: true, deleted, kept: kept.length });
    }

    // ── Delete single lead ────────────────────────────────────────────────
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ ok: false, error: 'email required' });
    }

    const emailVal = email.trim().toLowerCase();
    await kv.del(`trial:user:${emailVal}`);

    const allEmails = await kv.lrange('trial:emails', 0, -1);
    const filtered  = allEmails.filter(e => e !== emailVal);
    if (filtered.length !== allEmails.length) {
      await kv.del('trial:emails');
      if (filtered.length > 0) {
        await kv.lpush('trial:emails', ...filtered.reverse());
      }
    }

    console.log(`Admin deleted lead: ${emailVal}`);
    return res.status(200).json({ ok: true, email: emailVal });

  } catch (e) {
    console.error('admin-delete-lead error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
