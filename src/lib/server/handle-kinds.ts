// Per-anchor-kind handle rules — validation + normalization in ONE place, so the
// read route and the readout query never diverge on what a handle looks like.
// This is the read-path companion to anchor.ts (which owns which kinds anchor).
//
// GitHub keeps its existing rule verbatim; `beji` handles mirror Beji's own
// register grammar (lowercase, digits, - and _, 2–32 chars — underscores legal,
// which GitHub's aren't). Adding a kind is one entry here.

import { GITHUB_USERNAME_RE, normalizeGithub } from './resolve';
import { isAnchorKind } from './anchor';

export const BEJI_HANDLE_RE = /^[a-z0-9](?:[a-z0-9_-]{0,30}[a-z0-9])?$/;

/** Canonicalize a handle for its kind (lowercase; GitHub also strips a leading @). */
export function normalizeHandle(kind: string, value: string): string {
	if (kind === 'github') return normalizeGithub(value);
	return value.trim().toLowerCase();
}

/** Is `value` (already normalized) a syntactically valid handle of `kind`? */
export function isValidHandle(kind: string, value: string): boolean {
	if (!isAnchorKind(kind)) return false; // only anchor kinds are queryable/trust-eligible
	if (kind === 'github') return GITHUB_USERNAME_RE.test(value);
	if (kind === 'beji') return BEJI_HANDLE_RE.test(value);
	return false;
}
