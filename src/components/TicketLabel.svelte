<script>
	export let title;
	export let tooltip;
	import tippy from 'tippy.js';

	let labelTooltip;

	$: tooltip &&
		tooltip.length &&
		labelTooltip &&
		tippy([labelTooltip], {
			content: tooltip
		});
</script>

<span
	bind:this={labelTooltip}
	class="inline-block text-xs rounded-full p-1 mr-1 mb-1 border border-link bg-link/25 text-primary"
	>{title}</span
>

<style>
	@import 'tippy.js/dist/tippy.css';
</style>
