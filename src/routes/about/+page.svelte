<script lang="ts">
	// Static explainer. The mechanics below are grounded in the real engine:
	// src/lib/server/trust/maxflow.ts (capacity-by-distance, node-splitting,
	// unit accept-edges, Dinic) and worker.ts (three runs over level>=L subsets).
</script>

<svelte:head>
	<title>How it works — 6dtrust</title>
	<meta
		name="description"
		content="How 6dtrust computes attack-resistant, viewer-relative trust — a modernized Advogato max-flow metric. Credits Raph Levien."
	/>
</svelte:head>

<article class="mx-auto max-w-2xl">
	<header class="mb-12">
		<p class="font-micro text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
			How it works
		</p>
		<h1 class="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
			A calculator for trust
		</h1>
		<p class="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">
			6dtrust is a modernized, generalized version of the Advogato trust metric. It answers one
			question — <em class="not-italic text-foreground"
				>given who <strong class="font-medium text-foreground">you</strong> already trust, who else
				should you trust?</em
			> — and it answers it in a way that's hard to game with fake accounts. It holds no opinion of its
			own; it only computes.
		</p>
	</header>

	<!-- 1. The graph -->
	<section class="mb-10">
		<h2 class="font-display text-xl font-semibold tracking-tight">The graph is made of vouches</h2>
		<p class="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">
			Every person is a node. Every <strong class="font-medium text-foreground">vouch</strong> is a
			directed edge: “A certifies B,” at one of three levels — known, vouched, or trusted. A
			vouch is signed by the voucher's key, so it's self-authenticating: anyone can verify it without
			trusting whoever runs the service. The aggregator is an index, not an authority — it can't forge
			an edge or silently drop one.
		</p>
	</section>

	<!-- 2. Roots -->
	<section class="mb-10">
		<h2 class="font-display text-xl font-semibold tracking-tight">
			Trust is computed from a root, not a throne
		</h2>
		<p class="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">
			A <strong class="font-medium text-foreground">root</strong> is a set of seed identities you
			take as trusted-by-definition — your worldview's axioms. Trust is computed
			<em class="not-italic text-foreground">relative to that root</em>. Pick different seeds and the
			same graph yields different verdicts: a person can be trusted from one root and pending from
			another. There is no single global root handing down a universal score — that's the one thing
			this service deliberately refuses to be.
		</p>
	</section>

	<!-- 3. The metric + diagram -->
	<section class="mb-10">
		<h2 class="font-display text-xl font-semibold tracking-tight">Why fake accounts can't buy trust</h2>
		<p class="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">
			Trust flows out from the seeds like a current. Each node is given a
			<strong class="font-medium text-foreground">capacity</strong> that shrinks with its distance
			from the seeds, and the flow is solved as a max-flow problem (every node split so that being
			“accepted” costs one unit of flow). A node is trusted only if the current actually reaches it.
		</p>
		<p class="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">
			The consequence is the whole point: the number of bogus identities that can sneak into the
			trusted set is bounded by the capacity of the <em class="not-italic text-foreground"
				>real edges</em
			> leading into them — <strong class="font-medium text-foreground"
				>not by how many fakes exist</strong
			>. An attacker can spin up a million accounts; if only one trusted person vouches into that
			cluster, only a trickle of trust gets through. The bottleneck is the honest edge, and the
			attacker doesn't control it.
		</p>

		<figure class="mt-6 rounded-2xl border border-border bg-card/30 p-5">
			<svg viewBox="0 0 680 300" class="w-full" role="img" aria-label="Trust flows from the seed through trusted nodes; a single honest edge bounds how much trust a large cluster of fake accounts can receive.">
				<!-- trusted-region edges -->
				<g stroke="rgba(255,255,255,0.22)" stroke-width="2" fill="none">
					<line x1="70" y1="150" x2="210" y2="80" />
					<line x1="70" y1="150" x2="210" y2="220" />
					<line x1="210" y1="80" x2="350" y2="150" />
					<line x1="210" y1="220" x2="350" y2="150" />
					<line x1="210" y1="80" x2="330" y2="60" />
				</g>
				<!-- the one honest edge into the sybil cluster -->
				<line x1="350" y1="150" x2="500" y2="150" stroke="#38d39c" stroke-width="2.5" />
				<!-- sybil internal edges -->
				<g stroke="rgba(255,255,255,0.1)" stroke-width="1.5" fill="none">
					<line x1="500" y1="150" x2="560" y2="90" />
					<line x1="500" y1="150" x2="620" y2="120" />
					<line x1="500" y1="150" x2="640" y2="185" />
					<line x1="500" y1="150" x2="585" y2="215" />
					<line x1="560" y1="90" x2="630" y2="70" />
					<line x1="620" y1="120" x2="640" y2="185" />
				</g>
				<!-- sybil nodes -->
				<g fill="#565c67">
					<circle cx="500" cy="150" r="9" />
					<circle cx="560" cy="90" r="7" />
					<circle cx="620" cy="120" r="7" />
					<circle cx="640" cy="185" r="7" />
					<circle cx="585" cy="215" r="7" />
					<circle cx="630" cy="70" r="6" />
				</g>
				<!-- trusted nodes -->
				<circle cx="210" cy="80" r="11" fill="#2f9e85" />
				<circle cx="210" cy="220" r="11" fill="#2f9e85" />
				<circle cx="350" cy="150" r="11" fill="#46af92" />
				<circle cx="330" cy="60" r="10" fill="#5f897a" />
				<!-- seed -->
				<circle cx="70" cy="150" r="15" fill="#38d39c" />
				<!-- capacity labels -->
				<g fill="#8b8f99" font-family="ui-monospace,monospace" font-size="12">
					<text x="70" y="185" text-anchor="middle">seed ∞</text>
					<text x="210" y="62" text-anchor="middle">200</text>
					<text x="210" y="246" text-anchor="middle">200</text>
					<text x="372" y="146" text-anchor="start">50</text>
				</g>
				<!-- annotations -->
				<text x="425" y="135" text-anchor="middle" fill="#38d39c" font-family="ui-monospace,monospace" font-size="11">one honest edge</text>
				<text x="592" y="258" text-anchor="middle" fill="#8b8f99" font-family="ui-monospace,monospace" font-size="11">any number of fakes</text>
			</svg>
			<figcaption class="mt-3 text-center font-micro text-xs text-muted-foreground/70">
				Capacity shrinks with distance from the seed; the cluster of fakes is throttled by the single
				real edge into it, no matter how large it grows.
			</figcaption>
		</figure>
	</section>

	<!-- 4. Levels -->
	<section class="mb-10">
		<h2 class="font-display text-xl font-semibold tracking-tight">Three levels, three passes</h2>
		<p class="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">
			The metric runs three times — once over level-3 edges only, once including level 2,
			once including level 1. A node's level is the highest pass at which the current still reaches
			it. Stricter trust travels a shorter distance; looser trust reaches further. The result is
			cached as an accept-set per root, so reads (a badge, “is X trusted under root R?”) are instant
			lookups, recomputed in the background when the graph changes.
		</p>
	</section>

	<!-- 5. Credit -->
	<section class="mb-6 rounded-2xl border border-border bg-card/40 p-6">
		<h2 class="font-display text-xl font-semibold tracking-tight">Prior art &amp; credit</h2>
		<p class="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">
			The attack-resistant trust metric at the heart of this project is not ours — it's
			<strong class="font-medium text-foreground">Raph Levien's</strong>. He designed it for
			<a
				href="https://en.wikipedia.org/wiki/Advogato"
				class="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
				rel="noopener">Advogato</a
			>, the early free-software community site, and developed the theory in
			<em class="not-italic text-foreground"
				>“Attack-Resistant Trust Metrics for Public Key Certification”</em
			> (Levien &amp; Aiken, USENIX Security, 1998) and his later work on attack-resistant trust
			metrics. The max-flow construction, node capacities that decrease with distance from the seed,
			and the certification levels are all his. The reference implementation lived in Advogato's
			<span class="font-mono text-sm text-foreground">mod_virgule</span>.
		</p>
		<p class="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">
			Our one substantive departure: Levien's seed was a single hard-wired global root. We make the
			seed set <em class="not-italic text-foreground">per minted root</em> — each root is its own
			vantage — that's the modernization, and the reason this can be a neutral calculator instead of a
			judge. Everything load-bearing under it is his idea, twenty-five years early.
		</p>
	</section>

	<p class="text-sm text-muted-foreground">
		<a
			href="/"
			class="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
			>← Back to the calculator</a
		>
	</p>
</article>
