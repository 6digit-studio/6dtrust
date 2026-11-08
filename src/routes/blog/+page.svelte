<script lang="ts">
	import { formatDate } from '$lib/content';
	let { data } = $props();
</script>

<svelte:head>
	<title>Blog — 6dtrust</title>
	<meta name="description" content="A dated log of how 6dtrust is being built." />
</svelte:head>

<header class="mb-10 max-w-2xl">
	<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		Blog
	</p>
	<h1 class="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
		The build log
	</h1>
	<p class="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">
		Notes, announcements, and decisions, newest first.
	</p>
</header>

<ul class="flex max-w-2xl flex-col gap-3">
	{#each data.posts as post (post.slug)}
		<li>
			<a
				href="/blog/{post.slug}"
				class="block rounded-xl border border-border bg-card/30 p-5 transition-colors hover:bg-card/60"
			>
				<time class="font-micro text-xs uppercase tracking-[0.14em] text-muted-foreground/70"
					>{formatDate(post.date)}</time
				>
				<h2 class="mt-1 font-display text-lg font-semibold tracking-tight">{post.title}</h2>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{post.summary}</p>
			</a>
		</li>
	{:else}
		<li class="text-sm text-muted-foreground/70">No posts yet.</li>
	{/each}
</ul>
