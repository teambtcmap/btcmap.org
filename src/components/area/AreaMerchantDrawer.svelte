<script lang="ts">
import { fly } from "svelte/transition";

import CloseButton from "$components/CloseButton.svelte";
import MerchantDetailsContent from "$components/MerchantDetailsContent.svelte";
import {
	handleBoost as boostMerchant,
	calcVerifiedDate,
	isBoosted as checkBoosted,
	isUpToDate as checkUpToDate,
	clearBoostState,
	fetchMerchantDetails,
} from "$lib/merchantDrawerLogic";
import { boost } from "$lib/store";
import type { Place } from "$lib/types";

export let merchantId: number | null = null;
export let onClose: () => void;

let merchant: Place | null = null;
let isLoading = false;
let lastFetchedId: number | null = null;
let abortController: AbortController | null = null;

const verifiedDate = calcVerifiedDate();
$: isUpToDate = checkUpToDate(merchant, verifiedDate);
$: isBoosted = checkBoosted(merchant);

let boostLoading = false;
const setBoostLoading = (loading: boolean) => {
	boostLoading = loading;
};

// Fetch merchant data when merchantId changes
$: if (merchantId && merchantId !== lastFetchedId) {
	// Cancel any pending request
	if (abortController) {
		abortController.abort();
	}
	abortController = new AbortController();

	fetchMerchantDetails(
		merchantId,
		merchantId,
		(m) => (merchant = m),
		(f) => (isLoading = f),
		(id) => (lastFetchedId = id),
		abortController.signal,
	);
}

const closeDrawer = () => {
	clearBoostState();
	boostLoading = false;
	merchant = null;
	lastFetchedId = null;
	if (abortController) {
		abortController.abort();
		abortController = null;
	}
	onClose();
};

const handleBoost = () => boostMerchant(merchant, merchantId, setBoostLoading);

$: if ($boost !== undefined && merchant) {
	// Boost state changed - refresh merchant data
	if (merchantId) {
		fetchMerchantDetails(
			merchantId,
			merchantId,
			(m) => (merchant = m),
			(f) => (isLoading = f),
			(id) => (lastFetchedId = id),
		);
	}
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") {
		event.preventDefault();
		closeDrawer();
	}
}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if merchantId}
	<div
		transition:fly={{ x: -300, duration: 200 }}
		class="absolute top-0 left-0 z-[1001] flex h-full w-full flex-col bg-white shadow-xl md:w-[280px] dark:bg-dark"
		role="dialog"
		aria-modal="true"
	>
		<div class="flex shrink-0 items-center justify-end bg-white p-2 dark:bg-dark">
			<CloseButton on:click={closeDrawer} />
		</div>

		<div class="min-h-0 flex-1 overflow-x-visible overflow-y-auto">
			{#if !merchant && isLoading}
				<!-- Loading skeleton -->
				<div class="space-y-4 px-5 pb-4">
					<div class="h-6 w-3/4 animate-pulse rounded-lg bg-link/50"></div>
					<div class="h-4 w-1/2 animate-pulse rounded bg-link/50"></div>
					<div class="flex space-x-2">
						<div class="h-8 w-14 animate-pulse rounded bg-link/50"></div>
						<div class="h-8 w-14 animate-pulse rounded bg-link/50"></div>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="h-16 animate-pulse rounded-lg bg-link/50"></div>
						<div class="h-16 animate-pulse rounded-lg bg-link/50"></div>
					</div>
				</div>
			{:else if merchant}
				<div class="px-5 pb-4">
					<MerchantDetailsContent
						{merchant}
						{isUpToDate}
						{isBoosted}
						{boostLoading}
						onBoostClick={handleBoost}
						{isLoading}
					/>
				</div>
			{/if}
		</div>
	</div>
{/if}
