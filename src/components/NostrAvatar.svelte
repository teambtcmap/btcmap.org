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

onMount(async () => {
	const profile = await fetchProfile(npub);
	picture = profile?.picture ?? null;
});

// Show the user's Nostr picture once we have a URL that hasn't errored;
// otherwise fall back to the same account icon UserMenu shows by default
// (covers loading, no-profile, and broken-image-URL cases).
$: showImage = picture !== null && !imgFailed;
</script>

{#if showImage}
	<!--
		The picture URL is user-controlled (it comes from the signer's kind:0
		profile on public relays), so referrerpolicy="no-referrer" keeps the
		current page URL from leaking to a hostile image host.
	-->
	<img
		src={picture}
		alt={$_("aria.avatarAlt")}
		width={size}
		height={size}
		referrerpolicy="no-referrer"
		loading="lazy"
		decoding="async"
		on:error={() => (imgFailed = true)}
		class="rounded-full object-cover {cls}"
	/>
{:else}
	<Icon
		type="material"
		icon="account_circle_filled"
		w={String(size)}
		h={String(size)}
		class={cls}
	/>
{/if}
