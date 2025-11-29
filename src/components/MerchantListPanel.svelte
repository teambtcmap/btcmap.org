<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import { merchantList } from '$lib/merchantListStore';
	import { merchantDrawer } from '$lib/merchantDrawerStore';
	import MerchantListItem from '$components/MerchantListItem.svelte';
	import CloseButton from '$components/CloseButton.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import type { Place } from '$lib/types';
	import { MERCHANT_LIST_WIDTH } from '$lib/constants';

	// Callback to pan map when a merchant is clicked from the list
	export let onPanToPlace: ((place: Place) => void) | undefined = undefined;
	// Map center and radius for fetching enriched data via search API
	export let mapCenter: { lat: number; lon: number } | undefined = undefined;
	export let mapRadiusKm: number | undefined = undefined;

	$: isOpen = $merchantList.isOpen;
	$: merchants = $merchantList.merchants;
	$: enrichedPlaces = $merchantList.enrichedPlaces;
	$: isLoading = $merchantList.isLoading;
	$: selectedId = $merchantDrawer.merchantId;

	// Fetch enriched data using search API when panel opens
	$: if (isOpen && mapCenter && mapRadiusKm) {
		merchantList.fetchByRadius(mapCenter, mapRadiusKm);
	}

	function handleItemClick(event: CustomEvent<Place>) {
		const place = event.detail;
		merchantDrawer.open(place.id, 'details');
		// Pan to merchant only when clicked from list (not from map markers)
		onPanToPlace?.(place);
	}

	function handleClose() {
		merchantList.close();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			handleClose();
		}
	}

	// Scope keydown listener to when panel is open
	$: if (browser) {
		if (isOpen) {
			window.addEventListener('keydown', handleKeydown);
		} else {
			window.removeEventListener('keydown', handleKeydown);
		}
	}

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('keydown', handleKeydown);
		}
	});
</script>

{#if isOpen}
	<section
		class="hidden flex-none flex-col overflow-hidden border-r border-white/10 bg-white md:flex dark:border-white/5 dark:bg-dark"
		style="width: {MERCHANT_LIST_WIDTH}px"
		role="complementary"
		aria-label="Merchant list"
	>
		<!-- Header -->
		<div
			class="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-dark"
		>
			<div>
				<h2 class="text-sm font-semibold text-primary dark:text-white">Nearby Merchants</h2>
				<p class="text-xs text-body dark:text-white/70">
					{merchants.length} location{merchants.length !== 1 ? 's' : ''} in view
				</p>
			</div>
			<CloseButton on:click={handleClose} />
		</div>

		<!-- List content -->
		<div class="flex-1 overflow-y-auto">
			{#if isLoading}
				<div class="flex items-center justify-center py-8">
					<LoadingSpinner color="text-link dark:text-white" size="h-6 w-6" />
				</div>
			{:else if merchants.length === 0}
				<div class="px-3 py-8 text-center text-sm text-body dark:text-white/70">
					No merchants visible in current view
				</div>
			{:else}
				<ul class="divide-y divide-gray-100 dark:divide-white/5">
					{#each merchants as merchant (merchant.id)}
						<MerchantListItem
							{merchant}
							enrichedData={enrichedPlaces.get(merchant.id) || null}
							isSelected={selectedId === merchant.id}
							on:click={handleItemClick}
						/>
					{/each}
				</ul>
			{/if}
		</div>
	</section>
{/if}
