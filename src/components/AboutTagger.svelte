<script lang="ts">
	import tippy from 'tippy.js';

	export let tagger: { id: number; avatar: string; username: string };

	let taggerTooltip: HTMLAnchorElement;

	$: taggerTooltip &&
		tippy([taggerTooltip], {
			content: tagger.username
		});
</script>

<a bind:this={taggerTooltip} href="/tagger/{tagger.id}">
	<img
		src={tagger.avatar}
		alt="avatar"
		class="h-24 w-24 rounded-full bg-black object-cover"
		on:error={function () {
			this.src = '/images/satoshi-nakamoto.png';
		}}
	/>
</a>
