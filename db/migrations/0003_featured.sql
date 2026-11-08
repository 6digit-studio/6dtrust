-- 0003_featured.sql — operator-curated homepage demo roots
--
-- The public landing renders a live divergence demo. We must NOT surface every
-- public root there: that would leak arbitrary users' roots and handles onto the
-- home page, and labelling a real person "unrated" on the front page is exactly
-- the scarlet-letter failure this project is careful to avoid. `featured` lets
-- the operator explicitly curate which public roots appear in the homepage
-- showcase. Public-but-unfeatured roots still work everywhere else (badges,
-- direct links); they're just not paraded on the landing.
alter table roots add column featured boolean not null default false;
create index roots_featured_idx on roots (featured) where featured;
