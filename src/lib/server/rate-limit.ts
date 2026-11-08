import { sql } from './db';

// Fixed-window, per-key rate limiter backed by Postgres (rate_limits table, 0009).
// One atomic upsert per check: within the live window the count increments; once
// the window has elapsed the row resets to a fresh window of 1. Used for the
// authenticated, low-QPS actions (vouch, seed, triage) — the public read flood is
// limited at the edge, not here (see cache.ts / RELEASE-BATON).

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	retryAfterSec: number;
}

// Sensible defaults for human use; an abuser hits them long before they can drain
// the shared GitHub quota or inflate the graph. Tune as real traffic appears.
export const HOUR_MS = 3_600_000;
export const LIMITS = {
	vouch: 40, // vouches per identity per hour (each unknown handle = a GitHub lookup + row inserts)
	seed: 40, // seed edits per identity per hour (same GitHub-lookup cost)
	poison: 40, // poison edits per identity per hour (same GitHub-lookup cost as a seed)
	triage: 20 // triage runs per identity per hour (each = a paginated GitHub burst)
} as const;

export async function checkRateLimit(
	key: string,
	limit: number,
	windowMs: number = HOUR_MS
): Promise<RateLimitResult> {
	const windowSpec = `${Math.ceil(windowMs / 1000)} seconds`;
	const [row] = await sql<{ count: number; window_start: Date }[]>`
		insert into rate_limits (bucket, window_start, count)
		values (${key}, now(), 1)
		on conflict (bucket) do update set
			count = case when rate_limits.window_start < now() - ${windowSpec}::interval
			             then 1 else rate_limits.count + 1 end,
			window_start = case when rate_limits.window_start < now() - ${windowSpec}::interval
			                    then now() else rate_limits.window_start end
		returning count, window_start`;

	const used = row.count;
	const resetAt = new Date(row.window_start).getTime() + windowMs;
	return {
		allowed: used <= limit,
		remaining: Math.max(0, limit - used),
		retryAfterSec: Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))
	};
}
