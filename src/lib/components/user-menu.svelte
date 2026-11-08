<script lang="ts">
	import type { SessionUser } from '$lib/types/user';

	let { user, github }: { user: SessionUser; github: string | null } = $props();

	let open = $state(false);
	let root = $state<HTMLElement>();

	const initial = $derived(github ? github[0].toUpperCase() : '·');

	function onWindowPointer(e: MouseEvent) {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}
</script>

<svelte:window onclick={onWindowPointer} onkeydown={onKey} />

<div class="relative" bind:this={root}>
	<button
		type="button"
		onclick={(e) => {
			e.stopPropagation();
			open = !open;
		}}
		aria-haspopup="menu"
		aria-expanded={open}
		class="flex items-center gap-2 rounded-lg border border-border bg-card/60 py-1 pr-2 pl-1 transition-colors hover:bg-accent"
	>
		<span
			class="grid size-6 place-items-center rounded-md bg-accent font-mono text-[0.7rem] font-semibold text-foreground"
			>{initial}</span
		>
		<span class="font-mono text-xs text-muted-foreground">{github ? `@${github}` : 'unbound'}</span>
		<svg
			viewBox="0 0 12 12"
			class="size-3 text-muted-foreground/70 transition-transform"
			style:transform={open ? 'rotate(180deg)' : ''}
			aria-hidden="true"
		>
			<path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.3" />
		</svg>
	</button>

	{#if open}
		<div
			role="menu"
			class="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-popover shadow-xl shadow-black/30"
		>
			<div class="border-b border-border/70 px-3 py-2.5">
				<p class="font-mono text-xs text-muted-foreground">identity {user.id.slice(0, 8)}…</p>
				<p class="mt-0.5 font-micro text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground/70">
					{user.status}
				</p>
			</div>
			<nav class="flex flex-col py-1 text-sm">
				<a
					href="/dashboard"
					role="menuitem"
					class="px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>Dashboard</a
				>
				<a
					href="/inbox"
					role="menuitem"
					class="px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>Inbox</a
				>
				<a
					href="/roots"
					role="menuitem"
					class="px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>Roots</a
				>
				<a
					href="/triage"
					role="menuitem"
					class="px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>Triage</a
				>
				{#if user.isAdmin}
					<a
						href="/admin"
						role="menuitem"
						class="px-3 py-1.5 text-level-3 transition-colors hover:bg-accent"
						>Admin</a
					>
				{/if}
			</nav>
			<form method="POST" action="/logout" class="border-t border-border/70">
				<button
					type="submit"
					role="menuitem"
					class="w-full px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>Log out</button
				>
			</form>
		</div>
	{/if}
</div>
