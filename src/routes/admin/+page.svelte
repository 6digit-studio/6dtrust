<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<svelte:head><title>Admin — 6dtrust</title></svelte:head>

<header class="mb-8">
	<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		Operator console
	</p>
	<h1 class="mt-1.5 font-display text-3xl font-semibold tracking-tight">Admin</h1>
	<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
		Roots are <strong class="font-medium text-foreground">operator-minted</strong>, not open. Mint
		a root here; you own it, then seed and recompute it on
		<a href="/roots" class="text-foreground underline underline-offset-2">/roots</a>. The genuinely
		trusted roots float organically — this is the curated start.
	</p>
</header>

{#if form?.message}
	<p
		class="mb-5 rounded-lg border px-4 py-2.5 text-sm {form.success
			? 'border-level-3/40 bg-card/40 text-level-3'
			: 'border-destructive/40 bg-card/40 text-destructive'}"
	>
		{form.message}
	</p>
{/if}

<section class="mb-10 rounded-xl border border-border bg-card/40 p-6">
	<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		Mint a root
	</h2>
	<form method="POST" action="?/mint" use:enhance class="mt-4 flex flex-wrap items-center gap-2.5">
		<input
			name="slug"
			placeholder="slug (e.g. anti-ai)"
			autocomplete="off"
			class="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
		/>
		<input
			name="name"
			placeholder="display name"
			autocomplete="off"
			class="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
		/>
		<button
			type="submit"
			class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
		>
			Mint
		</button>
	</form>
</section>

<section class="mb-10 rounded-xl border border-border bg-card/40 p-6">
	<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		Test-ingest an inbox suggestion
	</h2>
	<p class="mt-2 max-w-2xl text-sm text-muted-foreground">
		Stands in for the GitHub merge handler until the App is wired up. Drops a suggestion into
		<strong class="font-medium text-foreground">your own</strong>
		<a href="/inbox" class="text-foreground underline underline-offset-2">/inbox</a> so the loop can be
		run end-to-end.
	</p>
	<form
		method="POST"
		action="?/testIngest"
		use:enhance
		class="mt-4 flex flex-wrap items-center gap-2.5"
	>
		<input
			name="subject"
			placeholder="subject @handle"
			autocomplete="off"
			class="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
		/>
		<input
			name="repo"
			placeholder="owner/repo"
			autocomplete="off"
			class="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
		/>
		<input
			name="pr"
			placeholder="PR #"
			autocomplete="off"
			class="w-24 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
		/>
		<input
			name="title"
			placeholder="PR title (optional)"
			autocomplete="off"
			class="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
		/>
		<button
			type="submit"
			class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
		>
			Ingest
		</button>
	</form>
</section>

<div class="mb-3 flex items-baseline justify-between">
	<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		All roots
	</h2>
	<span class="font-mono text-xs text-muted-foreground">{data.roots.length}</span>
</div>

<div class="space-y-3">
	{#each data.roots as r (r.id)}
		<section class="rounded-xl border border-border bg-card/30 p-5">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h3 class="flex items-baseline gap-2">
					<code class="font-mono text-base font-semibold">{r.slug}</code>
					<span class="text-sm text-muted-foreground">{r.name}</span>
					{#if r.featured}
						<span class="font-micro text-[0.6rem] uppercase tracking-wide text-level-3">★ featured</span>
					{/if}
				</h3>
				<p class="font-mono text-xs text-muted-foreground">
					owner @{r.ownerGithub} · {r.seedCount} seed{r.seedCount === 1 ? '' : 's'} ·
					{r.acceptedCount} accepted
				</p>
			</div>
			<form
				method="POST"
				action="?/transfer"
				use:enhance
				class="mt-3 flex flex-wrap items-center gap-2"
			>
				<input type="hidden" name="rootId" value={r.id} />
				<input
					name="github"
					placeholder="transfer to @handle"
					autocomplete="off"
					class="rounded-lg border border-input bg-background px-3 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
				/>
				<button
					type="submit"
					class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
				>
					Transfer →
				</button>
			</form>
		</section>
	{/each}
	{#if data.roots.length === 0}
		<p class="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
			No roots minted yet. Mint the first one above.
		</p>
	{/if}
</div>
