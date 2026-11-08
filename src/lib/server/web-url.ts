// Allowlist for user-supplied external URLs (root homepage_url, avatar_url, and
// future root_links). These get rendered into `<a href>` / `<img src>` on the
// public root page, where Svelte escapes the value but does NOT strip dangerous
// schemes — a stored `javascript:` (or `data:`) URL executes on click (S7). So we
// allow ONLY http/https at the write boundary. Pure + unit-tested.

// Returns the normalized URL if it parses and is http(s); null otherwise (empty,
// unparseable, or a non-http scheme like javascript:/data:/vbscript:/file:).
export function httpUrlOrNull(raw: string | null | undefined): string | null {
	const s = raw?.trim();
	if (!s) return null;
	let u: URL;
	try {
		u = new URL(s);
	} catch {
		return null;
	}
	if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
	return u.href;
}
