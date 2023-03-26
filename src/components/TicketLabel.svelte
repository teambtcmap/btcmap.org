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
	class="mr-1 mb-1 inline-block rounded-full border border-link bg-link/25 p-1 text-xs text-primary dark:text-white"
	>{title}</span
>

<style>
	@import 'tippy.js/dist/tippy.css';
</style>
