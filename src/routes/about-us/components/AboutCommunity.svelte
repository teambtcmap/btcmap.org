<script lang="ts">
import tippy from "tippy.js";

import type { Area } from "$lib/types";

import { resolve } from "$app/paths";

export let community: Area;

let communityTooltip: HTMLAnchorElement;

$: communityTooltip &&
	tippy([communityTooltip], {
		content: community.tags.name,
	});
</script>

<a bind:this={communityTooltip} href={resolve(`/community/${community.id}`)}>
	<img
		src={`https://btcmap.org/.netlify/images?url=${community.tags['icon:square']}&fit=cover&w=256&h=256`}
		alt="avatar"
		class="h-24 w-24 rounded-full object-cover"
		on:error={function () {
			this.src = '/images/bitcoin.svg';
		}}
	/>
</a>
