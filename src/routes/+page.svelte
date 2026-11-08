<script lang="ts">
	import { page } from '$app/state';
	import IntroVideo from '$lib/components/intro-video.svelte';
	import LevelBadge from '$lib/components/level-badge.svelte';
	import SeedsInfo from '$lib/components/seeds-info.svelte';
	import { LEVELS } from '$lib/levels';
	import { SOCIAL_LINKS } from '$lib/social';

	let { data } = $props();

	const CAROUSEL_INTERVAL_MS = 7000;

	// Featured roots with seeds and a computed accept-set count — no member roster.
	const roots = $derived(data.roots.filter((r) => r.seeds.length > 0 && r.acceptedCount > 0));

	// Initial worldview is deep-linkable via ?root=<slug>, so a switched demo
	// state is shareable. After mount, clicking the switcher is pure local state.
	let selectedSlug = $state<string | null>(page.url.searchParams.get('root'));
	const selected = $derived(roots.find((r) => r.slug === selectedSlug) ?? roots[0] ?? null);

	let carouselPaused = $state(false);
	// The "+" tile in the icon row takes over the demo card with how-to-get-a-root
	// info. Minting is gated (admin-only), so this is an apply funnel, not self-serve.
	let minting = $state(false);

	function selectRoot(slug: string) {
		selectedSlug = slug;
		minting = false;
	}

	$effect(() => {
		if (roots.length <= 1) return;
		const id = setInterval(() => {
			if (carouselPaused || minting) return;
			const currentIdx = roots.findIndex((r) => r.slug === selectedSlug);
			const nextIdx = (Math.max(currentIdx, 0) + 1) % roots.length;
			selectedSlug = roots[nextIdx].slug;
		}, CAROUSEL_INTERVAL_MS);
		return () => clearInterval(id);
	});

	const seeds = $derived(
		[...(selected?.seeds ?? [])].sort((a, b) => a.github.localeCompare(b.github))
	);

	// Copy-paste snippet uses placeholders — the live preview shows a generic pending badge.
	const origin = $derived(page.url.origin);
</script>

<svelte:head>
	<title>6dtrust — attack-resistant trust, computed from your seeds</title>
</svelte:head>

