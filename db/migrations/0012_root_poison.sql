-- 0012: per-root poison — context-relative *no*. A root can EXCLUDE a node, not
-- only include via seeds. A poisoned node is forced to capacity 0 in THIS root's
-- flow, so it both drops out of the accept set AND stops conducting trust through
-- itself (maxflow.ts: a cap-0 node gets no accept-unit edge and no cert edges).
--
-- This is owner-curated, public, and reasoned (the `reason` is meant to be shown).
-- It is NEVER aggregated across roots into any computation — poison lives strictly
-- inside the root that declared it. "N roots exclude X" is showable as data, never
-- an input to a score (SCENE: the sixth "no" — no global blocklist).
create table root_poison (
    root_id      uuid not null references roots(id) on delete cascade,
    identity_id  uuid not null references identities(id) on delete cascade,
    reason       text not null default '',   -- public, owner-stated; "why, not here"
    created_at   timestamptz not null default now(),
    primary key (root_id, identity_id)
);
