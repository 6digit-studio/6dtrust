<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();

	// Maps to actOnSuggestion's levels (known=1, vouch=2, trust=3). A button is
	// disabled when your existing vouch already meets or exceeds it — upgrade-only,
	// so acting there would be a no-op.
	const LEVEL_ACTIONS = [
		{ action: 'known', level: 1, label: 'Known' },
		{ action: 'vouch', level: 2, label: 'Vouch' },
		{ action: 'trust', level: 3, label: 'Trust' }
	] as const;
</script>

<svelte:head><title>Inbox — 6dtrust</title></svelte:head>

<header class="mb-10">
	<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		Suggested vouches
	</p>
	<h1 class="mt-1.5 font-display text-3xl font-semibold tracking-tight">Inbox</h1>
	<p class="mt-2 max-w-xl text-sm text-muted-foreground">
		People you've worked with — surfaced from real activity, never auto-vouched. Vouch at a level,
		or dismiss. Each vouch is a signed edge in your trust graph.
	</p>
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

{#if data.items.length === 0}
	<p class="rounded-lg border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
		Your inbox is empty. As people merge your work (and the GitHub App is wired up), suggestions
		will land here.
	</p>
{:else}
	<ul class="divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
		{#each data.items as item (item.id)}
			<li class="bg-card/30 px-4 py-4">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<span class="font-mono text-sm">@{item.subjectGithub}</span>
						<p class="mt-0.5 text-sm text-muted-foreground">
							{item.line}
							{#if item.ago}<span class="text-muted-foreground/60"> · {item.ago}</span>{/if}
						</p>
					</div>
					<form method="POST" action="?/act" use:enhance class="shrink-0">
						<input type="hidden" name="suggestionId" value={item.id} />
						<button
							type="submit"
							name="action"
							value="dismiss"
							title="Hide this suggestion"
							class="font-micro text-xs text-muted-foreground transition-colors hover:text-destructive"
							>dismiss</button
						>
					</form>
				</div>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each LEVEL_ACTIONS as a (a.action)}
						{@const met = item.currentLevel >= a.level}
						<form method="POST" action="?/act" use:enhance>
							<input type="hidden" name="suggestionId" value={item.id} />
							<button
								type="submit"
								name="action"
								value={a.action}
								disabled={met}
								title={met ? `Already vouched at ${a.label.toLowerCase()} or higher` : `Vouch: ${a.label}`}
								class="rounded-lg border border-input px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
								>{a.label}</button
							>
						</form>
					{/each}
				</div>
			</li>
		{/each}
	</ul>
{/if}

<p class="mt-8 text-sm text-muted-foreground">
	Manage all your vouches on the <a
		href="/dashboard"
		class="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
		>dashboard →</a
	>
</p>
