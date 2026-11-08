<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	let { data, form } = $props();

	// Inline per-form feedback: the result renders NEXT TO the button you clicked,
	// not as a lone banner at the top of the page (invisible when the button is
	// below the fold — the whole reason recompute felt dead). Keyed by action+root.
	let fb = $state<Record<string, { pending: boolean; ok?: boolean; msg?: string }>>({});
	function inline(key: string): SubmitFunction {
		return () => {
			fb[key] = { pending: true };
			return async ({ result }) => {
				await invalidateAll(); // refresh the row (computedAt / accepted counts)
				const ok = result.type === 'success';
				const msg =
					(result.type === 'success' || result.type === 'failure') &&
					typeof result.data?.message === 'string'
						? result.data.message
						: ok
							? 'Done'
							: 'Failed';
				fb[key] = { pending: false, ok, msg };
				setTimeout(() => {
					const next = { ...fb };
					delete next[key];
					fb = next;
				}, 6000);
			};
		};
	}
</script>

<svelte:head><title>Roots — 6dtrust</title></svelte:head>

<header class="mb-8">
	<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		Seed sets
	</p>
	<h1 class="mt-1.5 font-display text-3xl font-semibold tracking-tight">Roots</h1>
	<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
		A <strong class="font-medium text-foreground">root</strong> is a seed set — trust is computed
		<em class="not-italic text-foreground">relative</em> to it. The same person can be trusted under
		one root and pending under another. There is no global verdict, only "trusted from
		<em class="not-italic text-foreground">this</em> viewpoint".
	</p>
</header>

