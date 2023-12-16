<script lang="ts">
	export let tooltip: string;
	import tippy from 'tippy.js';

	let infoTooltip: HTMLButtonElement;

	$: infoTooltip &&
		tippy([infoTooltip], {
			content: tooltip
		});
</script>

<button bind:this={infoTooltip}>
	<i class="fa-solid fa-circle-info text-base text-primary dark:text-white" />
</button>
