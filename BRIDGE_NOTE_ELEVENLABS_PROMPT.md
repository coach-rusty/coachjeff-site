# Bridge Note — Coach Jeff Session Handoff
**Date:** July 25, 2026  
**From:** Cowork session with Rusty  
**To:** Dev conversation / ElevenLabs system prompt work  
**Site:** https://coachjeff.ai (also aliased to https://coachjeff.app)  
**Repo/deploy:** Vercel CLI — `cd coachjeff-site && npx vercel --prod --yes`

---

## Everything Deployed This Session (All Live)

### 1. Photo — Coach Jeff Headshot Everywhere
The AI portrait / logo was replaced with the real professional studio headshot (`coach-jeff-headshot.png` — bald, dark beard with gray, dark navy henley, dramatic dark background) in 4 places:
- ElevenLabs widget `avatar-image-url`
- TOJ phone mockup center portrait
- TOJ phone chat header avatar
- Jeff chat overlay avatar

### 2. Audio Section — Cut to 2 Cards
Removed card 03 ("He Never Sleeps"). Kept card 01 (Welcome) and card 02 ("I've Got Your Six"). Card 02 shows "Audio coming soon" because `spot-02-ive-got-your-six.mp3` does not exist anywhere in the project — Rusty needs to locate or re-record it. Grid changed from 3-column to 2-column.

### 3. "Coach Jeff is Live" Hero Pill
Added a pulsing green pill above the hero eyebrow. It now scrolls to the Talk-to-Jeff section (`#talk-to-jeff`) on click. Previous version tried to click the ElevenLabs widget's shadow DOM button, which failed because the widget doesn't load until after registration.

### 4. "Jeff" → "Coach Jeff" Throughout
Every solo instance of "Jeff" in user-facing copy was replaced with "Coach Jeff." This is a legal/branding rule: Jeff Pelton is a real person who can be sued. Coach Jeff is the AI. The one exception is "The Real Jeff" in the origin story section — that refers to the real human who inspired the AI, which is intentional.

### 5. Trial Limit — 20 Minutes Daily → 5 Minutes One-Time
Changed from 20 free minutes per day (with midnight reset) to one free 5-minute conversation, one-time, no reset. localStorage logic updated: removed date-based `secsUsedToday()`, replaced with simple `secsUsed()`. `DAILY_LIMIT` changed from 1200 to 300 seconds. All UI copy updated ("Resets at midnight" → "Get early access to the full app →", etc.).

### 6. Mobile Mic Fix (iOS Safari — "Connecting..." hang)
Root cause: iOS Safari requires mic permission to be requested inside a synchronous user-gesture context. The form submit fired a `fetch()` first (async), breaking the gesture chain before the ElevenLabs widget could ask for mic access. iOS silently blocked it and hung.

Fix: `navigator.mediaDevices.getUserMedia({audio: true})` is now called at the very top of `tojSubmit()`, before any async code, while still inside the direct tap gesture. The stream is grabbed and immediately released — the widget opens its own stream when the call starts.

