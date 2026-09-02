# CLAUDE.md — coachjeff-site Technical Brain
**Last updated:** 2026-08-08
**Status:** Live in production at coachjeff.ai
**Maintained by:** AI working with Rusty Humphries (rusty@mybffcoach.com)

Read this before touching anything. This is the complete technical picture.

---

## WHAT THIS SITE IS

A static marketing/trial site for **Coach Jeff** — a $365/year AI companion app built for veterans managing PTSD. Lives at `coachjeff.ai`. The site's primary job: gate access to a 5-minute free trial behind verified email, capture leads, convert to early access signups.

**Not a framework. Not a SPA.** Pure HTML/CSS/JS + Vercel serverless API functions. No npm install required to edit the frontend. One `index.html` file runs the entire user experience.

See `COACHJEFF_SITE_BIBLE.md` for brand identity, voice, design rules, and what Coach Jeff is as a character. That doc covers the *what*. This doc covers the *how*.

---

## LIVE INFRASTRUCTURE

| Service | Purpose | Account |
|---------|---------|---------|
| **Vercel** | Hosting + serverless API functions | rusty-humphries-projects team |
| **Upstash Redis** | Trial enforcement, lead storage (KV) | Connected via Vercel integration |
| **Resend** | Verification + notification emails | rustyonline777@gmail.com |
| **ElevenLabs** | Conversational AI (Coach Jeff's voice) | Rusty's account |
| **GoDaddy** | Domain registrar for coachjeff.ai | Rusty's account — nameservers NOW point to Vercel |

### Vercel Project
- **Project ID:** `prj_WSbpQvcHXWTXGPjNjkyaMypiSwuv`
- **Team ID:** `team_joFDgzN7OpTY40TSeO1gDffB`
- **Primary domain:** `coachjeff.ai`
- **Project file:** `.vercel/project.json`

### DNS
- **Registrar:** GoDaddy
- **Nameservers:** `ns1.vercel-dns.com` / `ns2.vercel-dns.com` (switched 2026-08-08 — GoDaddy is no longer the DNS authority)
- **DNS managed by:** Vercel (use Vercel API v4 to add/remove records)
- **DO NOT** try to add DNS records in GoDaddy — it no longer serves DNS for this domain

### Resend
- **Account:** rustyonline777@gmail.com
- **Plan:** Paid ($20/mo Transactional) — supports multiple domains
- **Verified domains:** `mybffcoach.com` (existing), `coachjeff.ai` (added 2026-08-08, pending verification)
- **Domain ID for coachjeff.ai:** `89d6c385-18f4-40c6-98a9-4b0c5cf4a862`
- **API key in use for coachjeff-site:** named `coachjeff-site` in Resend dashboard
- **DO NOT** use or modify the key named `RESEND_API_KEY` in Resend — that key belongs to the mybffcoach.com backend (password reset emails for the app). Two separate keys, two separate systems.

---

## ENVIRONMENT VARIABLES (Vercel)

All set in Vercel dashboard → Settings → Environment Variables. Never hardcode these.

| Key | Purpose | Type |
|-----|---------|------|
| `RESEND_API_KEY` | Resend API key for coachjeff-site (named "coachjeff-site" in Resend) | encrypted |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis endpoint | encrypted |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token | sensitive |
| `ELEVENLABS_API_KEY` | ElevenLabs API key (mints signed URLs server-side) | sensitive |
| `ELEVENLABS_AGENT_ID` | Coach Jeff agent ID — server-only, never goes to browser | sensitive |
| `ADMIN_PASSWORD` | Password for /admin.html lead dashboard | sensitive |

**To update an env var via API (no dashboard needed):**
```bash
VERCEL_TOKEN="<token from ~/.config/com.vercel.cli/auth.json>"
PROJECT_ID="prj_WSbpQvcHXWTXGPjNjkyaMypiSwuv"
TEAM_ID="team_joFDgzN7OpTY40TSeO1gDffB"
ENV_ID="<id from GET /v9/projects/{id}/env>"

curl -X PATCH "https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${ENV_ID}?teamId=${TEAM_ID}" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"value": "new-value", "type": "encrypted", "target": ["production","preview","development"]}'
```

**To deploy:**
```bash
cd /path/to/coachjeff-site
npx vercel --prod --yes --token "<vercel token>"
```

---

## FILE STRUCTURE

```
coachjeff-site/
├── CLAUDE.md                    ← YOU ARE HERE — technical brain
├── COACHJEFF_SITE_BIBLE.md      ← Brand, design, voice, character (read before writing copy)
├── index.html                   ← The entire frontend (~4000 lines, all inline CSS/JS)
├── admin.html                   ← Lead dashboard (password-protected, /admin)
├── vercel.json                  ← Routing config (cleanUrls: true)
│
├── api/                         ← Vercel serverless functions (Node.js)
│   ├── register-trial.js        ← Step 1: collect name/email/phone, send verification email
│   ├── verify-email.js          ← Step 2: user clicks link, marks verified in KV
│   ├── get-conversation-token.js← Step 3: checks verified+time remaining, mints ElevenLabs URL
│   ├── call-completed.js        ← Called when ElevenLabs session ends, deducts time from KV
│   ├── admin-leads.js           ← Returns all trial leads (password-gated)
│   ├── admin-early-access.js    ← Returns early access signups (password-gated)
│   ├── early-access.js          ← Handles early access form submissions
│   └── widget.js                ← (Legacy/alternative widget endpoint)
│
├── lib/
│   ├── kv.js                    ← Upstash Redis helper (CRITICAL — read before editing)
│   └── email.js                 ← Resend email sender
│
└── [images, logos, audio]       ← Static assets
```

---

## SOCIAL-QUOTES IMAGE HOSTING

All Coach Jeff social-media quote-card images live at `public/social-quotes/*.jpg` in this repo, and are served at `https://www.coachjeff.ai/social-quotes/*.jpg` (Vercel's Output Directory setting maps `public/` to site root -- do not add a `/social-quotes` rewrite in vercel.json, it's not needed and was tried/reverted once already, see commit c4fa0a7).

To add new images: add files under `public/social-quotes/`, commit, push to `main` -- Vercel auto-deploys to Production. This is the ONLY correct hosting location for these images. (Two other repos -- `mybff-coach` and `mybffcoach-website` -- were checked and ruled out on 2026-09-02: neither hosts coachjeff.ai content; `mybffcoach-website`'s index.html title doesn't even match the live site.)

---

## ⚠️ GIT SAFETY -- NEVER USE SPARSE-CHECKOUT ON THIS REPO

**Incident, 2026-09-02:** An AI assistant needed to add 16 images to `public/social-quotes/` and used a partial/sparse-checkout clone (`git clone --filter=blob:none --no-checkout` + `git sparse-checkout set public/social-quotes`) to avoid pulling the whole repo (which has several large video/audio files). This clone technique has a footgun: when you `git add` + `git commit` with sparse-checkout scoped to one folder, git commits a tree containing ONLY that folder -- every other file (index.html, vercel.json, all pages, logos, videos, api/, blog/, lib/, screenshots/, app-store-assets/) is silently deleted from the commit. That commit was pushed straight to `main` and took the live site down (full 404 on every page) for roughly an hour before it was caught and fixed with a follow-up commit that restored the full tree from the last known-good commit.

**Rule going forward:** never use `git sparse-checkout` (or any partial/shallow clone technique) against this repo for a commit that will be pushed to `main`. If you need to add or change a handful of files without pulling the whole repo:
- Use a full (non-sparse) clone -- the repo is at most a few hundred MB, fine for a one-time operation -- or
- Add/update individual files directly via the GitHub API (`create_or_update_file` / `push_files`), which only touches the paths you specify and can't silently drop the rest of the tree, or
- If a sparse/partial clone is truly necessary for speed, run `git sparse-checkout disable` (widening back to the full tree) *before* the first commit made from that clone -- never commit while scoped to a subset of the repo.

Before ANY push to this repo's `main` branch: run `git ls-tree -r HEAD --name-only | wc -l` -- it should return roughly 170+ (the full site). If it returns anything close to 51 (just the social-quotes folder) or otherwise drops sharply from the prior commit, STOP -- do not push, the tree is missing files.

---

## THE TRIAL GATE — HOW IT WORKS

This is the most important system on the site. Every decision here is deliberate and security-critical.

### The Flow (3 steps, all server-enforced)

```
1. User fills form (name, email, phone)
        ↓
   POST /api/register-trial
   - Validates format + MX record (blocks fake domains)
   - Writes pending record to KV: trial:user:{email}
   - Adds email to trial:emails list
   - Sends verification email via Resend
   - Returns { ok: true, pending: true }
        ↓
2. User clicks link in email
        ↓
   GET /api/verify-email?token={uuid}
   - Looks up trial:token:{token} in KV → gets email
   - Marks user.verified = true in KV
   - Deletes the one-time token (single-use)
   - Redirects to coachjeff.ai/?verified=true
        ↓
3. Browser requests conversation access
        ↓
   POST /api/get-conversation-token { email }
   - Checks user.verified === true
   - Checks user.secsRemaining > 0
   - Mints ElevenLabs signed URL (short-lived)
   - Returns { ok: true, signedUrl, secsRemaining, name }
        ↓
4. Conversation ends
        ↓
   POST /api/call-completed { email, secondsUsed }
   - Deducts secondsUsed from user.secsRemaining in KV
   - secsRemaining can never go below 0
```

### Security Decisions (do not undo these without understanding why)

**Fail closed everywhere.** Any KV error, ElevenLabs error, or unexpected state returns a refusal, never a grant. This is intentional.

**Agent ID never in client-side code.** `ELEVENLABS_AGENT_ID` is a server env var only. The browser receives a signed URL, not the agent ID. This closes the bypass where someone extracts the ID and drives ElevenLabs directly — BUT only if ElevenLabs "Require authentication" is enabled on the agent (see PENDING ITEMS below).

**No localStorage enforcement.** The trial gate has zero client-side state. Clearing browser data does nothing. Time remaining lives in KV only.

**MX validation on email.** `a@b.com`, `test@test.com`, etc. fail before any email is sent.

**Single-use tokens.** The verification token is deleted from KV the moment it's used.

**No anonymous access.** The `get-conversation-token` endpoint requires an email that exists in KV, is verified, and has time remaining. Missing any one → 403.

---

## KV DATA SCHEMA (Upstash Redis)

```
trial:user:{email}     JSON object:
  {
    name:          string,
    email:         string,
    phone:         string,
    firstSeen:     ISO timestamp,
    verified:      boolean,
    verifiedAt:    ISO timestamp (once verified),
    secsRemaining: number (starts at 300 = 5 minutes),
    trialStarted:  boolean,
    trialStartedAt: ISO timestamp,
    source:        'widget' | 'registration'
  }

trial:token:{uuid}     string — the email address this token belongs to
                       TTL: 24 hours (single-use, deleted on redemption)

trial:emails           Redis list — all emails that have registered (for admin dashboard)
                       Use LRANGE trial:emails 0 -1 to get all
```

---

## KV HELPER — CRITICAL NOTES

**File:** `lib/kv.js`

**Use the pipeline format.** Upstash REST API has two formats. The `POST /{command}` with a body array does NOT work — Upstash treats the entire body as a single argument and returns "wrong number of arguments." Always use `POST /pipeline` with body `[[COMMAND, arg1, arg2, ...]]`. The helper already does this correctly — do not change it.

**Env var names:** Supports both `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Vercel KV naming) and `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (direct Upstash naming). Currently using the Upstash names.

---

## ADMIN DASHBOARD

**URL:** `coachjeff.ai/admin`
**Password:** Set via `ADMIN_PASSWORD` env var in Vercel

**Leads tab:** All trial registrations — name, email, phone, signup time, verified status, trial time remaining. CSV export button.

**Early Access tab:** All early access signups. CSV export button.

Rusty uses this to follow up with everyone who tried Coach Jeff.

---

## EMAIL SYSTEM

**Provider:** Resend
**FROM address:** `Coach Jeff <noreply@coachjeff.ai>`
**Notification recipient:** `rusty@mybffcoach.com`
**File:** `lib/email.js`

**Domain verification status (as of 2026-08-08):** DNS records added to Vercel zone, nameservers switched from GoDaddy to Vercel tonight. Resend crawler confirmation pending — expected within hours, automatic.

**The 3 DNS records added to Vercel zone for Resend:**
- TXT `resend._domainkey` → DKIM key
- MX `send` → `feedback-smtp.us-east-1.amazonses.com` (priority 10)
- TXT `send` → `v=spf1 include:amazonses.com ~all`

If Resend verification shows "pending," trigger a re-check:
```bash
curl -X POST https://api.resend.com/domains/89d6c385-18f4-40c6-98a9-4b0c5cf4a862/verify \
  -H "Authorization: Bearer <RESEND_API_KEY>"
```

---

## PENDING ITEMS (as of 2026-08-08)

### 1. ElevenLabs "Require Authentication" — CRITICAL
**What:** In the ElevenLabs dashboard, find the Coach Jeff agent → enable "Require authentication" (sometimes called "Private" mode).
**Why:** Until this is done, anyone who has the old agent ID (from before 2026-08-08 when it was client-side) can bypass the page and drive the agent directly. Our code is correct — the agent itself needs to enforce signed-URL-only access.
**How:** ElevenLabs dashboard → Agents → Coach Jeff → Security/Authentication → Enable "Require signed URL" or equivalent toggle.
**Effort:** 5 minutes, one toggle.

### 2. Resend Domain Verification — IMMINENT
**What:** Resend confirming coachjeff.ai DNS records are live.
**Status:** DNS propagated. Awaiting Resend crawler. Automatic — no action needed.
**When:** Hours, not days.

### 3. Crisis Event Logging — FUTURE
**What:** When Coach Jeff reaches a crisis-tier response, the system should log who was in the conversation. The 2026-08-07 incident (anonymous user ran a crisis roleplay) exposed this gap.
**Status:** Not yet built. Requires ElevenLabs webhook on conversation end + KV write.

---

## THINGS THAT WERE DELIBERATELY REMOVED

**ntfy.sh notifications:** Were sending user PII (name, email, phone) to a third-party notification service. Removed entirely in August 2026. All notifications now go through Resend email only.

**Client-side agent ID:** The ElevenLabs agent ID was previously embedded in `index.html` as a JavaScript variable. Removed. Now lives only in `ELEVENLABS_AGENT_ID` Vercel env var, accessed exclusively by `api/get-conversation-token.js`.

**localStorage trial enforcement:** Was the only gate. A user could reset their trial by clearing browser data. Replaced entirely by server-side KV enforcement.

**Fail-open error handling:** Previous code granted access when checks errored. Now all paths fail closed.

---

## HOW TO DEPLOY DNS CHANGES

DNS is managed in Vercel's zone (not GoDaddy — GoDaddy is registrar only, nameservers point to Vercel):

```bash
# Add a DNS record
curl -X POST "https://api.vercel.com/v4/domains/coachjeff.ai/records?teamId=team_joFDgzN7OpTY40TSeO1gDffB" \
  -H "Authorization: Bearer <VERCEL_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "subdomain", "type": "CNAME", "value": "target.example.com", "ttl": 300}'

# List all records
curl "https://api.vercel.com/v4/domains/coachjeff.ai/records?teamId=team_joFDgzN7OpTY40TSeO1gDffB" \
  -H "Authorization: Bearer <VERCEL_TOKEN>"
```

---

## WHAT "DONE" LOOKS LIKE (Rusty's 5-step test)

Run this test after any change to the gate:

1. Open coachjeff.ai in a private window → try to start a conversation without a form → **must be blocked**
2. Enter an email address you don't own → no conversation until you click the link → **must be blocked**
3. Verify a real address → use the 5 minutes → **trial runs and ends**
4. Clear all site data and reload → **still out of minutes** (server-side)
5. Extract any ID from the page and try to call ElevenLabs directly → **refused** (requires ElevenLabs auth toggle — see PENDING ITEMS)

---

## LAUNCH DATE

**Veterans Day — November 11, 2026.** Every decision about quality, security, and veteran safety is made against that date. The product is for combat veterans, some of whom will use it in crisis. "Good enough" is not the standard.

---

## CONTACTS

- **Rusty Humphries** — founder, operator, final decision-maker. rusty@mybffcoach.com
- **Primary domain:** coachjeff.ai
- **App (separate repo):** coach-rusty-mvp (React/TypeScript/Capacitor, on Rusty's Mac at ~/Desktop/mybff-coach)
- **App backend:** Separate system, uses SendGrid/SMTP — not Resend, not related to this site's email setup
