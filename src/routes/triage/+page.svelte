<script lang="ts">
	import { LEVEL_NAMES } from '$lib/levels';

	let { data } = $props();
	// Single-hue trust ramp (brighter + greener = more trust), matching the badge.
	const LEVEL_CLASS: Record<number, string> = {
		1: 'border-level-1/40 bg-level-1/10 text-level-1',
		2: 'border-level-2/40 bg-level-2/10 text-level-2',
		3: 'border-level-3/40 bg-level-3/10 text-level-3'
	};

	function age(iso: string): string {
		const ms = Date.now() - new Date(iso).getTime();
		const d = Math.floor(ms / 86_400_000);
		if (d >= 30) return `${Math.floor(d / 30)}mo`;
		if (d >= 1) return `${d}d`;
		const h = Math.floor(ms / 3_600_000);
		if (h >= 1) return `${h}h`;
		return `${Math.max(1, Math.floor(ms / 60_000))}m`;
	}
</script>

<svelte:head><title>Triage — 6dtrust</title></svelte:head>

<header class="mb-8">
	<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		PR triage
	</p>
	<h1 class="mt-1.5 font-display text-3xl font-semibold tracking-tight">Triage a repo</h1>
	<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
		A soft read on a repo's open pull requests, sorted by how much you trust the author —
		<em class="not-italic text-foreground">from where you stand</em>. The known-good float up; the
		unknowns get a polite "earn it" lane, never a wall. It hands you a prior and gets out of the way.
	</p>
</header>

{#if !data.user}
	<div class="rounded-xl border border-border bg-card/40 p-8 text-center">
		<p class="text-sm text-muted-foreground">Sign in to triage from one of your roots.</p>
		<a
			href="/login/github"
			class="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
		>
			Sign in with GitHub
		</a>
	</div>
{:else if data.roots.length === 0}
	<div class="rounded-xl border border-dashed border-border/60 p-8 text-center">
		{#if data.user.isAdmin}
			<p class="text-sm text-muted-foreground">
				You have no roots yet. A root is your seed set — the vantage trust is read from.
			</p>
			<a
				href="/admin"
				class="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
			>
				Mint a root
			</a>
		{:else}
			<p class="text-sm text-muted-foreground">
				You have no roots yet. Roots are minted by an admin — once you own one, triage reads from
				it.
			</p>
		{/if}
	</div>
{:else}
	<form method="GET" class="mb-8 rounded-xl border border-border bg-card/40 p-6">
		<div class="flex flex-wrap items-end gap-3">
			<label class="flex flex-col gap-1.5">
				<span class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
					From root
				</span>
				<select
					name="root"
					class="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
				>
					{#each data.roots as r (r.id)}
						<option value={r.slug} selected={r.slug === data.query.root}>{r.slug} · {r.name}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-1 flex-col gap-1.5">
				<span class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
					Repository
				</span>
				<input
					name="repo"
					value={data.query.repo}
					placeholder="owner/repo"
					autocomplete="off"
					class="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
				/>
			</label>
			<button
				type="submit"
				class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
			>
				Read trust
			</button>
		</div>
	</form>

	{#if data.error}
		<p class="mb-6 rounded-lg border border-destructive/40 bg-card/40 px-4 py-2.5 text-sm text-destructive">
			{data.error}
		</p>
	{/if}

	{#if data.result}
		{@const res = data.result}
		<div class="mb-6 flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
			<p class="font-mono text-sm">
				<span class="text-foreground">{res.repo}</span>
				<span class="text-muted-foreground"> · from </span>
				<span class="text-foreground">{res.rootName}</span>
			</p>
			<p class="font-micro text-xs text-muted-foreground">
				{res.total} open PR{res.total === 1 ? '' : 's'} ·
				{res.computedAt
					? `trust computed ${new Date(res.computedAt).toLocaleString()}`
					: 'root never computed'}
			</p>
		</div>

		{#if res.total === 0}
			<p class="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
				No open pull requests on {res.repo}.
			</p>
		{:else}
			<section class="mb-8">
				<div class="mb-3 flex items-baseline justify-between">
					<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
						In your trusted flow
					</h2>
					<span class="font-mono text-xs text-muted-foreground">{res.trusted.length}</span>
				</div>
				{#if res.trusted.length === 0}
					<p class="rounded-lg border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
						None of these authors carry trust from this root yet — every PR is in the earn-it lane below.
					</p>
				{:else}
					<ul class="space-y-1.5">
						{#each res.trusted as pr (pr.number)}
							<li class="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 px-3.5 py-2.5">
								<span
									class="shrink-0 rounded-md border px-2 py-0.5 font-micro text-[0.65rem] font-semibold uppercase tracking-wide {LEVEL_CLASS[pr.level]}"
								>
									{LEVEL_NAMES[pr.level]}
								</span>
								<a href={pr.url} target="_blank" rel="noreferrer" class="min-w-0 flex-1 truncate text-sm hover:underline">
									<span class="font-mono text-muted-foreground">#{pr.number}</span>
									{pr.title}
									{#if pr.draft}<span class="font-micro text-[0.6rem] uppercase tracking-wide text-muted-foreground/60"> · draft</span>{/if}
								</a>
								<span class="shrink-0 font-mono text-xs text-muted-foreground">@{pr.author}</span>
								<span class="shrink-0 font-mono text-xs text-muted-foreground/60">{age(pr.createdAt)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section>
				<div class="mb-3 flex items-baseline justify-between">
					<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
						Earn-it lane
					</h2>
					<span class="font-mono text-xs text-muted-foreground">{res.earnIt.length}</span>
				</div>
				<p class="mb-3 text-sm text-muted-foreground">
					No signal from this root yet — not a verdict, just unknowns. Skim when you have the energy.
				</p>
				{#if res.earnIt.length === 0}
					<p class="rounded-lg border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
						Empty — every open PR is from someone in your trusted flow.
					</p>
				{:else}
					<ul class="space-y-1.5">
						{#each res.earnIt as pr (pr.number)}
							<li class="flex items-center gap-3 rounded-lg border border-border/40 bg-background/20 px-3.5 py-2.5 opacity-75">
								<span
									class="shrink-0 rounded-md border border-border/60 px-2 py-0.5 font-micro text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/70"
								>
									{LEVEL_NAMES[0]}
								</span>
								<a href={pr.url} target="_blank" rel="noreferrer" class="min-w-0 flex-1 truncate text-sm hover:underline">
									<span class="font-mono text-muted-foreground">#{pr.number}</span>
									{pr.title}
									{#if pr.draft}<span class="font-micro text-[0.6rem] uppercase tracking-wide text-muted-foreground/60"> · draft</span>{/if}
								</a>
								<span class="shrink-0 font-mono text-xs text-muted-foreground">@{pr.author}</span>
								<span class="shrink-0 font-mono text-xs text-muted-foreground/60">{age(pr.createdAt)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	{/if}
{/if}