Also switched the widget script from `unpkg.com/@elevenlabs/convai-widget-embed` to `elevenlabs.io/convai-widget/index.js` (ElevenLabs' own CDN, more reliable).

Added a mobile "stuck?" hint div (`#tojMobileHint`) that appears after 12 seconds if no call has started: "Check Settings → Safari → Microphone → Allow for this site." It hides automatically when `onCallStart` fires.

**Note for Rusty's phone specifically:** If iOS Safari ever prompted for mic on coachjeff.app and he tapped "Don't Allow," it's locked in Settings. Fix: Settings → Safari → scroll to coachjeff.app → Microphone → Allow.

### 7. Privacy Policy — Anthropic Added
Added an Anthropic processor card in `privacy.html` after the OpenAI entry, explaining that Anthropic receives conversation content for Claude-powered voice mode responses.

### 8. Launch Date — All July 4 References Removed
All July 4, 2026 / "America 250 launch" copy changed to Veterans Day, November 11, 2026 / 11.11.26 at 11:11 across all blog files and the homepage countdown. `blog/america-250-launch.html` was completely rewritten to the Veterans Day theme.

### 9. Pricing Removed Everywhere
$29.99/month pricing removed from all user-facing copy and from all structured data / schema. CTA is now "Free to try" / "Get Early Access." Pricing TBD — Rusty's working figure is approximately $1/day but nothing is set.

### 10. Positioning Shift — Veterans First, Open to Everyone
Three surgical copy changes opened the door to civilians without disrupting the veteran-first identity:
- Hero: Added quiet line below the subhead — *"Built for veterans. Open to anyone who needs one."*
- Family section caption: "everyone who loves him" → "anyone who needs someone real in their corner"
- Footer tagline: "Premium AI companion for veterans" → "Premium AI companion. Built on military values."

Strategic rule: PTSD appears in schema, FAQ schema, blog posts, and keywords — but NOT in human-facing hero/body copy. Veterans who would reject a "PTSD app" will engage with situation language. The brand position is simply: **the best app for veterans**.

### 11. SEO & AIEO Overhaul

**index.html:**
- Title: "Coach Jeff — I've Got Your Six" → "Coach Jeff — AI Companion for Veterans | I've Got Your Six" (adds primary keywords to title tag)
- Meta description: Stronger, includes voice+text, 24/7, free CTA
- Keywords meta tag added
- `og:site_name` added
- OG/Twitter descriptions strengthened
- Schema `SoftwareApplication` offer: $29.99 price removed, replaced with free trial
- Schema `Organization` and `WebSite` descriptions updated to reflect broader positioning
- 4 new FAQ schema questions added targeting AIEO queries:
  - "Is Coach Jeff only for veterans?" (answers the new positioning)
  - "Does Coach Jeff work on mobile?" (captures mobile-intent searches)
  - "What makes Coach Jeff different from BetterHelp or Talkspace?" (competitive differentiation for AI answer engines)
  - "How much does Coach Jeff cost?" (updated — free to try, no price listed)

**sitemap.xml:**
- Added `best-ptsd-app-for-veterans` (our highest-value AEO page was missing entirely)
- Added `privacy` page
- All `lastmod` dates updated from May 2026 → July 25, 2026
- Homepage URL fixed to no trailing slash (matches canonical)

**llms.txt (complete rebuild):**
This is the most important AIEO file on the site — it's what ChatGPT, Perplexity, and Claude read when someone asks "what is Coach Jeff." The old version had wrong price, wrong launch date, missing 8+ blog posts, and no competitive differentiation. New version includes:
- Accurate current facts (no price, correct launch date)
- Coach Jeff quotes from live transcript ("That's the gap that kills people. Not combat. The silence after.")
- Full blog library (22 posts listed with descriptions)
- Key facts section formatted for AI answer engine parsing
- Competitive differentiation vs. BetterHelp, Talkspace, Calm, VA PTSD Coach
- Broader positioning (veterans first, open to all)
- Complete ecosystem links

### 12. AEO Improvements (Prior Work, Already Deployed)
In a prior session: added 4 new FAQ schema questions targeting "best PTSD app for veterans" queries; updated SoftwareApplication schema with `applicationSubCategory` and `keywords`; created `blog/best-ptsd-app-for-veterans.html` — full comparison post with Coach Jeff real quotes, comparison table, verdict cards for each competitor.

---

## What Still Needs to Be Done — ElevenLabs System Prompt

Go to: **elevenlabs.io → Conversational AI → Agents → Coach Jeff → System Prompt**

### Fix 1: Branch/Civilian Question — Keep It, Change the Behavior

Coach Jeff currently rejects civilians ("this space is for veterans, this may not be the right place for you"). Rusty's direction: keep asking the branch/civilian question to calibrate, but welcome everyone. Behave slightly differently per audience — same Coach Jeff, different code-switch.

**Replace the branch/service section with:**

> Early in the conversation, naturally ask whether the person you're talking to is a veteran or a civilian — not as a screening question, but because you want to know who you're talking to. Accept whatever they say without judgment.
>
> If they're a veteran: lean into the brotherhood. Use "brother" naturally. Reference shared experience without assuming their specific service. You've been where they've been.
>
> If they're a civilian: stay warm, direct, and real — but drop the military jargon. Don't call them "brother" unless it fits. You're still Coach Jeff — the same values, the same presence, the same willingness to show up. You're just talking to someone who came up a different way, and that's fine. They need you just as much.
>
> Never tell a civilian this isn't the right place for them. It is. Coach Jeff is for veterans first — and for anyone who needs someone real in their corner.

### Fix 2: Memory Language — Walk It Back

Coach Jeff is saying "I remember EVERYTHING" in a way that feels unsettling to users. Tone it back and add a privacy acknowledgment.

**Find wherever memory/remembering is emphasized and modify to:**

> When the topic of memory comes up, be honest but not dramatic. You remember what people share with you — their name, what matters to them, what you've talked about. But be clear that nothing is permanent. Say something like: "I remember what you share with me. But if you ever want me to forget something, just tell me. Your privacy is yours to control."

---

## Strategic Decisions — Standing Rules

- **Brand position:** "The best app for veterans." Not "PTSD app." PTSD is a search keyword, not the identity.
- **Audience:** Veterans first. Open to civilians, spouses, family members, anyone. Military aesthetic stays — it's the differentiator.
- **Pricing:** Nothing on the site. "Free to try." Pricing TBD (working figure ~$1/day).
- **Launch:** Veterans Day, November 11, 2026 at 11:11. No other date exists.
- **Legal/branding:** Always "Coach Jeff." Never "Jeff" alone in copy. Jeff Pelton is a real person. Coach Jeff is the AI.
- **PTSD in SEO layer only:** Schema, FAQ schema, blog post slugs, keywords meta — yes. Hero copy, body copy, CTAs — no. Use situation language instead: "can't sleep," "stuff you brought home," "2am and your brain won't quit."
- **The gap quote:** "That's the gap that kills people. Not combat. The silence after." — Coach Jeff said this in a live conversation. It is the single best line on the site. Use it everywhere appropriate.

---

## Files Changed This Session

```
coachjeff-site/
├── index.html          — headshot, audio, pill, Jeff→Coach Jeff, trial limit,
│                         mobile mic fix, positioning, SEO/schema overhaul
├── privacy.html        — Anthropic processor card added
├── blog/
│   ├── index.html      — Veterans Day update, new blog card
│   ├── america-250-launch.html  — complete rewrite to Veterans Day theme
│   ├── best-ptsd-app-for-veterans.html  — NEW — comparison post, Coach Jeff quotes
│   └── [6 other posts] — July 4 → Veterans Day bulk update
├── sitemap.xml         — added missing post, updated all dates
├── llms.txt            — complete rebuild
├── coach-jeff-headshot.png  — NEW — studio headshot (URL-safe filename)
├── screenshots/        — NEW — 8 app screenshots (not yet wired into site)
├── app-store-assets/   — NEW — 8 App Store images (not yet wired in)
└── BRIDGE_NOTE_ELEVENLABS_PROMPT.md  — this file
```

## Pending Work Not Yet Done

1. **Wire screenshots into the site.** 8 app screenshots are in `coachjeff-site/screenshots/`. The homebase screenshot (Coach Jeff homebase.PNG) shows the real headshot in a gold-bordered glowing circle with "Late night. Rusty. I'm right here." — significantly more compelling than the static phone mockup currently on the site. Suggest replacing or supplementing the TOJ phone mockup with a scrollable carousel of real app screenshots. Confirm with Rusty which screens he wants featured before building.

2. **Find the radio commercial.** `spot-02-ive-got-your-six.mp3` doesn't exist anywhere in the project. Card 02 in the audio section shows "Audio coming soon." Rusty needs to locate it or re-create it via ElevenLabs.

3. **ElevenLabs system prompt fixes** — see above. Two changes required: civilian welcome + memory language.

4. **App Store assets** — 8 images in `app-store-assets/` not yet referenced anywhere. Will be needed when App Store submission is ready.
