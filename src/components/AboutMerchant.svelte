<script lang="ts">
	import { run } from 'svelte/legacy';

	import { Icon } from '$lib/comp';
	import tippy from 'tippy.js';

	interface Props {
		id: string;
		icon: string;
		tooltip: string | undefined;
	}

	let { id, icon, tooltip }: Props = $props();

	let merchantTooltip: HTMLAnchorElement = $state();

	run(() => {
		merchantTooltip &&
			tooltip &&
			tooltip.length &&
			tippy([merchantTooltip], {
				content: tooltip
			});
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
