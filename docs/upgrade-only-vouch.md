# Upgrade-only vouch + distance at recompute

**Blocks:** trust read API, inbox actions, profile one-click vouch  
**Touches:** `src/lib/server/vouch.ts`, `src/lib/server/trust/worker.ts`, `src/lib/server/trust/maxflow.ts`, migration

## Problem

`createVouch` revokes any existing edge and inserts the requested level — a merge
suggestion at Known would downgrade someone you already Trusted.

Distance from seeds is computed during max-flow BFS but discarded; trust JSON
needs it materialized.

## Done when

- [ ] `createVouch` accepts `minLevel` or separate `upgradeVouch()` — no-op if active vouch ≥ target
- [ ] Demotions only via explicit revoke (unchanged)
- [ ] Migration adds `distance smallint` to `accept_sets` (nullable ok for backfill)
- [ ] Worker writes `distance` for every accepted row at recompute (BFS dist from nearest seed)
- [ ] Optionally store reachable-but-not-accepted distance elsewhere later — **not in v1**
- [ ] Tests: upgrade skips downgrade; distance persisted on recompute fixture

## Out of scope

- Inbox UI
- Trust JSON route (separate brief, same PR ok)

## Notes

- Seeds have distance 0, `isSeed` already derivable from `root_seeds`
- Pending identities not in accept_set have no row — API returns `distance: null`
