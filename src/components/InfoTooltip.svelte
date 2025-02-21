<script lang="ts">
	import { run } from 'svelte/legacy';

	import tippy from 'tippy.js';
	interface Props {
		tooltip: string;
	}

	let { tooltip }: Props = $props();

	let infoTooltip: HTMLButtonElement = $state();

	run(() => {
		infoTooltip &&
			tippy([infoTooltip], {
				content: tooltip
			});
	});
</script>

<button bind:this={infoTooltip}>
	<i class="fa-solid fa-circle-info text-base text-primary dark:text-white"></i>
</button>
