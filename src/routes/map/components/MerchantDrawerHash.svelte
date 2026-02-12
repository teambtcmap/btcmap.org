<script lang="ts">
import { BREAKPOINTS } from "$lib/constants";

import MerchantDrawerDesktop from "./MerchantDrawerDesktop.svelte";
import MerchantDrawerMobile from "./MerchantDrawerMobile.svelte";
import { browser } from "$app/environment";

// Initialize immediately to prevent component flash on mount
// Lock to initial viewport to prevent component swapping mid-session
let isMobile = browser ? window.innerWidth < BREAKPOINTS.md : false;
let desktopDrawer: MerchantDrawerDesktop;
let mobileDrawer: MerchantDrawerMobile;

export function openDrawer(id: number) {
	// Guard against calling before component refs are ready
	if (!mobileDrawer && !desktopDrawer) {
		console.warn("Drawer not ready yet");
		return;
	}

	if (isMobile && mobileDrawer) {
		mobileDrawer.openDrawer(id);
	} else if (desktopDrawer) {
		desktopDrawer.openDrawer(id);
	}
}
</script>

{#if isMobile}
	<MerchantDrawerMobile bind:this={mobileDrawer} />
{:else}
	<MerchantDrawerDesktop bind:this={desktopDrawer} />
{/if}
