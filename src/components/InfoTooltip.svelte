<script lang="ts">
export let tooltip: string;

import tippy from "tippy.js";

import Icon from "$components/Icon.svelte";

let infoTooltip: HTMLButtonElement;

$: infoTooltip &&
	tippy([infoTooltip], {
		content: tooltip,
		trigger: "click",
	});
</script>

<button type="button" aria-label="More Information" bind:this={infoTooltip}>
	<Icon
		type="fa"
		icon="circle-info"
		w="16"
		h="16"
		class="inline align-middle text-base text-primary dark:text-white"
	/>
</button>
