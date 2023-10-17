<script>
	export let title;
	export let icon;

	import tippy from 'tippy.js';

	let labelTooltip;

	$: labelTooltip &&
		tippy([labelTooltip], {
			content: title
		});
</script>

<img
        bind:this={labelTooltip}
        src={icon}
        alt={title}
        class="h-8 w-8"
/>

<style>
	@import 'tippy.js/dist/tippy.css';
</style>
