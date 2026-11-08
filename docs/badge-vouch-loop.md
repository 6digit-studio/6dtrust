# Badge → profile vouch loop

**Depends on:** upgrade-only vouch; trust read API nice-to-have for links  
**Touches:** `src/routes/u/[handle]/`, landing badge snippet, maybe `src/routes/badge/`

## Problem

README badge shows Pending but isn't clickable; profile CTA sends you to empty
dashboard. Viral loop needs: see Pending → land → one-click Known (root-aware).

## Done when

- [ ] README snippet docs / copy-paste use **link-wrapped** badge:
      `[![trust](…/badge/{root}/{handle})](…/u/{handle}?root={root})`
- [ ] Landing page + `/r/[slug]` embed snippets updated
- [ ] `/u/[handle]?root=osc` highlights that root; shows trust readout
- [ ] Logged-in user: Known / Vouch / Trust buttons on profile (upgrade-only), pre-filled subject
- [ ] Logged-out: sign-in link preserves return URL
- [ ] Copy explains Pending = "not in this root's graph yet — vouch if you've worked with them"
- [ ] Optional: redirect route `/go/trust/{root}/{handle}` → profile with root param

## Out of scope

- Inbox (separate surface)
- Inline recompute (still cron unless upgrade-only PR adds hook)

## Test plan

- Logged in as seed-adjacent user, profile → Known → vouch row exists
- Already Trusted → Known disabled or no-op
