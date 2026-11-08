-- 0001_init.sql — 6dtrust core schema
--
-- Models the vouch graph:
--   identities  = nodes (a person)
--   handles     = lookup keys that resolve to an identity (github / email / domain)
--   vouches     = signed edges "voucher certifies subject at level L"
--   roots       = minted roots, each with its own seed set (trust computed RELATIVE to a root)
--   root_seeds  = the seed members of a root
--   accept_sets = materialized max-flow output (the hot read path)
--   compute_runs= observability for batch recomputes (de-risks the scale question)
--
-- Certification levels follow Advogato: 1=apprentice, 2=journeyer, 3=master.

create extension if not exists "uuid-ossp";

-- A node in the trust graph = a person.
-- 'unclaimed' identities are auto-created when someone vouches for a handle that
-- has no account yet (a dangling handle). They become 'claimed' when the real
-- person signs in and proves control of the handle via OAuth. This is what lets
-- the graph reference non-members, so coverage isn't gated to signups.
create table identities (
    id           uuid primary key default uuid_generate_v4(),
    status       text not null default 'unclaimed'
                   check (status in ('unclaimed', 'claimed')),
    -- latent keypair, added day one. public_key is the portable identity used to
    -- sign vouches; private_key is server-custodied in v1.
    -- SECURITY TODO before any real deploy: encrypt private_key at rest (KMS) or
    -- move key custody to the user. Plaintext here is a local-dev placeholder only.
    public_key   bytea,
    private_key  bytea,
    created_at   timestamptz not null default now(),
    claimed_at   timestamptz
);

-- Verified handles resolving to an identity. GitHub is the hero handle; email is
-- a secondary lookup handle. Multiple handles collapse onto one identity
-- (Keybase-style). A handle may point at an 'unclaimed' identity (dangling).
create table handles (
    id            uuid primary key default uuid_generate_v4(),
    identity_id   uuid not null references identities(id) on delete cascade,
    kind          text not null check (kind in ('github', 'email', 'domain')),
    value         text not null,            -- normalized (lowercased, trimmed)
    verified      boolean not null default false,
    verified_at   timestamptz,
    created_at    timestamptz not null default now(),
    unique (kind, value)
);
create index handles_identity_idx on handles(identity_id);

-- The edges of the trust graph. A vouch is a signed statement
-- "voucher certifies subject at level L", signed by the voucher's key so it is
-- self-authenticating and verifiable without trusting the operator.
create table vouches (
    id           uuid primary key default uuid_generate_v4(),
    voucher_id   uuid not null references identities(id) on delete cascade,
    subject_id   uuid not null references identities(id) on delete cascade,
    level        smallint not null check (level between 1 and 3),
    created_at   timestamptz not null default now(),
    revoked_at   timestamptz,
    signature    bytea,                     -- signature over the canonical vouch payload
    constraint no_self_vouch check (voucher_id <> subject_id)
);
-- at most one active vouch per (voucher, subject); changing level = revoke + new row
create unique index vouches_active_pair_idx
    on vouches(voucher_id, subject_id) where revoked_at is null;
create index vouches_subject_idx on vouches(subject_id) where revoked_at is null;

-- A root = a minted seed set. Trust is computed RELATIVE to a root. Levien hard-wired one global
-- seed; we mint many.
create table roots (
    id           uuid primary key default uuid_generate_v4(),
    owner_id     uuid references identities(id) on delete set null,
    slug         text not null unique,      -- e.g. 'rust-core', 'anti-ai'
    name         text not null,
    visibility   text not null default 'public'
                   check (visibility in ('public', 'private')),
    created_at   timestamptz not null default now()
);

-- The seed members a root's flow starts from.
create table root_seeds (
    root_id      uuid not null references roots(id) on delete cascade,
    identity_id  uuid not null references identities(id) on delete cascade,
    primary key (root_id, identity_id)
);

-- Materialized output of the per-root max-flow: who is accepted, at what level.
-- Hot read path (badge / "is X trusted under root R") — O(1) lookup. Recomputed
-- in batch by the compute worker; node capacity is derived at compute time from
-- distance-to-seed and is NOT stored here.
create table accept_sets (
    root_id      uuid not null references roots(id) on delete cascade,
    identity_id  uuid not null references identities(id) on delete cascade,
    level        smallint not null check (level between 1 and 3),
    computed_at  timestamptz not null default now(),
    primary key (root_id, identity_id)
);

-- Observability for batch recomputes — gives us real numbers on the scale question.
create table compute_runs (
    id              uuid primary key default uuid_generate_v4(),
    root_id         uuid references roots(id) on delete cascade,
    started_at      timestamptz not null default now(),
    finished_at     timestamptz,
    node_count      integer,
    edge_count      integer,
    accepted_count  integer,
    duration_ms     integer
);
