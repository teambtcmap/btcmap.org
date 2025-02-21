<script lang="ts">
	import { run } from 'svelte/legacy';

	import tippy from 'tippy.js';

	interface Props {
		tagger: { id: number; avatar: string; username: string };
	}

	let { tagger }: Props = $props();

	let taggerTooltip: HTMLAnchorElement = $state();

	run(() => {
		taggerTooltip &&
			tippy([taggerTooltip], {
				content: tagger.username
			});
	});
</script>

<a bind:this={taggerTooltip} href="/tagger/{tagger.id}">
	<img
		src={tagger.avatar}
		alt="avatar"
		class="h-24 w-24 rounded-full bg-black object-cover"
		onerror={function () {
			this.src = '/images/satoshi-nakamoto.png';
		}}
	/>
</a>
