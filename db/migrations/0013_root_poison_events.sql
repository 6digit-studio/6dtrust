-- 0013: poison on the public record. A reasoned exclusion is a governance act —
-- it belongs in the same open log as seed edits and ownership transfers (no
-- silent moderation). Mirrors root_seed_events, with two differences:
--   - `reason` is captured ON the event, so the *why* survives even after the
--     node is un-poisoned and the live root_poison row is gone.
--   - actor_id is present from the start (this table is born post-0010).
create table root_poison_events (
    id          bigserial primary key,
    root_id     uuid not null references roots(id) on delete cascade,
    identity_id uuid not null references identities(id) on delete cascade,
    action      text not null check (action in ('added','removed')),
    reason      text not null default '',
    actor_id    uuid references identities(id) on delete set null,
    at          timestamptz not null default now()
);
create index root_poison_events_root_idx on root_poison_events(root_id);
