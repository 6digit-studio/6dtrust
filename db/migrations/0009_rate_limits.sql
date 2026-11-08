-- 0009_rate_limits.sql — per-key fixed-window rate limiting (security S5/S6).
--
-- Serverless functions share no memory, so a counter has to live somewhere both
-- request instances can see it. This table is that store: one row per bucket
-- (e.g. 'vouch:<identity-uuid>'), holding the current window's start and count.
-- checkRateLimit() (src/lib/server/rate-limit.ts) does a single atomic upsert per
-- check — increment inside the live window, reset when it's expired.
--
-- Only the AUTHENTICATED, low-QPS actions are limited here (vouch, seed, triage),
-- which is why a DB-backed counter is fine — write volume tracks human actions,
-- not the always-on read flood. The public read path (/trust, /badge) is rate-
-- limited at the edge (Vercel Firewall), deliberately NOT here, so the cached read
-- path stays off the DB.
create table rate_limits (
    bucket       text primary key,
    window_start timestamptz not null,
    count        integer not null
);

-- Lets a cheap opportunistic sweep reclaim long-idle buckets by age.
create index rate_limits_window_idx on rate_limits (window_start);
