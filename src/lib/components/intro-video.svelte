<script lang="ts">
	// Click-to-play facade for the 6dtrust intro video. Shows our own rendered
	// thumbnail (the YT account isn't verified for custom thumbnails, and the
	// poster is sharper than YouTube's auto-frame anyway) and only loads the heavy
	// YouTube iframe on click — keeps the hero fast. youtube-nocookie + rel=0 so a
	// pause doesn't surface unrelated recommendations.
	const VIDEO_ID = 'PYj8hbLAo7k';
	let playing = $state(false);
</script>

<div
	class="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-card/40 shadow-2xl shadow-black/20"
>
	{#if playing}
		<iframe
			class="absolute inset-0 size-full"
			src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
			title="6dtrust — intro"
			frameborder="0"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen
		></iframe>
	{:else}
		<button
			type="button"
			onclick={() => (playing = true)}
			class="group absolute inset-0 size-full cursor-pointer"
			aria-label="Play the 6dtrust intro video"
		>
			<img
				src="/intro-poster.webp"
				alt="6dtrust — one honest vouch starves a swarm of a million fakes"
				width="1280"
				height="720"
				class="size-full object-cover"
			/>
			<span class="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/0"></span>
			<span
				class="absolute left-1/2 top-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary/90 shadow-lg shadow-black/30 backdrop-blur-sm transition-transform group-hover:scale-105"
			>
				<svg
					viewBox="0 0 24 24"
					class="ml-1 size-8 text-primary-foreground"
					fill="currentColor"
					aria-hidden="true"
				>
					<path d="M8 5v14l11-7z" />
				</svg>
			</span>
		</button>
	{/if}
</div>
