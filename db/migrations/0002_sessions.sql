-- 0002_sessions.sql — auth sessions + stable GitHub account id

create table sessions (
    id           text primary key,                 -- sha256(token) hex
    identity_id  uuid not null references identities(id) on delete cascade,
    expires_at   timestamptz not null,
    created_at   timestamptz not null default now()
);
create index sessions_identity_idx on sessions(identity_id);

-- GitHub usernames can change; the numeric account id is stable. Store it for
-- verified github handles so logins survive renames and bind to the right node.
alter table handles add column provider_account_id text;
create unique index handles_github_account_idx
    on handles(provider_account_id) where provider_account_id is not null;
