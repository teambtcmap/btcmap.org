<script lang="ts">
	import { browser } from '$app/environment';
	import MerchantDrawerDesktop from './MerchantDrawerDesktop.svelte';
	import MerchantDrawerMobile from './MerchantDrawerMobile.svelte';
	import MerchantListPanel from './MerchantListPanel.svelte';
	import { BREAKPOINTS } from '$lib/constants';

	// Initialize immediately to prevent component flash on mount
	// Lock to initial viewport to prevent component swapping mid-session
	let isMobile = browser ? window.innerWidth < BREAKPOINTS.md : false;
	let desktopDrawer: MerchantDrawerDesktop;
	let mobileDrawer: MerchantDrawerMobile;

	export function openDrawer(id: number) {
		// Guard against calling before component refs are ready
		if (!mobileDrawer && !desktopDrawer) {
			console.warn('Drawer not ready yet');
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
	<!-- Desktop: List panel + Detail drawer side by side -->
	<MerchantListPanel />
	<MerchantDrawerDesktop bind:this={desktopDrawer} />
{/if}
