import { BlockList, isIP, type LookupFunction } from 'node:net';
import { request } from 'node:https';
import { lookup as dnsLookup } from 'node:dns';

// SSRF-hardened image fetch for user-controlled URLs (root avatar_url). The
// threat: a root owner points avatar_url at internal infrastructure and the
// branded-badge endpoint fetches it server-side. Defenses, in order:
//   1. https only.
//   2. Reject any resolved IP in a private/reserved range — checked at CONNECT
//      time via a custom lookup, so a hostname that resolves public-then-internal
//      (DNS rebinding / split-horizon) can't slip past a pre-check.
//   3. Do NOT follow redirects (a public 302 -> internal target is the classic
//      bypass) — a 3xx is simply a miss.
//   4. Hard caps on body size and time.
// Anything that fails resolves to null; the caller renders the no-logo fallback.

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 8000;

function buildBlockList(): BlockList {
	const b = new BlockList();
	// IPv4 — unspecified, private, CGNAT, loopback, link-local (incl. cloud
	// metadata 169.254.169.254), benchmark, IETF protocol, multicast, reserved.
	b.addSubnet('0.0.0.0', 8, 'ipv4');
	b.addSubnet('10.0.0.0', 8, 'ipv4');
	b.addSubnet('100.64.0.0', 10, 'ipv4');
	b.addSubnet('127.0.0.0', 8, 'ipv4');
	b.addSubnet('169.254.0.0', 16, 'ipv4');
	b.addSubnet('172.16.0.0', 12, 'ipv4');
	b.addSubnet('192.0.0.0', 24, 'ipv4');
	b.addSubnet('192.168.0.0', 16, 'ipv4');
	b.addSubnet('198.18.0.0', 15, 'ipv4');
	b.addSubnet('224.0.0.0', 4, 'ipv4');
	b.addSubnet('240.0.0.0', 4, 'ipv4');
	// IPv6 — loopback, unspecified, unique-local, link-local, multicast.
	b.addAddress('::1', 'ipv6');
	b.addAddress('::', 'ipv6');
	b.addSubnet('fc00::', 7, 'ipv6');
	b.addSubnet('fe80::', 10, 'ipv6');
	b.addSubnet('ff00::', 8, 'ipv6');
	return b;
}

const BLOCKLIST = buildBlockList();

// True if `address` is an IP we must never connect to. A non-IP string is
// treated as blocked (fail closed). IPv4-mapped IPv6 (::ffff:a.b.c.d) is
// unwrapped so an internal v4 can't hide inside a v6 literal.
export function isBlockedAddress(address: string): boolean {
	const fam = isIP(address);
	if (fam === 0) return true;
	if (fam === 4) return BLOCKLIST.check(address, 'ipv4');
	const mapped = address.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
	if (mapped) return BLOCKLIST.check(mapped[1], 'ipv4');
	return BLOCKLIST.check(address, 'ipv6');
}

// dns.lookup that resolves all addresses, rejects the whole attempt if ANY of
// them is blocked, and otherwise pins the connection to the first. Pinning here
// (not in a pre-flight) is what closes the rebinding window: the socket connects
// to exactly the address we validated.
const guardedLookup: LookupFunction = (hostname, options, callback) => {
	dnsLookup(hostname, { all: true }, (err, addresses) => {
		if (err) return callback(err, '', 0);
		if (!addresses.length) return callback(new Error('no addresses'), '', 0);
		for (const a of addresses) {
			if (isBlockedAddress(a.address)) {
				return callback(new Error(`blocked address ${a.address}`), '', 0);
			}
		}
		const chosen = addresses[0];
		// honor a requested family if the caller asked for one
		const want = typeof options === 'object' ? options.family : options;
		const pick = want ? addresses.find((a) => a.family === want) ?? chosen : chosen;
		callback(null, pick.address, pick.family);
	});
};

export interface FetchedImage {
	contentType: string;
	bytes: Buffer;
}

// Fetch a user-supplied https image URL under all the guards above. Resolves null
// (never throws) on any disqualifier: bad URL, non-https, blocked IP, redirect,
// non-image content-type, oversize body, timeout, or transport error.
export function safeImageFetch(rawUrl: string): Promise<FetchedImage | null> {
	return new Promise((resolve) => {
		let url: URL;
		try {
			url = new URL(rawUrl);
		} catch {
			return resolve(null);
		}
		if (url.protocol !== 'https:') return resolve(null);
		// Block literal private-IP hostnames up front (the lookup guards DNS names).
		const hostname = url.hostname.replace(/^\[|\]$/g, '');
		if (isIP(hostname) && isBlockedAddress(hostname)) return resolve(null);

		let settled = false;
		const done = (v: FetchedImage | null) => {
			if (settled) return;
			settled = true;
			resolve(v);
		};

		const req = request(
			url,
			{
				method: 'GET',
				lookup: guardedLookup,
				timeout: TIMEOUT_MS,
				headers: { 'user-agent': '6dtrust', accept: 'image/*' }
			},
			(res) => {
				const status = res.statusCode ?? 0;
				// redirect:manual — a 3xx is a miss, not a hop to follow.
				if (status < 200 || status >= 300) {
					res.resume();
					return done(null);
				}
				const type = (res.headers['content-type'] ?? '').split(';')[0].trim();
				if (!type.startsWith('image/')) {
					res.resume();
					return done(null);
				}
				const chunks: Buffer[] = [];
				let size = 0;
				res.on('data', (c: Buffer) => {
					size += c.length;
					if (size > MAX_BYTES) {
						req.destroy();
						return done(null);
					}
					chunks.push(c);
				});
				res.on('end', () => done(size === 0 ? null : { contentType: type, bytes: Buffer.concat(chunks) }));
				res.on('error', () => done(null));
			}
		);
		req.on('timeout', () => {
			req.destroy();
			done(null);
		});
		req.on('error', () => done(null));
		req.end();
	});
}
