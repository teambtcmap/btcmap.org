<script lang="ts">
	import tippy from 'tippy.js';
	import Icon from '$components/Icon.svelte';

	export let title: string;
	export let stat: number | undefined;
	export let percent: string | undefined = undefined;
	export let border: string | undefined = undefined;
	export let tooltip: undefined | string = undefined;

	let tooltipElement: HTMLButtonElement;

	$: tooltipElement &&
		tippy([tooltipElement], {
			content: tooltip,
			allowHTML: true
		});
</script>

<div class="space-y-5 p-5 {border}">
	<h3 class="text-center text-lg font-semibold text-primary md:text-left dark:text-white">
		{title}
		{#if tooltip}
			<button bind:this={tooltipElement}>
				<Icon type="fa" icon="circle-info" w="16" h="16" class="text-base" />
			</button>
		{/if}
	</h3>

	<div class="flex justify-center md:justify-start">
		{#if stat !== undefined}
			<span class="text-5xl font-semibold text-primary dark:text-white">{stat}</span>
			{#if percent}
				<span class="ml-1 text-lg text-body dark:text-white">({percent}%)</span>
			{/if}
		{:else}
			<!-- loading skeleton -->
			<span class="h-[48px] w-[150px] animate-pulse rounded-xl bg-link/50" />
		{/if}
	</div>
</div>
