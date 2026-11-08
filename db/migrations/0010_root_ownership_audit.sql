-- 0010: attributable authority over roots.
--
-- Two changes, one theme — every consequential root change records WHO did it:
--   1. add actor_id to root_seed_events (who added/removed the seed, not just what)
--   2. root_owner_events: the ownership-transfer audit (community takeover + the
--      admin reclaim "kill-switch"), old -> new owner, by whom, when.
-- Both actor columns are `on delete set null` so deleting an identity doesn't
-- erase the history of what it did.

alter table root_seed_events
    add column actor_id uuid references identities(id) on delete set null;

create table root_owner_events (
    id           bigserial primary key,
    root_id      uuid not null references roots(id) on delete cascade,
    old_owner_id uuid references identities(id) on delete set null,
    new_owner_id uuid references identities(id) on delete set null,
    actor_id     uuid references identities(id) on delete set null,
    at           timestamptz not null default now()
);
create index root_owner_events_root_idx on root_owner_events(root_id);
