<script lang="ts">
	import type { BadgeType } from '$lib/types';

	export let icon: string;
	export let title: string;
	export let desc: string;
	export let type: BadgeType;
</script>

<div
	id={icon}
	class="relative space-y-4 rounded-3xl bg-white p-5 text-center drop-shadow-xl transition-all hover:drop-shadow-2xl md:p-10 dark:bg-white/[0.15]"
>
	{#if type === 'contribution'}
		<div
			class="absolute top-5 -right-2 w-20 rounded-full bg-white py-2 font-semibold text-link shadow-lg dark:bg-white/[0.15]"
		>
			+{desc}
		</div>
	{/if}

	<img src="/icons/badges/{icon}.svg" alt={title} class="mx-auto h-28 w-28" />

	<p class="text-xl font-semibold text-primary dark:text-white">{title}</p>

	{#if type === 'achievement'}
		<p class="text-body dark:text-white">{desc}</p>
	{/if}
</div>