{#if data.user}
	{#if form?.message}
		<p
			class="mb-5 rounded-lg border px-4 py-2.5 text-sm {form.success
				? 'border-level-3/40 bg-card/40 text-level-3'
				: 'border-destructive/40 bg-card/40 text-destructive'}"
		>
			{form.message}
		</p>
	{/if}

	<div class="mb-3 flex items-baseline justify-between">
		<h2 class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
			Your roots
		</h2>
		<span class="font-mono text-xs text-muted-foreground">{data.roots.length}</span>
	</div>

	<div class="space-y-4">
		{#each data.roots as r (r.id)}
			<section class="rounded-xl border border-border bg-card/30 p-5">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<h3 class="flex items-baseline gap-2">
						<a href="/r/{r.slug}" class="font-mono text-base font-semibold hover:underline"
							>{r.slug}</a
						>
						<span class="text-sm text-muted-foreground">{r.name}</span>
					</h3>
					<p class="font-mono text-xs text-muted-foreground">
						{r.seedCount} seed{r.seedCount === 1 ? '' : 's'} · {r.acceptedCount} accepted ·
						{r.computedAt ? `computed ${new Date(r.computedAt).toLocaleString()}` : 'never computed'}
					</p>
				</div>

				<ul class="mt-4 space-y-1.5">
					{#each r.seeds as s (s.identityId)}
						<li
							class="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/40 px-3.5 py-2"
						>
							<div class="flex min-w-0 items-center gap-2">
								<span class="truncate font-mono text-sm">@{s.github}</span>
								{#if s.status === 'unclaimed'}
									<span
										class="font-micro text-[0.6rem] uppercase tracking-wide text-muted-foreground/60"
										>· off-graph</span
									>
								{/if}
							</div>
							<form method="POST" action="?/removeSeed" use:enhance>
								<input type="hidden" name="rootId" value={r.id} />
								<input type="hidden" name="identityId" value={s.identityId} />
								<button
									type="submit"
									class="font-micro text-xs text-muted-foreground transition-colors hover:text-destructive"
									>remove</button
								>
							</form>
						</li>
					{/each}
					{#if r.seeds.length === 0}
						<li class="rounded-lg border border-dashed border-border/60 px-3.5 py-2.5 text-sm text-muted-foreground">
							No seeds yet — add at least one, then recompute.
						</li>
					{/if}
				</ul>

				<div class="mt-4 flex flex-wrap items-center gap-2.5">
					<form
						method="POST"
						action="?/addSeed"
						use:enhance={inline(`addSeed-${r.id}`)}
						class="flex flex-1 items-center gap-2"
					>
						<div
							class="flex flex-1 items-center rounded-lg border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring"
						>
							<span class="font-mono text-sm text-muted-foreground">@</span>
							<input type="hidden" name="rootId" value={r.id} />
							<input
								name="github"
								placeholder="seed github username"
								autocomplete="off"
								class="w-full bg-transparent py-1.5 pl-1 font-mono text-sm outline-none placeholder:text-muted-foreground/50"
							/>
						</div>
						{#if fb[`addSeed-${r.id}`]?.msg}
							<span
								class="whitespace-nowrap text-xs {fb[`addSeed-${r.id}`]?.ok
									? 'text-level-3'
									: 'text-destructive'}">{fb[`addSeed-${r.id}`]?.msg}</span
							>
						{/if}
						<button
							type="submit"
							disabled={fb[`addSeed-${r.id}`]?.pending}
							class="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
							>{fb[`addSeed-${r.id}`]?.pending ? 'Adding…' : 'Add seed'}</button
						>
					</form>
					<form method="POST" action="?/setFeatured" use:enhance={inline(`featured-${r.id}`)}>
						<input type="hidden" name="rootId" value={r.id} />
						<input type="hidden" name="featured" value={r.featured ? 'false' : 'true'} />
						<button
							type="submit"
							disabled={fb[`featured-${r.id}`]?.pending}
							title={r.featured
								? 'Shown in the public landing demo — click to remove'
								: 'Show this root in the public landing demo'}
							class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 {r.featured
								? 'border-level-3/40 bg-level-3/10 text-level-3'
								: 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'}"
							>{r.featured ? '★ Featured' : '☆ Feature'}</button
						>
					</form>
					<form
						method="POST"
						action="?/recompute"
						use:enhance={inline(`recompute-${r.id}`)}
						class="flex items-center gap-2.5"
					>
						<input type="hidden" name="rootId" value={r.id} />
						<button
							type="submit"
							disabled={fb[`recompute-${r.id}`]?.pending}
							class="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
							>{fb[`recompute-${r.id}`]?.pending ? 'Recomputing…' : 'Recompute'}</button
						>
						{#if fb[`recompute-${r.id}`]?.msg}
							<span
								class="text-xs {fb[`recompute-${r.id}`]?.ok ? 'text-level-3' : 'text-destructive'}"
								>{fb[`recompute-${r.id}`]?.msg}</span
							>
						{/if}
					</form>
				</div>

				<details class="mt-4 rounded-lg border border-border/50 bg-background/30 p-4">
					<summary class="cursor-pointer text-sm font-medium text-foreground">
						Poison — context-relative <em class="not-italic text-muted-foreground">no</em>
						{#if r.poison.length > 0}
							<span class="ml-1 font-mono text-xs text-muted-foreground">({r.poison.length})</span>
						{/if}
					</summary>
					<p class="mt-2 text-xs text-muted-foreground">
						Exclude a node from <em class="not-italic text-foreground">this</em> root: it drops out
						<em class="not-italic text-foreground">and</em> stops passing trust through itself. The reason
						is public — it says what this root is for, not that anyone did wrong. Never aggregated across roots.
						Recompute to apply.
					</p>

					<ul class="mt-3 space-y-1.5">
						{#each r.poison as p (p.identityId)}
							<li class="rounded-lg border border-destructive/30 bg-destructive/[0.04] px-3.5 py-2">
								<div class="flex items-center justify-between gap-3">
									<span class="truncate font-mono text-sm">@{p.github}</span>
									<form method="POST" action="?/removePoison" use:enhance>
										<input type="hidden" name="rootId" value={r.id} />
										<input type="hidden" name="identityId" value={p.identityId} />
										<button
											type="submit"
											class="font-micro text-xs text-muted-foreground transition-colors hover:text-foreground"
											>lift</button
										>
									</form>
								</div>
								{#if p.reason}
									<p class="mt-1 text-xs text-muted-foreground">{p.reason}</p>
								{/if}
							</li>
						{/each}
						{#if r.poison.length === 0}
							<li class="rounded-lg border border-dashed border-border/60 px-3.5 py-2.5 text-sm text-muted-foreground">
								Nothing excluded — this root includes everyone its seeds reach.
							</li>
						{/if}
					</ul>

					<form method="POST" action="?/addPoison" use:enhance class="mt-3 space-y-2">
						<input type="hidden" name="rootId" value={r.id} />
						<div
							class="flex items-center rounded-lg border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring"
						>
							<span class="font-mono text-sm text-muted-foreground">@</span>
							<input
								name="github"
								placeholder="github username to exclude"
								autocomplete="off"
								class="w-full bg-transparent py-1.5 pl-1 font-mono text-sm outline-none placeholder:text-muted-foreground/50"
							/>
						</div>
						<input
							name="reason"
							placeholder="why — what this root is for (public)"
							autocomplete="off"
							class="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
						/>
						<button
							type="submit"
							class="rounded-lg border border-destructive/40 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-foreground"
							>Poison node</button
						>
					</form>
				</details>

				<p class="mt-4 border-t border-border/50 pt-3 font-mono text-xs text-muted-foreground">
					<a href="/r/{r.slug}" class="text-foreground hover:underline">Public profile</a>
					· badge · <code class="text-foreground">/badge/{r.slug}/&lt;github&gt;</code>
				</p>

				<details class="mt-4 rounded-lg border border-border/50 bg-background/30 p-4">
					<summary class="cursor-pointer text-sm font-medium text-foreground">Profile chrome</summary>
					<p class="mt-2 text-xs text-muted-foreground">
						Display name shows everywhere this root appears. Tagline, description, and links render on
						the public page only when featured. Slug stays fixed — it anchors URLs and badges.
					</p>
					<form method="POST" action="?/updateProfile" use:enhance class="mt-4 space-y-3">
						<input type="hidden" name="rootId" value={r.id} />
						<label class="block">
							<span class="font-micro text-xs uppercase tracking-wide text-muted-foreground/70"
								>Display name</span
							>
							<input
								name="name"
								value={r.name}
								placeholder="Open Source Contributors"
								class="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
						<label class="block">
							<span class="font-micro text-xs uppercase tracking-wide text-muted-foreground/70"
								>Tagline</span
							>
							<input
								name="tagline"
								value={r.tagline ?? ''}
								placeholder="One line — what this root is for"
								class="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
							/>
						</label>
						<label class="block">
							<span class="font-micro text-xs uppercase tracking-wide text-muted-foreground/70"
								>Description</span
							>
							<textarea
								name="description"
								rows="3"
								placeholder="Longer context for featured roots"
								class="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
								>{r.description ?? ''}</textarea
							>
						</label>
						<div class="grid gap-3 sm:grid-cols-2">
							<label class="block">
								<span class="font-micro text-xs uppercase tracking-wide text-muted-foreground/70"
									>Avatar URL</span
								>
								<input
									name="avatarUrl"
									value={r.avatarUrl ?? ''}
									placeholder="https://…"
									class="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
								/>
							</label>
							<label class="block">
								<span class="font-micro text-xs uppercase tracking-wide text-muted-foreground/70"
									>Homepage</span
								>
								<input
									name="homepageUrl"
									value={r.homepageUrl ?? ''}
									placeholder="https://…"
									class="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
								/>
							</label>
						</div>
						<button
							type="submit"
							class="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
							>Save profile</button
						>
					</form>
				</details>
			</section>
		{/each}
		{#if data.roots.length === 0}
			<p class="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
				No roots yet. Roots are minted by an admin — once you own one, add seeds and recompute
				here to see the graph resolve.
			</p>
		{/if}
	</div>
{:else}
	<div class="rounded-xl border border-border bg-card/40 p-8 text-center">
		<p class="text-sm text-muted-foreground">Sign in to create and manage roots.</p>
		<a
			href="/login/github"
			class="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
		>
			Sign in with GitHub
		</a>
	</div>
{/if}
