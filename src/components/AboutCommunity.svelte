<script lang="ts">
	import type { Area } from '$lib/types';
	import tippy from 'tippy.js';

	export let community: Area;

	let communityTooltip: HTMLAnchorElement;

	$: communityTooltip &&
		tippy([communityTooltip], {
			content: community.tags.name
		});
</script>

<a bind:this={communityTooltip} href="/community/{community.id}">
	<img
		src={community.tags['icon:square']}
		alt="avatar"
		class="h-24 w-24 rounded-full object-cover"
		on:error={function () {
			this.src = '/images/communities/bitcoin.svg';
		}}
	/>
</a>
