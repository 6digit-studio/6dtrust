// Single source of truth for the "costly anchor" concept.
//
// An ANCHOR handle is a costly, verifiable, PUBLIC identity — the thing the trust
// graph is keyed on and our means of discovery. An identity is trust-eligible
// ONLY if it carries at least one anchor handle. This is verified-AGNOSTIC on
// purpose: a dangling, not-yet-claimed github handle (verified=false, minted when
// someone vouches for a handle before its owner signs up) still anchors, so
// vouch-before-signup keeps working. A gate on `verified` would silently break it.
//
// Everything else is an AUTH handle: a private login method (google, facebook,
// discord) or a secondary lookup key (email). Auth handles link to an identity
// but never anchor trust and are never shown publicly.
//
// To add a costly anchor (a verified domain, GitLab, ORCID, ...): add its kind to
// ANCHOR_KINDS here AND to handles_kind_check in a migration. Nothing else in the
// trust or display path hardcodes a provider — both eligibility and visibility
// read from this file, so the spine is never welded to GitHub.

export const ANCHOR_KINDS = ['github', 'beji'] as const;
export type AnchorKind = (typeof ANCHOR_KINDS)[number];

export function isAnchorKind(kind: string): boolean {
	return (ANCHOR_KINDS as readonly string[]).includes(kind);
}

// Visibility IS anchor-ness: anchor handles are public (shown beside the display
// name); every other handle is private (auth method or PII), never displayed.
export const isPublicKind = isAnchorKind;
