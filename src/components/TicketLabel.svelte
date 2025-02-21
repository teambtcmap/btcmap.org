<script lang="ts">
	import { run } from 'svelte/legacy';

	import tippy from 'tippy.js';
	interface Props {
		title: string;
		tooltip: string | undefined;
	}

	let { title, tooltip }: Props = $props();

	let labelTooltip: HTMLSpanElement = $state();

	run(() => {
		tooltip &&
			tooltip.length &&
			labelTooltip &&
			tippy([labelTooltip], {
				content: tooltip
			});
	});
</script>

<span
	bind:this={labelTooltip}
	class="mb-1 mr-1 inline-block rounded-full border border-link bg-link/25 p-1 text-xs text-primary dark:text-white"
	>{title}</span
>
