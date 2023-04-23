<script>
	import { Icon } from '$comp';
	import tippy from 'tippy.js';

	export let id;
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
	href="/merchant/{id}"
	class="flex h-24 w-24 items-center justify-center rounded-full bg-bitcoin hover:animate-wiggle"
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
