<script lang="ts">
	import tippy from 'tippy.js';

	export let tagger;

	let taggerTooltip;

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
		onerror="this.src='/images/satoshi-nakamoto.png'"
	/>
</a>

<style>
	@import 'tippy.js/dist/tippy.css';
</style>
