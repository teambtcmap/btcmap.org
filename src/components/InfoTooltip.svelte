<script lang="ts">
	export let tooltip: string;
	import tippy from 'tippy.js';
	import Icon from '$lib/components/Icon.svelte';

	let infoTooltip: HTMLButtonElement;

	$: infoTooltip &&
		tippy([infoTooltip], {
			content: tooltip
		});
</script>

<button bind:this={infoTooltip}>
	<Icon
		type="fa"
		icon="circle-info"
		w="16"
		h="16"
		style="text-base text-primary inline align-middle dark:text-white"
	/>
</button>
