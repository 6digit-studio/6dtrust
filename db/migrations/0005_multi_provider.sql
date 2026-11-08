-- 0005: multi-provider login + the anchor model.
--
-- Login opens to any provider; trust stays anchored. The schema was already
-- provider-agnostic (identities is an abstract person-node; handles is a
-- multi-kind lookup table), so this is additive:
--   1. widen handles.kind to admit pure-auth providers
--   2. add a user-editable display_name
--   3. fix an index name that was mislabeled github-specific at birth
--
-- The anchor/auth split itself lives in code (src/lib/server/anchor.ts), the
-- single source of truth for which kinds are costly, public, discoverable
-- anchors vs. private login methods. Adding a new anchor (a verified domain,
-- GitLab, ...) is a one-line change there plus a kind here.

-- Anchors (github; domain latent) are the costly, public, discoverable
-- identities the trust graph keys on. Auth-only providers (google, facebook,
-- discord) link to the same identity but never anchor trust and are never shown.
alter table handles drop constraint handles_kind_check;
alter table handles add constraint handles_kind_check
    check (kind in ('github', 'domain', 'email', 'google', 'facebook', 'discord'));

-- provider_account_id (added in 0002) is a stable per-provider account id for ANY
-- provider, not just github — the index was misnamed when github was the only one.
alter index handles_github_account_idx rename to handles_provider_account_idx;

-- A human-friendly, user-editable label. Shown ALONGSIDE the anchor handle
-- (e.g. "Linus Torvalds · @torvalds"), never instead of it — the anchor handle
-- stays the source of truth for who an identity is.
alter table identities add column display_name text;
