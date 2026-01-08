<script lang="ts">
	import { boost, resetBoost } from '$lib/store';
	import CloseButton from '$components/CloseButton.svelte';
	import Icon from '$components/Icon.svelte';
	import { fly } from 'svelte/transition';
	import BoostContent from '$components/BoostContent.svelte';
	import MerchantDetailsContent from '$components/MerchantDetailsContent.svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { merchantDrawer } from '$lib/merchantDrawerStore';
	import { merchantList } from '$lib/merchantListStore';
	import {
		MERCHANT_LIST_WIDTH,
		MERCHANT_DRAWER_WIDTH,
		MAP_PANEL_MARGIN,
		PANEL_DRAWER_GAP
	} from '$lib/constants';
	import {
		calcVerifiedDate,
		isUpToDate as checkUpToDate,
		isBoosted as checkBoosted,
		handleBoost as boostMerchant,
		handleBoostComplete as completeBoost,
		ensureBoostData,
		clearBoostState
	} from '$lib/merchantDrawerLogic';

	// Derive state from centralized store
	$: isOpen = $merchantDrawer.isOpen;
	$: merchantId = $merchantDrawer.merchantId;
	$: drawerView = $merchantDrawer.drawerView;
	$: merchant = $merchantDrawer.merchant;
	$: fetchingMerchant = $merchantDrawer.isLoading;
	$: listIsOpen = $merchantList.isOpen;

	// Calculate drawer position based on list panel state
	$: drawerLeft = listIsOpen
		? MAP_PANEL_MARGIN + MERCHANT_LIST_WIDTH + PANEL_DRAWER_GAP
		: MAP_PANEL_MARGIN;

	const verifiedDate = calcVerifiedDate();
	$: isUpToDate = checkUpToDate(merchant, verifiedDate);
	$: isBoosted = checkBoosted(merchant);

	let boostLoading = false;
	const setBoostLoading = (loading: boolean) => {
		boostLoading = loading;
	};

	const closeDrawer = () => {
		clearBoostState();
		boostLoading = false;
		merchantDrawer.close();
	};

	const goBack = () => {
		clearBoostState();
		boostLoading = false;
		merchantDrawer.setView('details');
	};

	$: if (drawerView !== 'boost' && $boost !== undefined) {
		clearBoostState();
		boostLoading = false;
	}

	const handleBoost = () => boostMerchant(merchant, merchantId, setBoostLoading);
	const handleBoostComplete = () => completeBoost(merchantId, invalidateAll, resetBoost);

	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			if (drawerView !== 'details') {
				goBack();
			} else {
				closeDrawer();
			}
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	$: if (drawerView === 'boost' && merchant) {
		ensureBoostData(merchant, $boost);
	}

	export function openDrawer(id: number) {
		merchantDrawer.open(id, 'details');
	}
</script>

{#if isOpen}
	<!-- Floating drawer card - no backdrop, keep map interactive -->
	<!-- Position offset by MERCHANT_LIST_WIDTH when list panel is open -->
	<div
		in:fly={{ x: -MERCHANT_DRAWER_WIDTH, duration: 300 }}
		class="absolute top-3 z-[1002] max-h-[calc(100%-1.5rem)] w-full overflow-y-auto rounded-lg bg-white shadow-lg transition-[left] duration-200 dark:bg-dark"
		style="left: {drawerLeft}px; max-width: {MERCHANT_DRAWER_WIDTH}px"
		role="dialog"
		aria-label="Merchant details"
	>
		<div
			class="sticky top-0 z-10 flex items-center justify-between rounded-t-lg bg-white p-2 dark:bg-dark {drawerView !==
			'details'
				? 'border-b border-gray-300 dark:border-white/95'
				: ''}"
		>
			{#if drawerView !== 'details'}
				<!-- Back button for nested views -->
				<button
					on:click={goBack}
					class="flex items-center space-x-2 text-primary transition-colors hover:text-link dark:text-white dark:hover:text-link"
				>
					<Icon w="20" h="20" icon="arrow_back" type="material" />
					<span class="text-sm font-semibold">Back</span>
				</button>
				<span class="text-sm font-semibold text-primary capitalize dark:text-white"
					>{drawerView}</span
				>
			{:else}
				<!-- Spacer to keep close button aligned -->
				<div></div>
			{/if}
			<CloseButton on:click={closeDrawer} ariaLabel="Close merchant details" />
		</div>

		{#if !merchant && fetchingMerchant}
			<!-- Loading skeleton -->
			<div class="space-y-4 px-6 pt-3 pb-6">
				<!-- Title skeleton -->
				<div class="h-7 w-3/4 animate-pulse rounded-lg bg-link/50"></div>
				<!-- Address skeleton -->
				<div class="h-5 w-1/2 animate-pulse rounded bg-link/50"></div>
				<!-- Payment methods skeleton -->
				<div class="flex space-x-2">
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
					<div class="h-8 w-16 animate-pulse rounded bg-link/50"></div>
				</div>
				<!-- Stats grid skeleton -->
				<div class="grid grid-cols-2 gap-2">
					<div class="h-20 animate-pulse rounded-lg bg-link/50"></div>
					<div class="h-20 animate-pulse rounded-lg bg-link/50"></div>
				</div>
				<!-- Large content skeleton -->
				<div class="h-32 animate-pulse rounded-lg bg-link/50"></div>
			</div>
		{:else if merchant}
			<div class="px-6 pt-3 pb-6">
				{#if drawerView === 'boost'}
					<BoostContent merchantId={merchant.id} onComplete={handleBoostComplete} />
				{:else}
					<MerchantDetailsContent
						{merchant}
						{isUpToDate}
						{isBoosted}
						{boostLoading}
						onBoostClick={handleBoost}
						isLoading={fetchingMerchant}
					/>
				{/if}
			</div>
		{/if}
	</div>
{/if}
