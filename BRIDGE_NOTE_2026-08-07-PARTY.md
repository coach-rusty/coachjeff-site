# BRIDGE NOTE — Aug 7 2026 (while Rusty was at Jane's birthday)

## What I did while you were gone

### Bugs fixed (local — needs deploy)

**1. Security: `api/early-access.js`**
- Removed `NTFY_TOPIC`, removed `notifyNtfy()` function and call
- ntfy.sh was broadcasting name + email to a public topic — that hole is now closed
- Added KV as primary backup storage for early access leads (`ea:user:{email}`, `ea:emails` list)
- Added `const kv = require('../lib/kv')` to the file

**2. Security: `api/get-conversation-token.js`**
- Removed hardcoded fallback `|| 'agent_5001kqr9ds89ecytpd5azbvcyctc'`
- If `ELEVENLABS_AGENT_ID` env var is ever unset, the endpoint now fails closed instead of exposing the agent ID
- Both `apiKey` and `agentId` are now checked before any ElevenLabs call

**3. UX: `api/register-trial.js`**
- Added check on the result of `send()` for the user verification email
- If Resend is not configured (skipped) → returns 503 "We're finishing setup" instead of silently showing "check your inbox" with no email coming
- If Resend fails (real error) → returns 503 with clear message

**4. UX: `index.html`**
- Fixed empty name edge case in `showReadyState`: "Hey . Coach Jeff is live." → "Coach Jeff is live."

### New files

**`api/admin-early-access.js`** — New endpoint
- Returns all early access signups from KV (`ea:emails`, `ea:user:{email}`)
- Same password protection as `admin-leads.js`

**`admin.html`** — Added Early Access tab
- Admin dashboard now has two tabs: "Trial Leads" and "Early Access"
- Early Access tab is lazy-loaded on first click
- Sortable, searchable, CSV export — same pattern as Trial Leads tab

---

## LIVE SITE STATUS (current deployment — 4:52pm)

All good:
- `/api/widget` → `{enabled: true}` ✓
- `/api/register-trial` → validates properly, returns field errors ✓
- `/api/get-conversation-token` → responds with `{reason: 'missing-email'}` ✓
- No JS errors on main page ✓

**NOTE: My changes above are LOCAL ONLY. They are NOT live yet.**

---

## TO DEPLOY WHEN YOU GET BACK

Open Terminal, run:

```bash
cd "/Users/rustyhumphries/Documents/Claude/Projects/Rusty Humphries Projects/coachjeff-site"
vercel --prod
```

That's it. One command.

---

## REMAINING AFTER DEPLOY

1. **Resend setup** (unlocks the entire trial flow)
   - Go to resend.com → create free account
   - Add and verify domain `coachjeff.ai` (DNS record, takes ~5 min)
   - Create API key → copy it
   - Vercel → coachjeff-site → Settings → Environment Variables → add `RESEND_API_KEY`
   - Redeploy again

2. **ElevenLabs agent: enable "Require authentication"**
   - In ElevenLabs dashboard → find Coach Jeff agent → Security/Auth settings
   - Enable private mode / require signed URLs
   - This closes the final hole — right now anyone with the agent ID can still talk to him directly

3. **Separate Airtable for Coach Jeff leads** — deferred. KV is the primary store now.

---

## WHAT WORKS RIGHT NOW (after deploy)

- Trial gate: name + phone + email → KV store → (email requires Resend) → verify → signed URL → conversation
- Early access leads: name + email → KV store + optional Airtable + optional Resend notification
- Admin dashboard: `/admin` → password from `ADMIN_PASSWORD` env var → see all trial leads + early access
- Agent ID: server-side only, never in page source
- Kill switch: `/api/widget` → `WIDGET_ENABLED=false` in Vercel to shut it down instantly
