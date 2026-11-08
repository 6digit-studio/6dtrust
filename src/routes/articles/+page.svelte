<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Articles — 6dtrust</title>
	<meta
		name="description"
		content="Evergreen explainers on attack-resistant, viewer-relative trust."
	/>
</svelte:head>

<header class="mb-10 max-w-2xl">
	<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		Articles
	</p>
	<h1 class="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
		The evergreen explainers
	</h1>
	<p class="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">
		Reference pieces on how the metric works and why it's shaped the way it is. These don't go stale.
	</p>
</header>

<ul class="flex max-w-2xl flex-col gap-3">
	{#each data.posts as post (post.slug)}
		<li>
			<a
				href="/articles/{post.slug}"
				class="block rounded-xl border border-border bg-card/30 p-5 transition-colors hover:bg-card/60"
			>
				<h2 class="font-display text-lg font-semibold tracking-tight">{post.title}</h2>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{post.summary}</p>
			</a>
		</li>
	{:else}
		<li class="text-sm text-muted-foreground/70">No articles yet.</li>
	{/each}
</ul>
