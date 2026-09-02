# COACHJEFF SITE — BRIDGE NOTE
**Date:** May 1, 2026  
**Session ended:** Mid-fix pass, after Bible v3.0 update  
**Next session:** Start here

---

## WHERE WE ARE

The site (`index.html`, ~3728 lines) is architecturally sound and looking good. Rusty did a full scroll-through review and gave specific section-by-section feedback. That feedback has been documented. The Bible (v3.0) is fully current. 

**The site is NOT yet deployed.** It runs as a local file. Vercel deployment is a future step.

---

## WHAT RUSTY APPROVED (Locked — don't revisit)

- Footer logo: using `coach-jeff-logo.png` with text. Rusty: "Looks great."
- Phone 3 (Jeff conversation screen): Rusty: "That last phone screen is much better."
- $365 pricing: Rusty: "Looks great." (minor cut-off fix still needed, but design confirmed)
- New icon/logo: Transparent Canva exports confirmed. `coach-jeff-icon.png` and `coach-jeff-logo.png` are the final masters.
- Origin story copy: Updated with Rusty's exact words. Locked.
- Testimonials: Updated. Good enough to ship.

---

## WHAT TO FIX NEXT SESSION (Priority Order)

Work these in order. One at a time. Do not stack.

### 1. NAV: Icon → Logo  *(5 minutes)*
**Change:** Line ~2313 in `index.html`  
`src="coach-jeff-icon.png"` → `src="coach-jeff-logo.png"`  
Also update `.nav-logo-icon` CSS — the logo is horizontal (has "COACH JEFF" text), so the 80×80 square sizing won't work. Suggested: `height: 52px; width: auto; max-width: 200px`. Test that it doesn't overflow nav at narrow viewports.

### 2. Hero Headline Cut Off *(10 minutes)*
**Problem:** H1 is cropped behind the fixed nav on load.  
**Fix:** Add `padding-top` to `#hero` section to clear the fixed nav height. Nav is approximately 80–90px tall. Try `padding-top: calc(var(--pad) + 80px)` or a hard `padding-top: 120px` on the hero section. Check that the hero content still looks vertically balanced after the fix.

### 3. Chat Popup — Verify + Fix *(15 minutes)*
**Problem:** Rusty says audio plays fine but chat popup doesn't appear.  
**Most likely cause:** Rusty was testing by clicking the SPOT CARD (audio spots section), which calls `playSpot(0)`. That function does NOT call `showJeffChat()`. Only the HERO "Hear Jeff's voice" button triggers the overlay.  
**Action:** First confirm with Rusty which button he was clicking. If he was using the hero button and it still doesn't work, the JS needs debugging:  
- Add `console.log('showJeffChat called')` inside `showJeffChat()` to confirm it fires  
- Check if `.visible` is being added to `#jeff-chat-overlay`  
- Check z-index stacking — overlay is z-index 9999 which should be fine  
- The overlay uses `position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%)` — confirm it's rendering in viewport

### 4. Calming Sounds Screen — Full Rebuild *(45–60 minutes)*
**Problem:** Phone 4 still not matching the real app. Rusty: "so bad it's offensive."  
**Action:** Read the FULL source file — not just first 200 lines:  
`~/Desktop/mybff-coach/apps/coach-jeff/src/screens/Screen04_CalmingSounds/prototype/Screen04_CalmingSounds_FINAL.html`  
Read the entire file (it's longer than 200 lines). Get the complete player layout, track list structure, waveform visualization, category tabs (Standard / Dreamscapes), and exact UI elements. Then rebuild Phone 4 in `index.html` to match exactly.  

**Known colors (from source):**
- Background: `linear-gradient(160deg, #C9A875 0%, #B39365 50%, #A88B5F 100%)` (brass/gold — NOT dark navy)
- Accent: therapeutic sage greens
- Camo radial-gradient overlay on top

**Known tracks:**
- Standard: creek, ocean, rain, forest, fire, whitenoise, brownnoise, night
- Dreamscapes: aurora, breathing, drifting, seascape, serenity, song_of_heaven, tibetan

### 5. Jeff Info / Harley Overlap *(20 minutes)*
**Problem:** Jeff's dossier card bleeds into / overlaps the motorcycle photo.  
**Section:** `#who-jeff-is`  
**Fix:** The Harley photo should sit BELOW the dossier card, not beside it in a way that causes overlap. Look at the current HTML structure for `.jeff-photos` and the dossier card. Either add `margin-top` to push the photo down, or change the layout to stack photo below card on all screen sizes.

### 6. $365 Cut Off *(5 minutes)*
**Problem:** The large $365 number is slightly clipped at the bottom.  
**Section:** `#pricing`  
**Fix:** Add `padding-bottom` to the pricing stat element, or `overflow: visible` to the container. Small tweak.

### 7. Footer Logo Size *(2 minutes)*
**Change:** In the footer `<img>` tag for `coach-jeff-logo.png`:  
`height:64px` → `height:80px`

### 8. Rain Effect Expansion *(15 minutes)*
**Problem:** Rain canvas animation is too narrow — only covers a small area under the logo, not the full hero.  
**Fix:** Find the rain canvas JS (in the main script block, look for the rain drawing code). Ensure `rainCanvas.width` is set to `window.innerWidth` and the rain drops are distributed across the full width. There may be a CSS constraint or canvas size issue.

---

## FILE LOCATIONS

| What | Where |
|------|-------|
| Main site file | `/Users/rustyhumphries/Documents/Claude/Projects/Rusty Humphries Projects/coachjeff-site/index.html` |
| This Bible | `/Users/rustyhumphries/Documents/Claude/Projects/Rusty Humphries Projects/coachjeff-site/COACHJEFF_SITE_BIBLE.md` |
| This bridge note | `/Users/rustyhumphries/Documents/Claude/Projects/Rusty Humphries Projects/coachjeff-site/BRIDGE_NOTE.md` |
| Real app (calming sounds) | `~/Desktop/mybff-coach/apps/coach-jeff/src/screens/Screen04_CalmingSounds/prototype/Screen04_CalmingSounds_FINAL.html` |
| Real app screens folder | `~/Desktop/mybff-coach/apps/coach-jeff/src/screens/` |

**Bash paths (for shell tools):**
- Site folder: `/sessions/kind-trusting-lovelace/mnt/Rusty Humphries Projects/coachjeff-site/`
- App folder: `/sessions/kind-trusting-lovelace/mnt/` (check mount for mybff-coach — may be separate)

---

## WHAT'S WORKING — DO NOT BREAK

- CSS camo pattern (pure CSS, not PNG — don't replace)
- IntersectionObserver stat counters (not ScrollTrigger — reliable on file://)
- btn-ghost CSS reset (background: transparent, border: none, -webkit-appearance: none)
- Jeff voice quote — exact Rusty words, never paraphrase
- Dossier data — Canon-locked (Panama, Desert Storm, Hurricane Hugo, 1989-1997)
- Threshold section — don't remove (Imagineering pre-show beat)
- Footer logo — confirmed looking good by Rusty

---

## CONTEXT ON RUSTY

- NOT a developer. Operator and creative director.
- Direct feedback, no fluff needed back.
- Quality bar: Apple + Silicon Valley + Disney Imagineering + best ad minds. No exceptions.
- He will iterate until it's right. Don't suggest shortcuts.
- When he says "offensive" (re: calming sounds) — that means rebuild from scratch, not tweak.
- "These guys deserve it" = the veterans using this app. That's the standard for every decision.
