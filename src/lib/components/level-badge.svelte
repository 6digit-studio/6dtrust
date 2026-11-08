<script lang="ts" module>
	export { LEVEL_NAMES } from '$lib/levels';
</script>

<script lang="ts">
	import { LEVEL_NAMES } from '$lib/levels';

	// A trust level rendered as a recessive pill. Colour is the single-hue
	// intensity ramp from app.css (--level-N): more trust = brighter + greener.
	// Pending is muted chrome on purpose — absence reads as neutral, not stigma.
	let { level, size = 'sm' }: { level: number; size?: 'sm' | 'md' } = $props();

	const dot: Record<number, string> = {
		0: 'bg-level-0',
		1: 'bg-level-1',
		2: 'bg-level-2',
		3: 'bg-level-3'
	};
	const text: Record<number, string> = {
		0: 'text-muted-foreground',
		1: 'text-level-1',
		2: 'text-level-2',
		3: 'text-level-3'
	};
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/50 font-micro font-medium uppercase tracking-[0.12em] {size ===
	'md'
		? 'px-2.5 py-1 text-[0.7rem]'
		: 'px-2 py-0.5 text-[0.62rem]'} {text[level]}"
>
	<span class="size-1.5 rounded-full {dot[level]}"></span>
	{LEVEL_NAMES[level] ?? `level ${level}`}
</span>
