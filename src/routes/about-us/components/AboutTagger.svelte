<script lang="ts">
import tippy from "tippy.js";

import { _ } from "$lib/i18n";
import { resolve } from "$app/paths";

export let tagger: { id: number; avatar: string; username: string };

let taggerTooltip: HTMLAnchorElement;

$: taggerTooltip &&
	tippy([taggerTooltip], {
		content: tagger.username,
	});
</script>

<a bind:this={taggerTooltip} href={resolve(`/tagger/${tagger.id}`)}>
	<img
		src={tagger.avatar}
		alt={$_('aria.avatarAlt')}
		class="h-24 w-24 rounded-full bg-black object-cover"
		on:error={function () {
			this.src = '/images/satoshi-nakamoto.png';
		}}
	/>
</a>
