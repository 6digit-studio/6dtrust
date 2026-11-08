<script lang="ts">
	// The "why is my handle here?" explainer. Surfaced next to any Seeds label —
	// the exact spot a self-googler lands wondering why they're listed. Tone is
	// recognition-forward: being a seed is an invitation (claim the root), not a
	// privacy violation. Carries the non-endorsement note and a no-questions
	// take-down path. Manual modal (not native popover) so it stays SSR-safe and
	// reusable without a one-per-page id assumption.
	import { SOCIAL_LINKS } from '$lib/social';

	let { rootName }: { rootName: string } = $props();
	let open = $state(false);
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} />

<button
	type="button"
	onclick={() => (open = true)}
	class="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 font-micro text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
	aria-label="Why is my handle listed as a seed?"
>
	<svg viewBox="0 0 16 16" class="size-3" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
		<circle cx="8" cy="8" r="6.5" />
		<path d="M8 7.4v3.4" stroke-linecap="round" />
		<circle cx="8" cy="4.8" r="0.5" fill="currentColor" stroke="none" />
	</svg>
	Why am I here?
</button>

{#if open}
	<button
		type="button"
		aria-label="Close"
		onclick={() => (open = false)}
		class="fixed inset-0 z-40 cursor-default bg-black/55"
	></button>
	<div class="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Why is my handle here?"
			class="pointer-events-auto w-[min(28rem,100%)] rounded-2xl border border-border bg-card p-6 text-left shadow-2xl shadow-black/40"
		>
			<h3 class="font-display text-lg font-semibold tracking-tight">Why is my handle here?</h3>

			<div class="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
				<p>
					You've been picked as a <strong class="font-medium text-foreground">seed</strong> of
					{rootName} — one of a handful of people this trust root is anchored on. Trust flows
					outward from you: it's computed from the people you vouch for, starting here.
				</p>
				<p>
					That's an open invitation, not just a label.
					<a href="/login/github" class="font-medium text-foreground underline underline-offset-2"
						>Sign in with GitHub to claim this root</a
					> — the first seed to sign in becomes its owner.
				</p>
				<p>
					Being listed isn't an endorsement. These are public GitHub handles, chosen by us — it
					doesn't mean you support or are affiliated with 6dtrust.
				</p>
				<p>
					Don't want to be here?
					<a
						href={SOCIAL_LINKS.discord.href}
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium text-foreground underline underline-offset-2"
						>Message us on {SOCIAL_LINKS.discord.label}</a
					> and we'll take you off — no questions asked.
				</p>
			</div>

			<div class="mt-5 flex items-center justify-end gap-3">
				<button
					type="button"
					onclick={() => (open = false)}
					class="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
				>
					Close
				</button>
				<a
					href="/login/github"
					class="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
				>
					Claim this root
				</a>
			</div>
		</div>
	</div>
{/if}
