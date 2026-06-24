<script lang="ts">
import { onMount } from "svelte";

import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import { fetchProfile } from "$lib/nostrProfile";

export let npub: string;
export let size = 24;
let cls = "";

export { cls as class };

let picture: string | null = null;
let imgFailed = false;
let imgLoaded = false;

onMount(async () => {
	const profile = await fetchProfile(npub);
	picture = profile?.picture ?? null;
});

// Reveal the picture only once its bytes have actually loaded; until then
// (and for no-profile / broken-URL accounts) keep the same account icon
// UserMenu shows by default, so there's no blank/broken flash.
$: showImage = picture !== null && !imgFailed && imgLoaded;
</script>

{#if !showImage}
	<Icon
		type="material"
		icon="account_circle_filled"
		w={String(size)}
		h={String(size)}
		class={cls}
	/>
{/if}

{#if picture !== null && !imgFailed}
	<!--
		Rendered (but kept hidden until on:load) so the browser downloads it
		while the icon stands in. The picture URL is user-controlled (it comes
		from the signer's kind:0 profile on public relays), so
		referrerpolicy="no-referrer" keeps the current page URL from leaking to
		a hostile image host. No loading="lazy": a display:none lazy image can
		defer forever and never fire on:load.
	-->
	<img
		src={picture}
		alt={$_("aria.avatarAlt")}
		width={size}
		height={size}
		referrerpolicy="no-referrer"
		decoding="async"
		on:load={() => (imgLoaded = true)}
		on:error={() => (imgFailed = true)}
		class="rounded-full object-cover {cls}"
		class:hidden={!imgLoaded}
	/>
{/if}
