<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '$components/Icon.svelte';
	import PaymentMethodIcon from '$components/PaymentMethodIcon.svelte';
	import type { Place } from '$lib/types';
	import { formatVerifiedHuman } from '$lib/utils';
	import {
		calcVerifiedDate,
		isUpToDate as checkUpToDate,
		isBoosted as checkBoosted
	} from '$lib/merchantDrawerLogic';

	export let merchant: Place;
	export let enrichedData: Place | null = null;
	export let isSelected: boolean = false;

	const dispatch = createEventDispatcher<{ click: Place; mouseenter: Place; mouseleave: Place }>();

	const verifiedDate = calcVerifiedDate();

	// Show skeleton when we don't have enriched data yet
	// Only show "Unknown" when enriched data exists but has no name
	$: showSkeleton = !enrichedData;
	$: displayData = enrichedData || merchant;
	$: hasPaymentMethods =
		enrichedData?.['osm:payment:onchain'] !== undefined ||
		enrichedData?.['osm:payment:lightning'] !== undefined ||
		enrichedData?.['osm:payment:lightning_contactless'] !== undefined;

	$: isVerified = checkUpToDate(displayData, verifiedDate);
	$: isBoosted = checkBoosted(merchant);

	function handleClick() {
		dispatch('click', merchant);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick();
		}
	}
</script>

<li class="list-none">
	<button
		on:click={handleClick}
		on:keydown={handleKeydown}
		on:mouseenter={() => dispatch('mouseenter', merchant)}
		on:mouseleave={() => dispatch('mouseleave', merchant)}
		class="w-full px-3 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5 {isSelected
			? 'bg-link/5 dark:bg-link/10'
			: ''}"
		aria-pressed={isSelected}
	>
		<div class="flex items-start gap-3">
			<!-- Icon -->
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {isBoosted
					? 'bg-bitcoin/10 text-bitcoin'
					: 'bg-primary/10 text-primary dark:bg-white/10 dark:text-white'}"
			>
				<Icon w="22" h="22" icon={merchant.icon || 'currency_bitcoin'} type="material" />
			</div>

			<div class="min-w-0 flex-1">
				<!-- Name with badges -->
				<div class="flex items-center gap-1">
					{#if enrichedData?.name}
						<span
							class="truncate text-sm font-medium {isBoosted
								? 'text-bitcoin'
								: 'text-primary dark:text-white'}"
						>
							{enrichedData.name}
						</span>
						{#if isVerified}
							<Icon w="12" h="12" icon="verified" type="popup" style="shrink-0 text-link" />
						{/if}
						{#if isBoosted}
							<Icon w="12" h="12" icon="boost-solid" type="popup" style="shrink-0 text-bitcoin" />
						{/if}
					{:else if showSkeleton}
						<div class="h-4 w-32 animate-pulse rounded bg-link/50"></div>
					{:else}
						<span class="truncate text-sm font-medium text-primary dark:text-white">Unknown</span>
					{/if}
				</div>

				<!-- Address -->
				{#if enrichedData?.address}
					<p class="mt-0.5 truncate text-xs text-body dark:text-white/70">
						{enrichedData.address}
					</p>
				{:else if showSkeleton}
					<div class="mt-0.5 h-3 w-24 animate-pulse rounded bg-link/50"></div>
				{/if}

				<!-- Payment methods -->
				{#if enrichedData && hasPaymentMethods}
					<div class="mt-1.5 flex gap-1">
						<PaymentMethodIcon
							status={enrichedData['osm:payment:onchain']}
							method="btc"
							label="On-chain"
							size="sm"
						/>
						<PaymentMethodIcon
							status={enrichedData['osm:payment:lightning']}
							method="ln"
							label="Lightning"
							size="sm"
						/>
						<PaymentMethodIcon
							status={enrichedData['osm:payment:lightning_contactless']}
							method="nfc"
							label="Lightning contactless"
							size="sm"
						/>
					</div>
				{:else if showSkeleton}
					<div class="mt-1.5 flex gap-1">
						<div class="h-5 w-5 animate-pulse rounded bg-link/50"></div>
						<div class="h-5 w-5 animate-pulse rounded bg-link/50"></div>
					</div>
				{/if}

				<!-- Status badges -->
				{#if enrichedData}
					<div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
						{#if isBoosted}
							<span
								class="flex items-center gap-1 rounded-full bg-bitcoin/10 px-2 py-0.5 text-bitcoin"
							>
								<Icon w="12" h="12" icon="boost-solid" type="popup" />
								Boosted
							</span>
						{/if}
						<span class="flex items-center gap-1 text-gray-500 dark:text-white/60">
							<Icon w="12" h="12" icon={isVerified ? 'check' : 'alert'} type="popup" />
							{isVerified ? 'Verified' : 'Outdated'}
							{#if enrichedData.verified_at}
								<span class="text-gray-400 dark:text-white/40"
									>· {formatVerifiedHuman(enrichedData.verified_at)}</span
								>
							{/if}
						</span>
					</div>
				{:else if showSkeleton}
					<div class="mt-1.5 h-4 w-20 animate-pulse rounded bg-link/50"></div>
				{/if}
			</div>

			<!-- Chevron -->
			<Icon
				w="16"
				h="16"
				icon="chevron_right"
				type="material"
				style="mt-0.5 shrink-0 text-gray-400 dark:text-white/40"
			/>
		</div>
	</button>
</li>
