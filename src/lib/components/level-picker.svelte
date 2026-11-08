<script lang="ts">
	import { GRANTABLE } from '$lib/levels';

	// Three submit buttons that ARE the trust-level intensity ramp (app.css
	// --level-N): pressing one both picks the level and posts the surrounding
	// form, so "choose level" and "commit" collapse into a single act. The glow
	// scales with the level — the button you press previews the badge you mint.
	//
	// Two modes, one component:
	//   • current === null  → adding: all three lit, equal-weight choices.
	//   • current === N      → reviewing an existing vouch: level N lit, the
	//     other two dim ghosts you can click to raise or lower it.
	let { current = null, size = 'md' }: { current?: number | null; size?: 'sm' | 'md' } =
		$props();

	// Filled "lit" look. Glow alpha/radius climbs with the level so the control
	// reads as the same brightness ramp as the badges.
	const lit: Record<number, string> = {
		1: 'bg-level-1 text-background shadow-[0_0_8px_rgba(95,137,122,0.3)]',
		2: 'bg-level-2 text-background shadow-[0_0_12px_rgba(70,175,146,0.42)]',
		3: 'bg-level-3 text-background shadow-[0_0_18px_rgba(56,211,156,0.55)]'
	};
	// Dim outline — an available-but-not-current level. Hover pulls it toward lit.
	const dim: Record<number, string> = {
		1: 'border border-level-1/40 text-level-1/70 hover:border-level-1 hover:text-level-1',
		2: 'border border-level-2/40 text-level-2/70 hover:border-level-2 hover:text-level-2',
		3: 'border border-level-3/40 text-level-3/70 hover:border-level-3 hover:text-level-3'
	};
</script>

<div class="flex items-center {size === 'sm' ? 'gap-1' : 'gap-2'}">
	{#each GRANTABLE as l (l.level)}
		{@const active = current === null || current === l.level}
		<button
			type="submit"
			name="level"
			value={l.level}
			title={l.grant ?? ''}
			disabled={current === l.level}
			class="rounded-lg font-micro font-medium uppercase tracking-[0.12em] transition-all disabled:cursor-default {size ===
			'sm'
				? 'px-2 py-1 text-[0.62rem]'
				: 'px-3.5 py-2 text-xs'} {active ? lit[l.level] : dim[l.level]}"
		>
			{l.name}
		</button>
	{/each}
</div>
