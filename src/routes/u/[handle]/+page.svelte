<script lang="ts">
	import LevelBadge from '$lib/components/level-badge.svelte';
	import { page } from '$app/state';

	let { data } = $props();
	const p = $derived(data.profile);
	const origin = $derived(page.url.origin);
</script>

<svelte:head>
	<title>@{p.github} — 6dtrust</title>
	<meta
		name="description"
		content="Trust readouts for @{p.github} — viewer-relative levels from public roots."
	/>
</svelte:head>

<header class="mb-10">
	<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		Person
	</p>
	<h1 class="mt-1.5 font-display text-3xl font-semibold tracking-tight">@{p.github}</h1>
	<div class="mt-3 flex flex-wrap items-center gap-2">
		<span
			class="rounded-md border border-border bg-card/60 px-2 py-1 font-mono text-xs text-muted-foreground"
		>
			{p.status}
		</span>
		{#if p.status === 'unclaimed'}
			<span class="text-sm text-muted-foreground">Off-graph — vouched for, not signed up yet.</span>
		{/if}
	</div>
	<p class="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
		There is no global trust score. Each root computes its own read — the same person can be
		<span class="text-level-3">trusted</span> from one worldview and
		<span class="text-muted-foreground">pending</span> from another.
	</p>
</header>

<section class="mb-10">
	<div class="mb-3 flex items-baseline justify-between">
		<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
			From public roots
		</h2>
		<span class="font-mono text-xs text-muted-foreground">{p.rootLevels.length}</span>
	</div>
	{#if p.rootLevels.length === 0}
		<p class="rounded-lg border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
			No public root has computed trust to here yet — pending everywhere, not a verdict.
		</p>
	{:else}
		<ul class="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
			{#each p.rootLevels as r (r.slug)}
				<li class="flex flex-wrap items-center justify-between gap-3 bg-card/30 px-4 py-3">
					<div class="min-w-0">
						<a href="/r/{r.slug}" class="font-mono text-sm font-medium hover:underline">{r.slug}</a>
						<span class="ml-2 text-sm text-muted-foreground">{r.name}</span>
						{#if r.isSeed}
							<span
								class="ml-2 rounded-full border border-border/70 px-1.5 py-px font-micro text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
								>seed</span
							>
						{/if}
					</div>
					<div class="flex shrink-0 items-center gap-2">
						<LevelBadge level={r.level} />
						<img
							src="/badge/{r.slug}/{p.github}"
							alt="trust:{r.slug} badge"
							height="22"
							class="h-6 w-auto opacity-90"
						/>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<div class="grid gap-6 md:grid-cols-2">
	<section>
		<div class="mb-3 flex items-baseline justify-between">
			<h2
				class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70"
			>
				Vouches for them
			</h2>
			<span class="font-mono text-xs text-muted-foreground">{p.incoming.length}</span>
		</div>
		{#if p.incoming.length === 0}
			<p class="rounded-lg border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
				No signed edges in yet.
			</p>
		{:else}
			<ul class="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
				{#each p.incoming as v (v.github + v.level)}
					<li class="flex items-center justify-between gap-3 bg-card/30 px-4 py-3">
						<a href="/u/{v.github}" class="truncate font-mono text-sm hover:underline">@{v.github}</a>
						<LevelBadge level={v.level} />
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section>
		<div class="mb-3 flex items-baseline justify-between">
			<h2
				class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70"
			>
				They vouch for
			</h2>
			<span class="font-mono text-xs text-muted-foreground">{p.outgoing.length}</span>
		</div>
		{#if p.outgoing.length === 0}
			<p class="rounded-lg border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
				No outgoing vouches yet.
			</p>
		{:else}
			<ul class="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
				{#each p.outgoing as v (v.github + v.level)}
					<li class="flex items-center justify-between gap-3 bg-card/30 px-4 py-3">
						<a href="/u/{v.github}" class="truncate font-mono text-sm hover:underline">@{v.github}</a>
						<LevelBadge level={v.level} />
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

{#if p.rootLevels[0]}
	<section class="mt-10 rounded-xl border border-border bg-card/40 p-6">
		<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
			Embed their badge
		</h2>
		<p class="mt-2 text-sm text-muted-foreground">
			From <span class="font-mono text-foreground">{p.rootLevels[0].slug}</span> — live computed state.
		</p>
		<div class="mt-4 flex flex-col items-start gap-3">
			<img
				src="/badge/{p.rootLevels[0].slug}/{p.github}"
				alt="Badge from {p.rootLevels[0].slug}"
				height="22"
				class="h-8 w-auto"
			/>
			<code
				class="block max-w-full overflow-x-auto whitespace-nowrap rounded-md border border-border/60 bg-background/50 px-3 py-2 font-mono text-xs text-muted-foreground"
			>![trust]({origin}/badge/{p.rootLevels[0].slug}/{p.github})</code>
		</div>
	</section>
{/if}

<p class="mt-8 text-sm text-muted-foreground">
	<a
		href="/dashboard"
		class="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
		>Add them to your trust graph →</a
	>
</p>