<!-- ── Hero ─────────────────────────────────────────────────────────── -->
<section class="grid items-start gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
	<div class="pt-2">
		<div
			class="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/50 px-2.5 py-1 font-micro text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
		>
			<span class="relative flex size-1.5">
				<span class="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75"></span>
				<span class="relative inline-flex size-1.5 rounded-full bg-primary"></span>
			</span>
			Pre-release
		</div>
		<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
			Attack-resistant trust · computed from your seeds
		</p>
		<h1 class="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
			Trust isn't global.
			<span class="text-muted-foreground">It's subjective.</span>
		</h1>
		<p class="mt-5 max-w-lg text-[0.95rem] leading-relaxed text-muted-foreground">
			Who you trust is a subjective decision, and it changes with context. 6dtrust just computes it:
			pick a <strong class="font-medium text-foreground">root</strong> — an open-source community,
			your company, or just you — and trust flows out from there. Same vouch graph, different root,
			different verdicts. A calculator, not a judge.
		</p>

		<p
			class="mt-6 border-l-2 border-border/60 pl-4 font-display text-base font-medium leading-snug text-foreground/90"
		>
			On the internet, security is abundant. <span class="text-muted-foreground"
				>Trust is scarce.</span
			>
		</p>

		<div class="mt-7 flex flex-wrap items-center gap-3">
			{#if data.user}
				<a
					href="/dashboard"
					class="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
				>
					Open dashboard
				</a>
				<a
					href="/roots"
					class="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
				>
					Manage roots
				</a>
			{:else}
				<a
					href="/login/github"
					class="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
				>
					Sign in with GitHub
				</a>
				<a
					href="#how"
					class="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
				>
					How it works
				</a>
			{/if}
		</div>
	</div>

	<!-- The live divergence demo -->
	<div
		role="region"
		aria-label="Live root divergence demo"
		class="rounded-2xl border border-border bg-card/40 p-5 shadow-2xl shadow-black/20 sm:p-6"
		onmouseenter={() => (carouselPaused = true)}
		onmouseleave={() => (carouselPaused = false)}
		onfocusin={() => (carouselPaused = true)}
		onfocusout={(e) => {
			const target = e.currentTarget;
			if (target instanceof HTMLElement && !target.contains(e.relatedTarget as Node | null)) {
				carouselPaused = false;
			}
		}}
	>
		{#if selected}
			<!-- Root picker: icons in a row; detail panel below the active one -->
			<div role="radiogroup" aria-label="Featured roots">
				<div class="flex flex-wrap gap-2">
					{#each roots as r (r.slug)}
						{@const active = selected.slug === r.slug}
						<button
							type="button"
							role="radio"
							aria-checked={active}
							aria-label={r.name}
							title={r.name}
							onclick={() => selectRoot(r.slug)}
							class="rounded-lg outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring {active
								? 'ring-2 ring-[#38d39c] shadow-[0_0_16px_rgba(56,211,156,0.4)]'
								: 'opacity-70 hover:opacity-100'}"
						>
							{#if r.avatarUrl}
								<img
									src={r.avatarUrl}
									alt=""
									width="44"
									height="44"
									class="block size-11 rounded-lg border border-border bg-card object-cover"
								/>
							{:else}
								<span
									class="grid size-11 place-items-center rounded-lg border border-border bg-card font-mono text-sm font-semibold text-muted-foreground"
								>
									{r.slug.slice(0, 2)}
								</span>
							{/if}
						</button>
					{/each}
					<button
						type="button"
						aria-label="Get your own root"
						title="Get your own root"
						onclick={() => (minting = true)}
						class="grid size-11 place-items-center rounded-lg border border-dashed text-xl font-semibold leading-none outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring {minting
							? 'border-[#38d39c] text-foreground shadow-[0_0_16px_rgba(56,211,156,0.4)]'
							: 'border-border/70 text-muted-foreground hover:border-border hover:text-foreground'}"
					>
						+
					</button>
				</div>

				{#if minting}
					<!-- Minting takeover. Roots are gated, so this is "apply", not self-serve. -->
					<div class="mt-4">
						<h3 class="font-display text-base font-semibold tracking-tight">Get a root</h3>
						<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
							Roots are deliberately scarce. Each one is expensive to compute, and a small,
							curated set is more trustworthy than a flood of them. During pre-release we hand-mint
							roots for established open-source communities and non-profits.
						</p>
						<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
							Open-source foundations, language communities, major projects — if that's yours,
							come tell us about it.
						</p>
						<div class="mt-5 flex flex-wrap items-center gap-3">
							<button
								type="button"
								onclick={() => (minting = false)}
								class="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
							>
								← Back to roots
							</button>
							<a
								href={SOCIAL_LINKS.discord.href}
								target="_blank"
								rel="noopener noreferrer"
								class="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
							>
								Apply on Discord
							</a>
						</div>
					</div>
				{:else}
				<div class="mt-4 min-h-[5.5rem] border-b border-border/60 pb-4">
					<h3 class="font-display text-base font-semibold tracking-tight">
						<span class="font-mono text-sm text-muted-foreground">{selected.slug.toUpperCase()}</span>
						<span class="mx-1.5 text-muted-foreground/50">—</span>
						<span>{selected.name}</span>
					</h3>
					{#if selected.tagline && selected.tagline.trim().toLowerCase() !== selected.name.trim().toLowerCase()}
						<p class="mt-1 text-sm text-muted-foreground">{selected.tagline}</p>
					{/if}
					{#if selected.description}
						<p class="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground/90">
							{selected.description}
						</p>
					{/if}
					<div class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.68rem] text-muted-foreground">
						<a href="/r/{selected.slug}" class="text-foreground transition-colors hover:underline">
							View root →
						</a>
						{#if selected.homepageUrl}
							<a
								href={selected.homepageUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="transition-colors hover:text-foreground hover:underline"
							>
								Homepage ↗
							</a>
						{/if}
						<span>
							{selected.seedCount} seed{selected.seedCount === 1 ? '' : 's'} · {selected.acceptedCount}
							accepted
						</span>
					</div>
				</div>
				{/if}
			</div>

			{#if !minting}
			<div class="mt-4 flex items-baseline justify-between gap-2">
				<div class="flex items-center gap-2">
					<span class="font-micro text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
						Seeds
					</span>
					<SeedsInfo rootName={selected.name} />
				</div>
				<span class="font-mono text-[0.62rem] text-muted-foreground">
					Look up anyone via profile
				</span>
			</div>
			<ul class="mt-2 h-56 space-y-1.5 overflow-y-auto pr-1">
				{#each seeds as seed (seed.identityId)}
					<li
						class="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/40 px-3.5 py-2.5"
					>
						<div class="flex min-w-0 items-center gap-2">
							<a href="/u/{seed.github}" class="truncate font-mono text-sm hover:underline"
								>@{seed.github}</a
							>
							{#if seed.status === 'unclaimed'}
								<span
									class="font-micro text-[0.55rem] uppercase tracking-wide text-muted-foreground/60"
									>off-graph</span
								>
							{/if}
						</div>
						<span
							class="rounded-full border border-border/70 px-1.5 py-px font-micro text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
							>seed</span
						>
					</li>
				{/each}
			</ul>
			{/if}
		{:else}
			<p class="py-12 text-center text-sm text-muted-foreground">
				No public roots computed yet.
				{#if data.user?.isAdmin}
					<a href="/admin" class="text-foreground underline underline-offset-2">Mint one</a> to see the
					graph diverge.
				{/if}
			</p>
		{/if}
	</div>
</section>

{#if roots.length > 1}
	<p class="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
		Featured roots rotate automatically — pick an icon to hold one, or open its page from the link
		below. The graph never changed — only the seeds did. The same person can be
		<span class="text-level-3">trusted</span> from one worldview and
		<span class="text-muted-foreground">pending</span> from another. That gap is the entire point.
	</p>
{/if}

<!-- ── Intro video: the 5-minute explainer ──────────────────────────── -->
<section class="mt-14">
	<div class="mx-auto max-w-2xl text-center">
		<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
			Watch · the idea in five minutes
		</p>
		<h2 class="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
			Triage by trust you actually hold
		</h2>
		<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
			Why counting fails, why trust is subjective, and how one honest vouch starves a swarm of a
			million fakes — the whole reasoning, start to finish.
		</p>
	</div>
	<div class="mx-auto mt-6 max-w-3xl">
		<IntroVideo />
	</div>
</section>

<!-- ── Badge showcase: the live, embeddable artifact ────────────────── -->
{#if selected}
	<section class="mt-12 rounded-2xl border border-border bg-card/40 p-6 sm:p-7">
		<div class="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
			<div class="max-w-sm">
				<p
					class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70"
				>
					A real, embeddable badge
				</p>
				<h2 class="mt-2 font-display text-xl font-semibold tracking-tight">
					Put your trust on your README
				</h2>
				<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
					Every badge is a live, verifiable view into computed state — not a vanity sticker. It
					updates when the graph does, and says different things from different roots.
				</p>
			</div>
			<div class="flex min-w-0 shrink-0 flex-col items-start gap-3">
				<img
					src="/badge/{selected.slug}/your-handle"
					alt="Example trust badge for the {selected.slug} root"
					height="22"
					class="h-8 w-auto"
				/>
				<code
					class="block max-w-full overflow-x-auto whitespace-nowrap rounded-md border border-border/60 bg-background/50 px-3 py-2 font-mono text-xs text-muted-foreground"
				>![trust]({origin}/badge/{selected.slug}/&lt;github-handle&gt;)</code>
			</div>
		</div>
	</section>
{/if}

<!-- ── How it works ─────────────────────────────────────────────────── -->
<section id="how" class="mt-20 scroll-mt-20 border-t border-border/70 pt-12">
	<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		How it works
	</p>
	<div class="mt-6 grid gap-4 md:grid-cols-3">
		{#each [{ n: '01', t: 'Certify', b: 'People add each other to their trust graphs at three levels — known, vouched, trusted. Each edge is signed, verifiable without trusting the operator.' }, { n: '02', t: 'Choose seeds', b: "Pick a root: the seed identities whose trust you take as given. There's no hard-wired global seed — your seeds define your worldview." }, { n: '03', t: 'Compute', b: "A max-flow runs from your seeds through the graph. Node capacity falls with distance, so a flood of fake accounts can't buy trust. The output is who's accepted, at what level." }] as step (step.n)}
			<div class="rounded-xl border border-border bg-card/30 p-5">
				<span class="font-mono text-xs text-muted-foreground">{step.n}</span>
				<h3 class="mt-2 font-display text-lg font-semibold tracking-tight">{step.t}</h3>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.b}</p>
			</div>
		{/each}
	</div>
</section>

<!-- ── Levels legend ────────────────────────────────────────────────── -->
<section class="mt-16">
	<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
		Certification levels
	</p>
	<div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each [3, 2, 1, 0] as lvl (lvl)}
			<div class="rounded-xl border border-border bg-card/30 p-4">
				<LevelBadge level={lvl} size="md" />
				<p class="mt-2.5 text-sm leading-snug text-muted-foreground">
					{LEVELS[lvl].blurb}
				</p>
			</div>
		{/each}
	</div>
</section>
