<script lang="ts">
	import tippy from 'tippy.js';

	export let community;

	let communityTooltip;

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
		onerror="this.src='/images/communities/bitcoin.svg'"
	/>
</a>

<style>
	@import 'tippy.js/dist/tippy.css';
</style>
