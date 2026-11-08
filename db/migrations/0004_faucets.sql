-- 0004: the watcher faucets.
--
-- Event history the write paths were discarding, specified by two
-- independently-converged ontology floats (2026-06-11): membership churn,
-- seed-edit history, triage reads, reachable-mass. Together with the
-- vouch revoke-plus-insert fix (code-side, honoring 0001's own design
-- comment at the vouches table), these make the system's regime changes
-- watchable instead of inferable.

-- Membership churn: who entered/left/changed level in a root's worldview,
-- written by the recompute worker in the same transaction that replaces
-- accept_sets. The single highest-value faucet per both floats.
create table accept_set_events (
    id             bigserial primary key,
    compute_run_id uuid references compute_runs(id) on delete cascade,
    root_id        uuid not null references roots(id) on delete cascade,
    identity_id    uuid not null references identities(id) on delete cascade,
    event          text not null check (event in ('entered','exited','level_up','level_down')),
    old_level      integer,
    new_level      integer,
    at             timestamptz not null default now()
);
create index accept_set_events_root_at on accept_set_events (root_id, at);

-- Seed edits: the most regime-changing single act in the system (it moves
-- the flow's origin) previously left no trace at all.
alter table root_seeds add column created_at timestamptz not null default now();
create table root_seed_events (
    id          bigserial primary key,
    root_id     uuid not null references roots(id) on delete cascade,
    identity_id uuid not null references identities(id) on delete cascade,
    action      text not null check (action in ('added','removed')),
    at          timestamptz not null default now()
);

-- Demand side: the triage read is the product's relief moment; its
-- trusted/earn-it split previously evaporated at page render.
create table triage_reads (
    id                 bigserial primary key,
    root_id            uuid not null references roots(id) on delete cascade,
    repo               text not null,
    total              integer not null,
    trusted_count      integer not null,
    earnit_count       integer not null,
    computed_at_served timestamptz,
    at                 timestamptz not null default now()
);

-- Attack pressure: reachable-but-not-accepted mass is what a sybil fan-out
-- looks like from inside; the engine always knew it and dropped it.
alter table compute_runs add column reachable_count integer;
