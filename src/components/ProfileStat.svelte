<script lang="ts">
import tippy from "tippy.js";

import Icon from "$components/Icon.svelte";
import Skeleton from "$components/Skeleton.svelte";

type Props = {
	title: string;
	stat: number | undefined;
	percent?: string;
	border?: string;
	tooltip?: string;
};

let { title, stat, percent, border, tooltip }: Props = $props();

let tooltipElement = $state<HTMLButtonElement>();

$effect(() => {
	if (!tooltipElement) return;
	const instance = tippy(tooltipElement, {
		content: tooltip,
		allowHTML: true,
	});
	return () => instance.destroy();
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
			<Skeleton as="span" class="h-[48px] w-[150px] rounded-xl" />
		{/if}
	</div>
</div>
