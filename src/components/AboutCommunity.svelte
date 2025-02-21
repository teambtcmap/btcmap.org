<script lang="ts">
	import { run } from 'svelte/legacy';

	import type { Area } from '$lib/types';
	import tippy from 'tippy.js';

	interface Props {
		community: Area;
	}

	let { community }: Props = $props();

	let communityTooltip: HTMLAnchorElement = $state();

	run(() => {
		communityTooltip &&
			tippy([communityTooltip], {
				content: community.tags.name
			});
	});
</script>

<a bind:this={communityTooltip} href="/community/{community.id}">
	<img
		src={`https://btcmap.org/.netlify/images?url=${community.tags['icon:square']}&fit=cover&w=256&h=256`}
		alt="avatar"
		class="h-24 w-24 rounded-full object-cover"
		onerror={function () {
			this.src = '/images/bitcoin.svg';
		}}
	/>
</a>
