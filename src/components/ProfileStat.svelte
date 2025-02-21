<script lang="ts">
	import { run } from 'svelte/legacy';

	import tippy from 'tippy.js';

	interface Props {
		title: string;
		stat: number | undefined;
		percent?: string | undefined;
		border?: string | undefined;
		tooltip?: undefined | string;
	}

	let {
		title,
		stat,
		percent = undefined,
		border = undefined,
		tooltip = undefined
	}: Props = $props();

	let tooltipElement: HTMLButtonElement = $state();

	run(() => {
		tooltipElement &&
			tippy([tooltipElement], {
				content: tooltip,
				allowHTML: true
			});
	});
</script>

<div class="space-y-5 p-5 {border}">
	<h3 class="text-center text-lg font-semibold text-primary dark:text-white md:text-left">
		{title}
		{#if tooltip}
			<button bind:this={tooltipElement}>
				<i class="fa-solid fa-circle-info text-base"></i>
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
			<span class="h-[48px] w-[150px] animate-pulse rounded-xl bg-link/50"></span>
		{/if}
	</div>
</div>
