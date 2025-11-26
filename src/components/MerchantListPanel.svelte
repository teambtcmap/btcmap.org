<script lang="ts">
	import { merchantList } from '$lib/merchantListStore';
	import { merchantDrawer } from '$lib/merchantDrawerStore';
	import MerchantListItem from '$components/MerchantListItem.svelte';
	import CloseButton from '$components/CloseButton.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
	import type { Place } from '$lib/types';
	import { onMount } from 'svelte';

	$: isOpen = $merchantList.isOpen;
	$: merchants = $merchantList.merchants;
	$: enrichedPlaces = $merchantList.enrichedPlaces;
	$: isLoading = $merchantList.isLoading;
	$: selectedId = $merchantDrawer.merchantId;

	// Trigger fetch when merchants change
	$: if (isOpen && merchants.length > 0) {
		const placeIds = merchants.map((m) => m.id);
		merchantList.fetchDetails(placeIds);
	}

	function handleItemClick(event: CustomEvent<Place>) {
		merchantDrawer.open(event.detail.id, 'details');
	}

	function handleClose() {
		merchantList.close();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			handleClose();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

{#if isOpen}
	<section
		class="hidden w-[320px] flex-none flex-col overflow-hidden border-r border-white/10 bg-white md:flex dark:border-white/5 dark:bg-dark"
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
