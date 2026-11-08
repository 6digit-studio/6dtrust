<script lang="ts">
	import { enhance } from '$app/forms';
	import LevelBadge from '$lib/components/level-badge.svelte';
	import LevelPicker from '$lib/components/level-picker.svelte';
	let { data, form } = $props();

	let confirmingDelete = $state(false);
	let confirmText = $state('');
</script>

<svelte:head><title>Dashboard — 6dtrust</title></svelte:head>

<header class="mb-10">
	<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		Your trust graph
	</p>
	<h1 class="mt-1.5 font-display text-3xl font-semibold tracking-tight">Dashboard</h1>
	<p class="mt-2 max-w-xl text-sm text-muted-foreground">
		Add people to your trust graph. Your vouches are signed edges in it — every viewer's root
		decides what they're worth.
	</p>
	<div class="mt-4 flex flex-wrap items-center gap-2">
		<span
			class="rounded-md border border-border bg-card/60 px-2 py-1 font-mono text-xs text-muted-foreground"
		>
			identity {data.user.id.slice(0, 8)}…
		</span>
		<span
			class="rounded-md border border-border bg-card/60 px-2 py-1 font-mono text-xs text-muted-foreground"
		>
			{data.user.status}
		</span>
		{#each data.handles as h (h.kind + h.value)}
			<span
				class="rounded-md border border-border bg-card/60 px-2 py-1 font-mono text-xs text-muted-foreground"
			>
				{h.kind}:{h.value}{h.verified ? ' ✓' : ''}
			</span>
		{/each}
	</div>
</header>

{#if form?.message}
	<p
		class="mb-6 rounded-lg border px-4 py-2.5 text-sm {form.success
			? 'border-level-3/40 bg-card/40 text-level-3'
			: 'border-destructive/40 bg-card/40 text-destructive'}"
	>
		{form.message}
	</p>
{/if}

<section class="mb-10 rounded-xl border border-border bg-card/40 p-6">
	<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		Add to your trust graph
	</h2>
	<form method="POST" action="?/vouch" use:enhance class="mt-4 flex flex-wrap items-center gap-2.5">
		<div
			class="flex flex-1 items-center rounded-lg border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring"
		>
			<span class="font-mono text-sm text-muted-foreground">@</span>
			<input
				name="github"
				placeholder="github-username"
				autocomplete="off"
				class="w-full bg-transparent py-2 pl-1 font-mono text-sm outline-none placeholder:text-muted-foreground/50"
			/>
		</div>
		<LevelPicker />
	</form>
	<p class="mt-2.5 font-micro text-xs text-muted-foreground/70">
		Pick a level — that's the certification you sign, brightest is strongest.
	</p>
</section>

<div class="grid gap-6 md:grid-cols-2">
	<section>
		<div class="mb-3 flex items-baseline justify-between">
			<h2
				class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70"
			>
				Your vouches
			</h2>
			<span class="font-mono text-xs text-muted-foreground">{data.outgoing.length}</span>
		</div>
		{#if data.outgoing.length === 0}
			<p class="rounded-lg border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
				No vouches yet.
			</p>
		{:else}
			<ul class="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
				{#each data.outgoing as v (v.id)}
					<li class="flex items-center justify-between gap-3 bg-card/30 px-4 py-3">
						<div class="flex min-w-0 items-center gap-2">
							<span class="truncate font-mono text-sm">@{v.subject_github}</span>
							{#if v.subject_status === 'unclaimed'}
								<span class="font-micro text-[0.62rem] uppercase tracking-wide text-muted-foreground/60"
									>· off-graph</span
								>
							{/if}
						</div>
						<div class="flex shrink-0 items-center gap-2.5">
							<form method="POST" action="?/vouch" use:enhance>
								<input type="hidden" name="github" value={v.subject_github} />
								<LevelPicker current={v.level} size="sm" />
							</form>
							<form method="POST" action="?/revoke" use:enhance>
								<input type="hidden" name="subjectId" value={v.subject_id} />
								<button
									type="submit"
									title="Remove this vouch from your trust graph"
									class="font-micro text-xs text-muted-foreground transition-colors hover:text-destructive"
									>remove</button
								>
							</form>
						</div>
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
				Vouches for you
			</h2>
			<span class="font-mono text-xs text-muted-foreground">{data.incoming.length}</span>
		</div>
		{#if data.incoming.length === 0}
			<p class="rounded-lg border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
				No vouches for you yet.
			</p>
		{:else}
			<ul class="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
				{#each data.incoming as v (v.id)}
					<li class="flex items-center justify-between gap-3 bg-card/30 px-4 py-3">
						<span class="truncate font-mono text-sm">@{v.voucher_github}</span>
						<LevelBadge level={v.level} />
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<p class="mt-8 text-sm text-muted-foreground">
	Manage the seed sets trust is computed against on the <a
		href="/roots"
		class="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
		>roots page →</a
	>
</p>

<section class="mt-12 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
	<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
		Danger zone
	</h2>
	<p class="mt-3 max-w-xl text-sm text-muted-foreground">
		Delete your account and everything tied to it — your vouches (given and received), your seed
		memberships, and your sessions. Any root you own becomes unclaimed again, free for its next seed
		to claim. This is permanent and can't be undone.
	</p>
	{#if !confirmingDelete}
		<button
			type="button"
			onclick={() => (confirmingDelete = true)}
			class="mt-4 rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
		>
			Delete my account
		</button>
	{:else}
		<form method="POST" action="?/deleteAccount" use:enhance class="mt-4 space-y-3">
			<label class="block text-sm text-muted-foreground">
				Type <span class="font-mono font-semibold text-foreground">DELETE</span> to confirm
				<input
					bind:value={confirmText}
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					class="mt-1.5 block w-48 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
				/>
			</label>
			<div class="flex flex-wrap gap-3">
				<button
					type="button"
					onclick={() => {
						confirmingDelete = false;
						confirmText = '';
					}}
					class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={confirmText !== 'DELETE'}
					class="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					Permanently delete
				</button>
			</div>
		</form>
	{/if}
</section>
