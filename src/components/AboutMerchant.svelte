<script>
	import { Icon } from '$comp';
	import tippy from 'tippy.js';

	export let lat;
	export let long;
	export let icon;
	export let tooltip;

	let merchantTooltip;

	$: merchantTooltip &&
		tooltip &&
		tooltip.length &&
		tippy([merchantTooltip], {
			content: tooltip
		});
</script>

<a
	bind:this={merchantTooltip}
	href="/map?lat={lat}&long={long}"
	class="bg-bitcoin rounded-full h-24 w-24 flex justify-center items-center hover:animate-wiggle"
>
	<Icon
		w="40"
		h="40"
		style="text-white"
		icon={icon !== 'question_mark' ? icon : 'currency_bitcoin'}
		type="material"
	/>
</a>

<style>
	@import 'tippy.js/dist/tippy.css';
</style>
