<script lang="ts">
import tippy from "tippy.js";

import { _ } from "$lib/i18n";
import type { Area } from "$lib/types";
import { areaIconSrc } from "$lib/utils";

import { resolve } from "$app/paths";

export let community: Area;

let communityTooltip: HTMLAnchorElement;

$: communityTooltip &&
	tippy([communityTooltip], {
		content: community.tags.name,
	});
</script>

<a bind:this={communityTooltip} href={resolve(`/community/${encodeURIComponent(community.id)}`)}>
	<img
		src={areaIconSrc(community.tags['icon:square'])}
		alt={$_('aria.avatarAlt')}
		class="h-24 w-24 rounded-full object-cover"
		on:error={function () {
			this.src = '/images/bitcoin.svg';
		}}
	/>
</a>
