<script lang="ts">
	import { Icon } from '$lib/comp';
	import tippy from 'tippy.js';

	export let id: string;
	export let icon: string;
	export let tooltip: string | undefined;

	let merchantTooltip: HTMLAnchorElement;

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
