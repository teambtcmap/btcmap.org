<script lang="ts">
	import { browser } from '$app/environment';
	import MerchantDrawerDesktop from './MerchantDrawerDesktop.svelte';
	import MerchantBottomSheet from './MerchantBottomSheet.svelte';
	import { onMount } from 'svelte';

	let isMobile = false;
	let desktopDrawer: MerchantDrawerDesktop;
	let mobileSheet: MerchantBottomSheet;

	function checkMobile() {
		if (!browser) return;
		isMobile = window.innerWidth < 768; // md breakpoint
	}

	onMount(() => {
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => {
			window.removeEventListener('resize', checkMobile);
		};
	});

	export function openDrawer(id: number) {
		if (isMobile && mobileSheet) {
			mobileSheet.openDrawer(id);
		} else if (desktopDrawer) {
			desktopDrawer.openDrawer(id);
		}
	}
</script>

{#if isMobile}
	<MerchantBottomSheet bind:this={mobileSheet} />
{:else}
	<MerchantDrawerDesktop bind:this={desktopDrawer} />
{/if}
