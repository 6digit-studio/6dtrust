<script lang="ts">
	let { data } = $props();
	const Content = $derived(data.Content);
</script>

<svelte:head>
	<title>{data.meta.title} — 6dtrust</title>
	<meta name="description" content={data.meta.summary} />
</svelte:head>

<article class="mx-auto max-w-2xl">
	<header class="mb-10">
		<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
			Article
		</p>
		<h1 class="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
			{data.meta.title}
		</h1>
		<p class="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">{data.meta.summary}</p>
	</header>

	<div class="copy">
		<Content />
	</div>

	<p class="mt-12 text-sm text-muted-foreground">
		<a
			href="/articles"
			class="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
			>← All articles</a
		>
	</p>
</article>
