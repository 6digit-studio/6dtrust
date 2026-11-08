# Trust read API

**Depends on:** distance in `accept_sets`, contract in [roadmap.md](./roadmap.md)  
**Touches:** new route `src/routes/trust/[root]/[handle]/+server.ts` (or `.json` suffix), shared loader in `src/lib/server/trust/readout.ts`

## Problem

Badge is SVG-only. Integrators (PR bots, README tooling, inbox UI) need level,
distance, and stable URLs in JSON.

## Done when

- [ ] `GET /trust/{root}/{handle}.json` returns contract shape from roadmap
- [ ] Public roots only (same visibility rule as badge)
- [ ] Unknown handle with no identity: `level: 0`, `accepted: false`, `status: null`, `distance: null`, 200
- [ ] `computedAt` from accept_set row when present, else null
- [ ] `Cache-Control` similar to badge (~5 min) — materialized read
- [ ] Badge route unchanged; JSON is additive

## Out of scope

- Auth / rate limits
- Private roots (paid tier later)
- Webhook or inbox

## Test plan

- Fixture root + accept_set row → correct level + distance
- Handle not in graph → pending payload, 200
- Bad slug → 404
