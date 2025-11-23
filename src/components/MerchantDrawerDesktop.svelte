<script lang="ts">
	import { boost, exchangeRate, resetBoost } from '$lib/store';
	import CloseButton from '$components/CloseButton.svelte';
	import Icon from '$components/Icon.svelte';
	import { fly } from 'svelte/transition';
	import BoostContent from './BoostContent.svelte';
	import MerchantDetailsContent from './MerchantDetailsContent.svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { merchantDrawer } from '$lib/merchantDrawerStore';
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
		ensureBoostData(merchant, $exchangeRate, $boost);
	}

	export function openDrawer(id: number) {
		merchantDrawer.open(id, 'details');
	}
</script>

{#if isOpen}
	<!-- Drawer - no backdrop, keep map interactive -->
	<div
		transition:fly={{ x: -400, duration: 300 }}
		class="fixed top-0 left-0 z-[1002] h-full w-full overflow-y-auto bg-white shadow-2xl md:w-[400px] dark:bg-dark"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-300 bg-white p-4 dark:border-white/95 dark:bg-dark"
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
				<span class="text-sm font-semibold text-primary dark:text-white">Merchant Details</span>
			{/if}
			<CloseButton on:click={closeDrawer} />
		</div>

		{#if !merchant && fetchingMerchant}
			<!-- Loading skeleton -->
			<div class="space-y-4 p-6">
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
			<div class="p-6">
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
