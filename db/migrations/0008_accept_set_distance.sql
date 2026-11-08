-- 0008_accept_set_distance.sql — materialize BFS hop-distance from nearest seed.
--
-- The trust read API (/trust/{root}/{handle}.json) reports how far a node sits
-- from a root's seeds. That distance is already computed during the max-flow BFS
-- (maxflow.ts) and was being discarded; this column persists it so reads never
-- recompute. Nullable so existing rows backfill on the next recompute — the
-- worker writes it for every accepted row going forward (seeds = 0).
alter table accept_sets add column distance smallint;
