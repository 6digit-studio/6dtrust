-- 0006_admin.sql — system administrators
--
-- Root minting is operator-gated, not open: anyone-creates-a-root makes the
-- service DOA (slug-namespace land-grab, junk roots, impersonation surface), and
-- the genuinely-trusted roots are meant to float organically from a curated
-- start. `is_admin` is the gate — only admins mint roots and reach the /admin
-- section. Defaults false; the bootstrap admin(s) are promoted on login from the
-- ADMIN_GITHUB_HANDLES env list (see identity.ts), so admin status survives a DB
-- reset and needs no manual prod-DB surgery.
alter table identities add column is_admin boolean not null default false;
create index identities_admin_idx on identities (is_admin) where is_admin;
