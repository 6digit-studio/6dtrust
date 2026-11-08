<script lang="ts">
	import { page } from '$app/state';
	import { LEVELS } from '$lib/levels';

	// Live origin so the copy-paste examples are correct wherever this is served.
	const origin = $derived(page.url.origin);

	// Documented payload — kept in lockstep with TrustReadout (readout-shape.ts).
	const fields = [
		{ name: 'root', type: 'string', desc: 'The root slug you queried.' },
		{ name: 'handle', type: 'string', desc: 'The GitHub handle, normalized (lowercased, no @).' },
		{ name: 'level', type: '0–3', desc: 'Engine level. 0 = pending, 1 = known, 2 = vouched, 3 = trusted.' },
		{ name: 'levelName', type: 'string', desc: 'Human name for the level (pending / known / vouched / trusted).' },
		{ name: 'accepted', type: 'boolean', desc: "Whether the handle is in this root's accept-set (level > 0)." },
		{ name: 'distance', type: 'number | null', desc: 'Hops from the nearest seed via vouch edges (seed = 0). null if pending or unreachable.' },
		{ name: 'isSeed', type: 'boolean', desc: 'Whether the handle is an axiomatic seed of this root.' },
		{ name: 'status', type: '"claimed" | "unclaimed" | null', desc: 'Account state. null = no identity exists for this handle yet.' },
		{ name: 'computedAt', type: 'string | null', desc: 'ISO timestamp of the membership row, or null when pending.' },
		{ name: 'badgeUrl', type: 'string', desc: 'Compact SVG badge (22px) — README badge rows beside CI shields.' },
		{ name: 'brandedBadgeUrl', type: 'string', desc: 'Branded SVG badge (32px) — root emblem with stacked readout.' },
		{ name: 'profileUrl', type: 'string', desc: 'Stable URL of the person profile, scoped to this root.' }
	];

	const example = $derived(`{
  "root": "osc",
  "handle": "torvalds",
  "level": 3,
  "levelName": "trusted",
  "accepted": true,
  "distance": 0,
  "isSeed": true,
  "status": "unclaimed",
  "computedAt": "2026-06-15T23:31:23.308Z",
  "badgeUrl": "${origin}/badge/osc/torvalds",
  "brandedBadgeUrl": "${origin}/badge/branded/osc/torvalds",
  "profileUrl": "${origin}/u/torvalds?root=osc"
}`);
</script>

<svelte:head>
	<title>Docs — 6dtrust</title>
	<meta name="description" content="Integrate 6dtrust: the machine-readable trust JSON API and the embeddable badge." />
</svelte:head>

