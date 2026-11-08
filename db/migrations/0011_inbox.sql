-- 0011: inbox suggestions — a maintainer's queue of people to consider vouching
-- for (merged PRs now, reviews later). Suggestions, never auto-written edges.
create table inbox_suggestions (
    id             bigserial primary key,
    voucher_id     uuid not null references identities(id) on delete cascade,
    subject_github text not null,
    source         text not null,          -- e.g. 'github:merge'
    context        jsonb not null default '{}'::jsonb,
    created_at     timestamptz not null default now(),
    last_seen_at   timestamptz not null default now(),
    dismissed_at   timestamptz,
    acted_at       timestamptz,
    acted_level    smallint
);

-- At most one OPEN suggestion per (voucher, subject, source). "Open" = not yet
-- dismissed or acted on — a PARTIAL unique index, so a fresh merge after a
-- dismiss/act creates a new suggestion instead of being blocked.
create unique index inbox_open_unique
    on inbox_suggestions (voucher_id, subject_github, source)
    where dismissed_at is null and acted_at is null;

-- The hot read: a maintainer's open queue.
create index inbox_voucher_open_idx
    on inbox_suggestions (voucher_id)
    where dismissed_at is null and acted_at is null;
