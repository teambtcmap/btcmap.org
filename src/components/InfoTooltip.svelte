<script>
	export let tooltip;
	import tippy from 'tippy.js';

	let infoTooltip;

	$: infoTooltip &&
		tippy([infoTooltip], {
			content: tooltip
		});
</script>

<button bind:this={infoTooltip}>
	<i class="fa-solid fa-circle-info text-base text-primary dark:text-white" />
</button>

<style>
	@import 'tippy.js/dist/tippy.css';
</style>
