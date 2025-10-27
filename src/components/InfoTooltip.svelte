<script lang="ts">
	export let tooltip: string;
	import tippy from 'tippy.js';
	import { Icon } from '$lib/comp';

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
		w="18"
		h="18"
		style="text-base text-primary inline align-middle dark:text-white"
	/>
</button>
