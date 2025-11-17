<script lang="ts">
	import { browser } from '$app/environment';
	import MerchantDrawerDesktop from './MerchantDrawerDesktop.svelte';
	import MerchantDrawerMobile from './MerchantDrawerMobile.svelte';
	import { onMount } from 'svelte';

	let isMobile = false;
	let desktopDrawer: MerchantDrawerDesktop;
	let mobileDrawer: MerchantDrawerMobile;

	onMount(() => {
		if (!browser) return;
		// Lock isMobile on initial mount to prevent component swapping mid-session
		isMobile = window.innerWidth < 768; // md breakpoint
	});

	export function openDrawer(id: number) {
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
