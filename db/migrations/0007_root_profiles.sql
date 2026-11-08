-- 0007_root_profiles.sql — optional identity chrome for public root pages
--
-- Substance (seeds, accept-set, badges) is always shown on /r/[slug]. Rich
-- branding (avatar, tagline, description, links) renders only when featured —
-- the same operator curation gate that guards the landing demo.

alter table roots add column tagline text;
alter table roots add column description text;
alter table roots add column avatar_url text;
alter table roots add column homepage_url text;

create table root_links (
    id         uuid primary key default uuid_generate_v4(),
    root_id    uuid not null references roots(id) on delete cascade,
    label      text not null,
    url        text not null,
    sort_order smallint not null default 0
);
create index root_links_root_idx on root_links(root_id);
