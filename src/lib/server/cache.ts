// Cache policy for the public read path — badges (compact + branded) and the
// trust JSON. These are pure functions of (root, handle) that only change when a
// root recomputes, so they cache hard at the edge. That edge cache is the lever
// that keeps the always-on read traffic — a README badge hit by GitHub's camo
// proxy, crawlers, and CI around the clock — OFF the compute DB, so Postgres can
// actually scale to zero between writes.
//
// Deliberately portable: standard `Cache-Control` only, honored by Vercel's CDN
// and Bunny pull zones alike — no provider-specific cache API, so a move off
// Vercel is a config change, not a rewrite. One source of truth here keeps the
// three endpoints from drifting.
//
//   - s-maxage caps ORIGIN hits to ~1 per window per edge PoP, independent of
//     request volume (1000 README views in an hour = at most one DB wake per PoP).
//   - stale-while-revalidate serves the cached copy instantly and refreshes in
//     the background, so a viewer never blocks on a cold Postgres wake.
//   - max-age keeps a short browser-local cache without holding stale art for long.
//
// Staleness is bounded by S_MAXAGE. Recompute is infrequent today (manual; a
// planned ~6h cadence on the compute box), so an hour reads as fresh. The
// instant-invalidation upgrade — purge-on-recompute via a provider tag API
// behind a portable seam — is the next step only if sub-hour freshness is needed.
const BROWSER_MAXAGE = 300; // 5 min in the browser
const CDN_S_MAXAGE = 3600; // 1 h at the edge
const STALE_WHILE_REVALIDATE = 86_400; // serve stale up to a day while revalidating

export const READ_CACHE_CONTROL = `public, max-age=${BROWSER_MAXAGE}, s-maxage=${CDN_S_MAXAGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`;