<div class="mx-auto max-w-3xl">
	<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		Docs · integration
	</p>
	<h1 class="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Integrate 6dtrust</h1>
	<p class="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">
		Every verdict is computed from a <strong class="font-medium text-foreground">root</strong>'s seeds and
		exposed three ways: a <strong class="font-medium text-foreground">compact badge</strong> (README badge
		rows), a <strong class="font-medium text-foreground">branded badge</strong> (root emblem + readout),
		and a <strong class="font-medium text-foreground">trust JSON</strong> (machine readout). All are a pure
		function of <code class="font-mono text-[0.85em]">(root, handle)</code>, public, and cached — safe to
		poll and safe to embed.
	</p>

	<!-- ── Trust JSON ─────────────────────────────────────────────────── -->
	<section class="mt-12 scroll-mt-20 border-t border-border/70 pt-10">
		<h2 class="font-display text-xl font-semibold tracking-tight">Trust JSON</h2>
		<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
			The machine readout. One request resolves a handle's level, distance, and stable links from a
			root's vantage.
		</p>

		<div class="mt-4 rounded-lg border border-border bg-card/40 px-4 py-3 font-mono text-sm">
			<span class="text-level-3">GET</span> {origin}/trust/<span class="text-muted-foreground">&#123;root&#125;</span>/<span
				class="text-muted-foreground">&#123;handle&#125;</span
			>.json
		</div>

		<h3 class="mt-6 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Response</h3>
		<div class="mt-2 overflow-x-auto rounded-lg border border-border bg-card/30">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class="border-b border-border/70 text-left font-micro text-xs uppercase tracking-wide text-muted-foreground/70">
						<th class="px-4 py-2.5 font-semibold">Field</th>
						<th class="px-4 py-2.5 font-semibold">Type</th>
						<th class="px-4 py-2.5 font-semibold">Description</th>
					</tr>
				</thead>
				<tbody>
					{#each fields as f (f.name)}
						<tr class="border-b border-border/40 last:border-0 align-top">
							<td class="px-4 py-2.5 font-mono text-[0.8rem] text-foreground">{f.name}</td>
							<td class="whitespace-nowrap px-4 py-2.5 font-mono text-[0.72rem] text-muted-foreground">{f.type}</td>
							<td class="px-4 py-2.5 leading-relaxed text-muted-foreground">{f.desc}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<h3 class="mt-6 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Status codes</h3>
		<ul class="mt-2 space-y-1.5 text-sm text-muted-foreground">
			<li><code class="font-mono text-level-3">200</code> — valid handle, always. <strong class="font-medium text-foreground">Pending is a state, not an error</strong> — an unknown handle returns a level-0 payload, not a 404.</li>
			<li><code class="font-mono">404</code> — the root slug doesn't exist, or isn't public.</li>
			<li><code class="font-mono">400</code> — the handle is malformed (not a valid GitHub username).</li>
		</ul>

		<h3 class="mt-6 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Example</h3>
		<div class="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-background/50 px-4 py-3 font-mono text-xs text-muted-foreground">
			curl {origin}/trust/osc/torvalds.json
		</div>
		<pre class="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-background/50 px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground">{example}</pre>

		<p class="mt-4 text-xs leading-relaxed text-muted-foreground/80">
			<strong class="font-medium text-foreground">Caching:</strong> responses carry a CDN cache header
			(<code class="font-mono">s-maxage</code>), so they serve from the edge and reflect the last
			recompute. There is no authentication or rate limit yet — both are tracked, not shipped.
		</p>
	</section>

	<!-- ── Badges ─────────────────────────────────────────────────────── -->
	<section class="mt-12 scroll-mt-20 border-t border-border/70 pt-10">
		<h2 class="font-display text-xl font-semibold tracking-tight">Badges</h2>
		<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
			Human readouts — live SVGs you can embed in a README or profile. Both are a pure function of
			<code class="font-mono text-[0.85em]">(root, handle)</code>, update when the graph recomputes,
			and use separate URLs (no query parameters).
		</p>

		<h3 class="mt-8 font-display text-sm font-semibold tracking-tight">Compact — README badge row</h3>
		<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
			<strong class="font-medium text-foreground">22px</strong> tall — lines up with Shields-style CI
			badges in the top row of a repo. Graph glyph, <code class="font-mono text-[0.85em]">trust:&#123;root&#125;</code>,
			and level on one line.
		</p>

		<div class="mt-4 flex flex-wrap items-center gap-3">
			<img src="/badge/osc/torvalds" alt="Compact trust badge" height="22" class="h-[22px] w-auto" />
			<span class="font-mono text-xs text-muted-foreground">@torvalds · osc</span>
		</div>

		<div class="mt-4 rounded-lg border border-border bg-card/40 px-4 py-3 font-mono text-sm">
			<span class="text-level-3">GET</span> {origin}/badge/<span class="text-muted-foreground">&#123;root&#125;</span>/<span
				class="text-muted-foreground">&#123;handle&#125;</span>
		</div>

		<div class="mt-3 overflow-x-auto rounded-lg border border-border/60 bg-background/50 px-4 py-3 font-mono text-xs text-muted-foreground">
			![trust]({origin}/badge/&#123;root&#125;/&#123;handle&#125;)
		</div>

		<h3 class="mt-10 font-display text-sm font-semibold tracking-tight">Branded — root emblem</h3>
		<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
			<strong class="font-medium text-foreground">32px</strong> tall — square root logo (from the root's
			<code class="font-mono text-[0.85em]">avatar_url</code>, or initials fallback) on the left,
			stacked readout on the right. Use when the root's identity matters more than fitting a tight badge
			row.
		</p>

		<div class="mt-4 flex flex-wrap items-center gap-3">
			<img
				src="/badge/branded/osc/torvalds"
				alt="Branded trust badge"
				height="32"
				class="h-8 w-auto"
			/>
			<span class="font-mono text-xs text-muted-foreground">@torvalds · osc · branded</span>
		</div>

		<div class="mt-4 rounded-lg border border-border bg-card/40 px-4 py-3 font-mono text-sm">
			<span class="text-level-3">GET</span> {origin}/badge/branded/<span class="text-muted-foreground">&#123;root&#125;</span>/<span
				class="text-muted-foreground">&#123;handle&#125;</span>
		</div>

		<div class="mt-3 overflow-x-auto rounded-lg border border-border/60 bg-background/50 px-4 py-3 font-mono text-xs text-muted-foreground">
			![trust]({origin}/badge/branded/&#123;root&#125;/&#123;handle&#125;)
		</div>

		<p class="mt-6 text-xs leading-relaxed text-muted-foreground/80">
			<strong class="font-medium text-foreground">Caching:</strong> badge SVGs carry
			<code class="font-mono">Cache-Control: max-age=300</code> — materialized readouts from the last
			recompute. Branded badges inline the root emblem as a data URI at render time so they work inside
			<code class="font-mono">&lt;img&gt;</code> tags and through GitHub's camo proxy.
		</p>
	</section>

	<!-- ── Trust levels ───────────────────────────────────────────────── -->
	<section class="mt-12 scroll-mt-20 border-t border-border/70 pt-10">
		<h2 class="font-display text-xl font-semibold tracking-tight">Trust levels</h2>
		<div class="mt-4 grid gap-3 sm:grid-cols-2">
			{#each [3, 2, 1, 0] as lvl (lvl)}
				<div class="rounded-lg border border-border bg-card/30 p-4">
					<p class="font-mono text-sm">
						<span class="text-foreground">{lvl}</span>
						<span class="mx-1.5 text-muted-foreground/50">·</span>
						<span class="text-muted-foreground">{LEVELS[lvl].name}</span>
					</p>
					<p class="mt-1.5 text-sm leading-snug text-muted-foreground">{LEVELS[lvl].blurb}</p>
				</div>
			{/each}
		</div>
		<p class="mt-4 text-xs leading-relaxed text-muted-foreground/80">
			Trust is always <em class="not-italic text-foreground">relative to a root</em> — the same handle can be
			trusted from one root and pending from another. There is no global verdict.
		</p>
	</section>
</div>
