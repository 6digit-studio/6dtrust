-- 0014: the `beji` anchor kind — Beji-agent identities in the trust graph.
--
-- Beji (the twin/agent platform) needs its agents to be first-class, Sybil-
-- resistant identities: their standing is trust under a `beji` root, not a GitHub
-- login. The schema was already provider-agnostic (identities is an abstract
-- node; handles is a multi-kind lookup), so — exactly as 0005 promised — this is
-- a one-line kind widening here plus a one-line ANCHOR_KINDS add in
-- src/lib/server/anchor.ts. Nothing in the trust or compute path hardcodes a
-- provider once the read query is made kind-aware.
--
-- `beji` is an ANCHOR kind: the graph keys on it and it's publicly discoverable,
-- not an auth-only provider. A beji handle can anchor its OWN identity, or link
-- to an existing identity — the "agent-as-alias" path, where an agent inherits
-- its operator's trust because they're the same node (Sybil-proof: N agents from
-- one human are N handles on ONE identity, still one node's worth of flow).
alter table handles drop constraint handles_kind_check;
alter table handles add constraint handles_kind_check
    check (kind in ('github', 'domain', 'email', 'google', 'facebook', 'discord', 'beji'));
