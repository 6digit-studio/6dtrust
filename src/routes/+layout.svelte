<script lang="ts">
	import '../app.css';
	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import favicon16 from '$lib/assets/favicon-16.png';
	import favicon32 from '$lib/assets/favicon-32.png';
	import logo from '$lib/assets/logo-64.png';
	import UserMenu from '$lib/components/user-menu.svelte';
	import SocialLinks from '$lib/components/social-links.svelte';
	import { SOCIAL_LINKS } from '$lib/social';

	let { children, data } = $props();

	injectAnalytics({ mode: dev ? 'development' : 'production' });
</script>

<svelte:head>
	<link rel="icon" href={favicon32} sizes="32x32" type="image/png" />
	<link rel="icon" href={favicon16} sizes="16x16" type="image/png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="shortcut icon" href="/favicon.ico" />
</svelte:head>

<div class="flex min-h-screen flex-col">
	<header class="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
		<nav class="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
			<a href="/" class="group flex items-center gap-2.5" aria-label="6dtrust home">
				<img
					src={logo}
					alt=""
					width="32"
					height="32"
					class="size-8 shrink-0 opacity-90 transition-opacity group-hover:opacity-100"
				/>
				<span class="font-display text-[0.95rem] font-semibold tracking-tight">
					<span class="text-muted-foreground/80">6d</span>
					<span class="text-foreground"> trust</span>
				</span>
			</a>

			<div class="flex items-center gap-1.5 text-sm">
				<a
					href="/docs"
					class="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
					>Docs</a
				>
				<a
					href="/writing"
					class="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
					>Writing</a
				>
				<a
					href="/about"
					class="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
					>About</a
				>
				<SocialLinks />
				{#if data.user}
					<!-- All per-user surfaces (Dashboard / Roots / Triage / identity /
					     log out) collapse into one account menu so the nav stays lean. -->
					<div class="ml-1">
						<UserMenu user={data.user} github={data.github} />
					</div>
				{:else}
					<a
						href="/login/github"
						class="ml-1 rounded-lg border border-border bg-card px-3.5 py-1.5 font-medium text-foreground transition-colors hover:bg-accent"
					>
						Sign in with GitHub
					</a>
				{/if}
			</div>
		</nav>
	</header>

	<main class="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
		{@render children()}
	</main>

	<footer class="border-t border-border/70">
		<div class="mx-auto w-full max-w-5xl px-5 py-10">
			<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
				<div class="flex flex-col gap-1 font-micro text-xs text-muted-foreground/70">
					<p class="uppercase tracking-[0.18em]">
						6dtrust · attack-resistant trust as a service
					</p>
					<p>
						A calculator, not a judge. Trust is computed relative to <em
							class="not-italic text-muted-foreground">your</em
						> chosen seeds — the service holds no global opinion.
					</p>
				</div>

				<nav class="flex flex-col gap-2 text-sm">
					<p class="font-micro text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
						Product
					</p>
					<a href="/" class="text-muted-foreground transition-colors hover:text-foreground"
						>Calculator</a
					>
					<a href="/about" class="text-muted-foreground transition-colors hover:text-foreground"
						>How it works</a
					>
				</nav>

				<nav class="flex flex-col gap-2 text-sm">
					<p class="font-micro text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
						Writing
					</p>
					<a href="/articles" class="text-muted-foreground transition-colors hover:text-foreground"
						>Articles</a
					>
					<a href="/blog" class="text-muted-foreground transition-colors hover:text-foreground"
						>Blog</a
					>
				</nav>

				<nav class="flex flex-col gap-2 text-sm">
					<p class="font-micro text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
						Community
					</p>
					<a
						href={SOCIAL_LINKS.x.href}
						rel="noopener noreferrer"
						class="text-muted-foreground transition-colors hover:text-foreground"
						>{SOCIAL_LINKS.x.label}</a
					>
					<a
						href={SOCIAL_LINKS.discord.href}
						rel="noopener noreferrer"
						class="text-muted-foreground transition-colors hover:text-foreground"
						>{SOCIAL_LINKS.discord.label}</a
					>
				</nav>
			</div>
		</div>
	</footer>
</div>
