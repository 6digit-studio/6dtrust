<script lang="ts">
	import { formatDate } from '$lib/content';
	let { data } = $props();
</script>

<svelte:head>
	<title>Writing — 6dtrust</title>
	<meta
		name="description"
		content="Articles and notes on attack-resistant, viewer-relative trust — how the metric works and where the project is going."
	/>
</svelte:head>

<header class="mb-12 max-w-2xl">
	<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		Writing
	</p>
	<h1 class="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
		Articles &amp; notes
	</h1>
	<p class="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">
		Evergreen explainers on how attack-resistant trust works, and a dated log of how the project is
		being built.
	</p>
</header>

<div class="grid gap-12 sm:grid-cols-2">
	<!-- Articles — evergreen -->
	<section>
		<div class="mb-5 flex items-baseline justify-between">
			<h2 class="font-display text-xl font-semibold tracking-tight">Articles</h2>
			<a
				href="/articles"
				class="font-micro text-xs uppercase tracking-[0.14em] text-muted-foreground/70 transition-colors hover:text-foreground"
				>All →</a
			>
		</div>
		<ul class="flex flex-col gap-3">
			{#each data.articles as post (post.slug)}
				<li>
					<a
						href="/articles/{post.slug}"
						class="block rounded-xl border border-border bg-card/30 p-4 transition-colors hover:bg-card/60"
					>
						<h3 class="font-display text-base font-semibold tracking-tight">{post.title}</h3>
						<p class="mt-1 text-sm leading-relaxed text-muted-foreground">{post.summary}</p>
					</a>
				</li>
			{:else}
				<li class="text-sm text-muted-foreground/70">Nothing here yet.</li>
			{/each}
		</ul>
	</section>

	<!-- Blog — dated -->
	<section>
		<div class="mb-5 flex items-baseline justify-between">
			<h2 class="font-display text-xl font-semibold tracking-tight">Blog</h2>
			<a
				href="/blog"
				class="font-micro text-xs uppercase tracking-[0.14em] text-muted-foreground/70 transition-colors hover:text-foreground"
				>All →</a
			>
		</div>
		<ul class="flex flex-col gap-3">
			{#each data.blog as post (post.slug)}
				<li>
					<a
						href="/blog/{post.slug}"
						class="block rounded-xl border border-border bg-card/30 p-4 transition-colors hover:bg-card/60"
					>
						<time class="font-micro text-xs uppercase tracking-[0.14em] text-muted-foreground/70"
							>{formatDate(post.date)}</time
						>
						<h3 class="mt-1 font-display text-base font-semibold tracking-tight">{post.title}</h3>
						<p class="mt-1 text-sm leading-relaxed text-muted-foreground">{post.summary}</p>
					</a>
				</li>
			{:else}
				<li class="text-sm text-muted-foreground/70">Nothing here yet.</li>
			{/each}
		</ul>
	</section>
</div>
