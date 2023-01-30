<script>
	import tippy from 'tippy.js';

	export let title;
	export let stat;
	export let percent;
	export let border;
	export let tooltip = undefined;

	let tooltipElement;

	$: tooltipElement &&
		tippy([tooltipElement], {
			content: tooltip,
			allowHTML: true
		});
</script>

<div class="space-y-5 p-5 {border}">
	<h3 class="text-center text-lg font-semibold text-primary md:text-left">
		{title}
		{#if tooltip}
			<button bind:this={tooltipElement}>
				<i class="fa-solid fa-circle-info text-base" />
			</button>
		{/if}
	</h3>

	<div class="flex justify-center md:justify-start">
		{#if stat >= 0}
			<span class="text-5xl font-semibold text-primary">{stat}</span>
			{#if percent}
				<span class="ml-1 text-lg text-body">({percent}%)</span>
			{/if}
		{:else}
			<!-- loading skeleton -->
			<span class="h-[48px] w-[150px] animate-pulse rounded-xl bg-link/50" />
		{/if}
	</div>
</div>

<style>
	@import 'tippy.js/dist/tippy.css';
</style>
