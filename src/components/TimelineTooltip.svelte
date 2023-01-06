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
	<i class="text-primary fa-solid fa-circle-info" />
</button>

<style>
	@import 'tippy.js/dist/tippy.css';
</style>
