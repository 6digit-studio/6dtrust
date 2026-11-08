<script lang="ts">
	import { page } from '$app/state';
	import SeedsInfo from '$lib/components/seeds-info.svelte';

	let { data } = $props();
	const root = $derived(data.root);
	const origin = $derived(page.url.origin);
	const branded = $derived(root.featured);
</script>

<svelte:head>
	<title>{root.name} — 6dtrust</title>
	<meta name="description" content="Trust computed from the {root.slug} root — seeds, per-person badges, point lookups." />
</svelte:head>

<header class="mb-10">
	<div class="flex flex-wrap items-start gap-5">
		{#if branded && root.avatarUrl}
			<img
				src={root.avatarUrl}
				alt=""
				width="64"
				height="64"
				class="size-16 rounded-xl border border-border bg-card object-cover"
			/>
		{:else}
			<span
				class="grid size-16 place-items-center rounded-xl border border-border bg-card font-mono text-lg font-semibold text-muted-foreground"
			>
				{root.slug.slice(0, 2)}
			</span>
		{/if}
		<div class="min-w-0 flex-1">
			<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
				Root
			</p>
			<h1 class="mt-1 font-display text-3xl font-semibold tracking-tight">
				<span class="font-mono text-2xl text-muted-foreground">{root.slug.toUpperCase()}</span>
				<span class="mx-2 text-muted-foreground/50">—</span>
				{root.name}
			</h1>
			{#if branded && root.tagline && root.tagline.trim().toLowerCase() !== root.name.trim().toLowerCase()}
				<p class="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{root.tagline}</p>
			{/if}
			<div class="mt-4 flex flex-wrap items-center gap-2">
				{#if branded && root.homepageUrl}
					<a
						href={root.homepageUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="rounded-md border border-border bg-card/60 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
					>
						Homepage ↗
					</a>
				{/if}
				{#each root.links as link (link.url + link.label)}
					<a
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						class="rounded-md border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						{link.label} ↗
					</a>
				{/each}
				{#if root.featured}
					<span
						class="rounded-md border border-level-3/40 bg-level-3/10 px-2 py-1 font-micro text-[0.62rem] font-semibold uppercase tracking-wide text-level-3"
					>
						Featured
					</span>
				{/if}
			</div>
		</div>
	</div>

	{#if branded && root.description}
		<p class="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">{root.description}</p>
	{/if}

	<p class="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
		Trust is computed <em class="not-italic text-foreground">relative to this root's seeds</em> — not a
		global verdict. Seeds are trusted by definition; everyone else earns in through the signed vouch
		graph. Check a person with their badge or profile — there is no member directory.
	</p>

	<div class="mt-5 flex flex-wrap gap-3 font-mono text-xs text-muted-foreground">
		<span>{root.seedCount} seed{root.seedCount === 1 ? '' : 's'}</span>
		<span>·</span>
		<span>{root.acceptedCount} accepted</span>
		<span>·</span>
		<span>
			{root.computedAt
				? `computed ${new Date(root.computedAt).toLocaleString()}`
				: 'never computed'}
		</span>
	</div>
</header>

<section class="mb-10 rounded-xl border border-border bg-card/40 p-6">
	<div class="flex items-center justify-between gap-3">
		<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
			Seeds — trusted by definition
		</h2>
		<SeedsInfo rootName={root.name} />
	</div>
	{#if root.seeds.length === 0}
		<p class="mt-4 text-sm text-muted-foreground">No seeds yet — nothing to compute from.</p>
	{:else}
		<ul class="mt-4 divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
			{#each root.seeds as s (s.identityId)}
				<li class="flex items-center justify-between gap-3 bg-card/30 px-4 py-3">
					<a href="/u/{s.github}" class="truncate font-mono text-sm hover:underline">@{s.github}</a>
					{#if s.status === 'unclaimed'}
						<span class="font-micro text-[0.62rem] uppercase tracking-wide text-muted-foreground/60"
							>off-graph</span
						>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if root.poison.length > 0}
	<section class="mb-10 rounded-xl border border-destructive/30 bg-destructive/[0.03] p-6">
		<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
			Excluded from this root
		</h2>
		<p class="mt-2 max-w-xl text-sm text-muted-foreground">
			This root <em class="not-italic text-foreground">opts out</em> of these nodes — they drop from
			its trust and stop passing it on. A statement of what this root is for, not an accusation, and
			it counts <em class="not-italic text-foreground">only here</em> — never pooled across roots.
		</p>
		<ul class="mt-4 divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
			{#each root.poison as p (p.identityId)}
				<li class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 bg-card/30 px-4 py-3">
					<a href="/u/{p.github}" class="font-mono text-sm hover:underline">@{p.github}</a>
					{#if p.reason}
						<span class="min-w-0 flex-1 text-right text-sm text-muted-foreground">{p.reason}</span>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if root.seeds.length > 0}
	<section class="rounded-xl border border-border bg-card/40 p-6">
		<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
			Embed a badge
		</h2>
		<p class="mt-2 max-w-xl text-sm text-muted-foreground">
			Per-person readout for one handle under this root — not a directory.
		</p>

		<div class="mt-6 space-y-6">
			<div>
				<h3 class="text-sm font-medium text-foreground">Compact — README badge row</h3>
				<p class="mt-1 text-xs text-muted-foreground">
					22px tall, lines up with CI and Shields-style badges.
				</p>
				<div class="mt-3 flex flex-col items-start gap-3">
					<img
						src="/badge/{root.slug}/your-handle"
						alt="Compact trust badge"
						height="22"
						class="h-[22px] w-auto"
					/>
					<code
						class="block max-w-full overflow-x-auto whitespace-nowrap rounded-md border border-border/60 bg-background/50 px-3 py-2 font-mono text-xs text-muted-foreground"
						>![trust]({origin}/badge/{root.slug}/&lt;github-handle&gt;)</code
					>
				</div>
			</div>

			<div class="border-t border-border/60 pt-6">
				<h3 class="text-sm font-medium text-foreground">Branded — root emblem</h3>
				<p class="mt-1 text-xs text-muted-foreground">
					Taller chip with the root logo and stacked readout. Separate URL.
				</p>
				<div class="mt-3 flex flex-col items-start gap-3">
					<img
						src="/badge/branded/{root.slug}/your-handle"
						alt="Branded trust badge"
						height="32"
						class="h-8 w-auto"
					/>
					<code
						class="block max-w-full overflow-x-auto whitespace-nowrap rounded-md border border-border/60 bg-background/50 px-3 py-2 font-mono text-xs text-muted-foreground"
						>![trust]({origin}/badge/branded/{root.slug}/&lt;github-handle&gt;)</code
					>
				</div>
			</div>
		</div>
	</section>
{/if}

{#if root.audit.length > 0}
	<section class="mt-10 rounded-xl border border-border bg-card/40 p-6">
		<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
			Governance log
		</h2>
		<p class="mt-2 max-w-xl text-sm text-muted-foreground">
			Every seed change, exclusion, and ownership transfer, on the record — the platform shows its
			own work, no silent moderation.
		</p>
		<ul class="mt-4 space-y-1.5 font-mono text-xs">
			{#each root.audit as e, i (i)}
				<li class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-muted-foreground">
					<span class="tabular-nums text-muted-foreground/60"
						>{new Date(e.at).toLocaleDateString()}</span
					>
					{#if e.kind === 'owner'}
						<span class="text-foreground">ownership →</span>
						<a href="/u/{e.subject}" class="text-foreground hover:underline">@{e.subject}</a>
						{#if e.from}<span class="text-muted-foreground/60">(from @{e.from})</span>{/if}
					{:else if e.kind === 'poison'}
						<span class="text-destructive">{e.action === 'added' ? 'excluded' : 'un-excluded'}</span>
						<a href="/u/{e.subject}" class="text-foreground hover:underline">@{e.subject}</a>
						{#if e.reason}<span class="text-muted-foreground/60">— {e.reason}</span>{/if}
					{:else if e.action === 'added'}
						<span class="text-level-3">added</span>
						<a href="/u/{e.subject}" class="text-foreground hover:underline">@{e.subject}</a>
					{:else}
						<span>removed <span class="text-foreground">@{e.subject}</span></span>
					{/if}
					{#if e.actor}<span class="text-muted-foreground/60">· by @{e.actor}</span>{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<p class="mt-8 text-sm text-muted-foreground">
	<a
		href="/"
		class="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
		>← Compare roots in the calculator</a
	>
</p>
