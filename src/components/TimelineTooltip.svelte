<script>
	export let tooltip;
	import tippy from 'tippy.js';

	let timelineTooltip;

	$: timelineTooltip &&
		tippy([timelineTooltip], {
			content: tooltip
		});
</script>

<button bind:this={timelineTooltip}>
	<i class="fa-solid fa-circle-info text-primary" />
</button>

<style>
	@import 'tippy.js/dist/tippy.css';
</style>
